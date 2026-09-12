import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CompanyProvider, useCompany } from '../lib/CompanyContext.jsx'
import Sidebar from './Sidebar.jsx'
import TopHeader from './TopHeader.jsx'
import Onboarding from '../pages/Onboarding.jsx'

function LayoutInner() {
  const { t } = useTranslation()
  const { companies, loading } = useCompany()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Tutup drawer sidebar mobile otomatis tiap kali pindah halaman
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])

  if (loading) {
    return (
      <div className="page-loading-center">
        <div className="page-loading-spinner" />
        <p>{t('common.loading')}</p>
      </div>
    )
  }
  if (!companies.length) return <Onboarding />

  return (
    <div className="app-shell">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-main">
        <TopHeader onMenuClick={() => setMobileNavOpen(true)} />
        <div className="app-content">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <CompanyProvider>
      <LayoutInner />
    </CompanyProvider>
  )
}
