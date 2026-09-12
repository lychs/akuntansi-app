import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, ChevronDown, PlusCircle, Pencil, Check, X, Sun, Moon, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useTheme } from '../lib/useTheme.js'
import Avatar from './Avatar.jsx'
import HeaderSearch from './HeaderSearch.jsx'
import NotificationBell from './NotificationBell.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

export default function TopHeader({ onMenuClick }) {
  const { t } = useTranslation()
  const { companies, activeCompanyId, setActiveCompanyId } = useCompany()
  const { session } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const email = session?.user?.email || ''
  const activeCompany = companies.find((c) => c.id === activeCompanyId)
  const menuRef = useRef(null)

  useEffect(() => {
    if (session?.user?.id) loadProfile()
  }, [session?.user?.id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
    if (data?.full_name) setFullName(data.full_name)
  }

  async function saveName() {
    if (!nameInput.trim()) return
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, full_name: nameInput.trim() })
    if (!error) {
      setFullName(nameInput.trim())
      setEditing(false)
    }
  }

  const displayName = fullName || email

  return (
    <header className="top-header">
      <button className="mobile-menu-btn" onClick={onMenuClick} type="button" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <HeaderSearch />
      <div className="top-header-right">
        {companies.length > 1 && (
          <>
            {activeCompany?.logoUrl && <img src={activeCompany.logoUrl} alt="" className="company-logo-mini" />}
            <select
              className="company-switcher"
              value={activeCompanyId}
              onChange={(e) => setActiveCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
        {companies.length === 1 && (
          <>
            {companies[0].logoUrl && <img src={companies[0].logoUrl} alt="" className="company-logo-mini" />}
            <span className="company-name-static">{companies[0].name}</span>
          </>
        )}

        <NotificationBell />

        <LanguageSwitcher />

        <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? t('topheader.lightMode') : t('topheader.darkMode')}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="user-menu" ref={menuRef}>
          <button className="user-menu-btn" onClick={() => setMenuOpen(!menuOpen)} type="button">
            <Avatar name={displayName} />
            <span className="user-name-block">
              <span className="user-name">{displayName}</span>
              {activeCompany && <span className="user-company">{activeCompany.name}</span>}
            </span>
            <ChevronDown size={14} className={`user-menu-chevron ${menuOpen ? 'open' : ''}`} />
          </button>
          {menuOpen && (
            <div className="user-menu-dropdown">
              <div className="user-menu-header">
                <Avatar name={displayName} />
                <div>
                  <div className="user-menu-header-name">{displayName}</div>
                  {fullName && <div className="user-menu-header-email">{email}</div>}
                </div>
              </div>
              <div className="user-menu-divider" />
              {editing ? (
                <div className="user-name-edit">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={t('topheader.namePlaceholder')}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  />
                  <button onClick={saveName} title={t('topheader.saveName')}><Check size={14} /></button>
                  <button onClick={() => setEditing(false)} title={t('topheader.cancelEdit')}><X size={14} /></button>
                </div>
              ) : (
                <button onClick={() => { setNameInput(fullName); setEditing(true) }}>
                  <Pencil size={15} /> {t('topheader.changeName')}
                </button>
              )}
              <Link to="/perusahaan/tambah" onClick={() => setMenuOpen(false)}>
                <PlusCircle size={15} /> {t('topheader.addCompany')}
              </Link>
              <div className="user-menu-divider" />
              <button className="danger" onClick={() => supabase.auth.signOut()}>
                <LogOut size={15} /> {t('topheader.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
