import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext.jsx'

const CompanyContext = createContext(null)

export function CompanyProvider({ children }) {
  const { session } = useAuth()
  const [companies, setCompanies] = useState([])
  const [activeCompanyId, setActiveCompanyIdState] = useState(localStorage.getItem('activeCompanyId') || '')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    await supabase.rpc('accept_pending_invitations')
    const userId = session?.user?.id
    if (!userId) {
      setCompanies([])
      setLoading(false)
      return []
    }
    // PENTING: filter eksplisit by user_id di sini, JANGAN cuma andalkan RLS.
    // Untuk user yang berperan admin, policy RLS "admin can view all company members"
    // sengaja membolehkan dia lihat baris company_users milik SEMUA anggota (buat
    // kebutuhan halaman Kelola Akses) — kalau query ini gak difilter user_id sendiri,
    // admin bakal dapat 1 baris per ANGGOTA (bukan per perusahaan), jadi perusahaan yang
    // sama muncul berkali-kali di dropdown sesuai jumlah anggotanya.
    const { data, error } = await supabase
      .from('company_users')
      .select('company_id, role, companies ( id, name, logo_url, business_type, inventory_method )')
      .eq('user_id', userId)
    if (error) {
      console.error(error)
      setLoading(false)
      return []
    }
    // Dedupe sebagai jaring pengaman tambahan (kalau-kalau ada baris ganda beneran di DB).
    const seen = new Set()
    const list = []
    for (const r of data || []) {
      if (!r.companies || seen.has(r.companies.id)) continue
      seen.add(r.companies.id)
      list.push({
        id: r.companies.id, name: r.companies.name, logoUrl: r.companies.logo_url, role: r.role,
        businessType: r.companies.business_type, inventoryMethod: r.companies.inventory_method,
      })
    }
    setCompanies(list)
    setLoading(false)
    return list
  }, [session?.user?.id])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    // Kalau company aktif yang tersimpan sudah gak valid (mis. baru login user lain),
    // otomatis pilih company pertama yang tersedia.
    if (!loading && companies.length) {
      const stillValid = companies.some((c) => c.id === activeCompanyId)
      if (!stillValid) setActiveCompanyId(companies[0].id)
    }
  }, [loading, companies]) // eslint-disable-line react-hooks/exhaustive-deps

  function setActiveCompanyId(id) {
    localStorage.setItem('activeCompanyId', id)
    setActiveCompanyIdState(id)
  }

  const activeRole = companies.find((c) => c.id === activeCompanyId)?.role
  const canEdit = activeRole ? activeRole !== 'viewer' : true // default true selagi masih loading
  const activeBusinessType = companies.find((c) => c.id === activeCompanyId)?.businessType || 'jasa'

  return (
    <CompanyContext.Provider value={{ companies, activeCompanyId, setActiveCompanyId, loading, refresh, canEdit, activeRole, activeBusinessType }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  return useContext(CompanyContext)
}
