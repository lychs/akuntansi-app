import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'

export default function HeaderSearch() {
  const { t } = useTranslation()
  const { activeCompanyId } = useCompany()
  const [q, setQ] = useState('')
  const [results, setResults] = useState({ accounts: [], contacts: [] })
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!q.trim() || !activeCompanyId) {
      setResults({ accounts: [], contacts: [] })
      return
    }
    const timer = setTimeout(async () => {
      const [{ data: accounts }, { data: contacts }] = await Promise.all([
        supabase.from('accounts').select('id, code, name').eq('company_id', activeCompanyId)
          .or(`name.ilike.%${q}%,code.ilike.%${q}%`).limit(5),
        supabase.from('contacts').select('id, name').eq('company_id', activeCompanyId)
          .ilike('name', `%${q}%`).limit(5),
      ])
      setResults({ accounts: accounts || [], contacts: contacts || [] })
    }, 250)
    return () => clearTimeout(timer)
  }, [q, activeCompanyId])

  const hasResults = results.accounts.length > 0 || results.contacts.length > 0

  function goTo(path, query) {
    setOpen(false)
    setQ('')
    navigate(`${path}?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className="header-search" ref={boxRef}>
      <Search size={16} className="header-search-icon" />
      <input
        placeholder={t('headerSearch.placeholder')}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim() && (
        <div className="header-search-dropdown">
          {!hasResults && <div className="header-search-empty">{t('headerSearch.noResults', { query: q })}</div>}
          {results.accounts.length > 0 && (
            <div className="header-search-group">
              <div className="header-search-group-label">{t('headerSearch.accounts')}</div>
              {results.accounts.map((a) => (
                <button key={a.id} onClick={() => goTo('/master/akun', a.name)}>
                  {a.name} <span className="header-search-code">({a.code})</span>
                </button>
              ))}
            </div>
          )}
          {results.contacts.length > 0 && (
            <div className="header-search-group">
              <div className="header-search-group-label">{t('headerSearch.contacts')}</div>
              {results.contacts.map((c) => (
                <button key={c.id} onClick={() => goTo('/master/kontak', c.name)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
