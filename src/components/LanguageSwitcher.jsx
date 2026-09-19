import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '../i18n/index.js'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(code) {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        className="lang-switcher-btn"
        onClick={() => setOpen(!open)}
        title={t('topheader.language')}
        type="button"
      >
        <Globe size={17} />
        <span className="lang-switcher-flag">{current.flag}</span>
      </button>
      {open && (
        <div className="lang-switcher-dropdown">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`lang-switcher-option ${l.code === i18n.language ? 'active' : ''}`}
              onClick={() => handleSelect(l.code)}
              type="button"
            >
              <span className="lang-switcher-flag">{l.flag}</span>
              <span>{l.label}</span>
              {l.code === i18n.language && <Check size={14} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
