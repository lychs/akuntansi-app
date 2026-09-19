import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe2, ChevronDown, Menu, X, Sun, Moon } from 'lucide-react'

const LANGS = [
  { code: 'id', label: 'Indonesia' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'fr', label: 'Français' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ar', label: 'العربية' },
]

export default function LandingNav({ isDark, onToggleDark }) {
  const { t, i18n } = useTranslation()
  const [langOpen, setLangOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setLangOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 16) }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const current = LANGS.find((l) => l.code === i18n.language) || LANGS[0]

  return (
    <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="lp-wrap lp-nav-row">
        <Link to="/" className="lp-nav-brand">
          <img src="/logo-icon.png" alt="My Worksheet" className="lp-nav-mark" />
          <span className="lp-nav-word">My Worksheet</span>
        </Link>
        <div className="lp-nav-links">
          <Link to="/">{t('landing.nav.beranda')}</Link>
          <Link to="/fitur">{t('landing.nav.fitur')}</Link>
          <Link to="/#solusi">{t('landing.nav.solusi')}</Link>
          <Link to="/harga">{t('landing.nav.harga')}</Link>
          <Link to="/tentang">{t('landing.nav.tentang')}</Link>
        </div>
        <div className="lp-nav-actions">
          <button type="button" className="lp-btn lp-btn-ghost lp-lang-btn" onClick={onToggleDark} aria-label="Toggle dark mode">
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="lp-lang-switch" ref={ref}>
            <button type="button" className="lp-btn lp-btn-ghost lp-lang-btn" onClick={() => setLangOpen(!langOpen)}>
              <Globe2 size={14} /> {current.code.toUpperCase()} <ChevronDown size={12} />
            </button>
            {langOpen && (
              <div className="lp-lang-menu">
                {LANGS.map((l) => (
                  <button key={l.code} type="button" className={l.code === i18n.language ? 'active' : ''} onClick={() => { i18n.changeLanguage(l.code); setLangOpen(false) }}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link to="/login" className="lp-btn lp-btn-ghost">{t('landing.nav.masuk')}</Link>
          <Link to="/login" className="lp-btn lp-btn-primary">{t('landing.nav.cobaGratis')}</Link>
          <button type="button" className="lp-nav-hamburger" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lp-mobile-menu">
          <div className="lp-mobile-menu-top">
            <Link to="/" className="lp-nav-brand" onClick={() => setMobileOpen(false)}>
              <img src="/logo-icon.png" alt="My Worksheet" className="lp-nav-mark" />
              <span className="lp-nav-word">My Worksheet</span>
            </Link>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <X size={22} />
            </button>
          </div>
          <Link to="/" onClick={() => setMobileOpen(false)}>{t('landing.nav.beranda')}</Link>
          <Link to="/fitur" onClick={() => setMobileOpen(false)}>{t('landing.nav.fitur')}</Link>
          <Link to="/#solusi" onClick={() => setMobileOpen(false)}>{t('landing.nav.solusi')}</Link>
          <Link to="/harga" onClick={() => setMobileOpen(false)}>{t('landing.nav.harga')}</Link>
          <Link to="/tentang" onClick={() => setMobileOpen(false)}>{t('landing.nav.tentang')}</Link>
          <div className="lp-mobile-menu-cta">
            <button type="button" className="lp-btn lp-btn-ghost lp-btn-block" onClick={onToggleDark}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? 'Mode Terang' : 'Mode Gelap'}
            </button>
            <Link to="/login" className="lp-btn lp-btn-ghost lp-btn-block" onClick={() => setMobileOpen(false)}>{t('landing.nav.masuk')}</Link>
            <Link to="/login" className="lp-btn lp-btn-primary lp-btn-block" onClick={() => setMobileOpen(false)}>{t('landing.nav.cobaGratis')}</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
