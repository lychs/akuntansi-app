import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, MessageCircle } from 'lucide-react'
import LandingNav from '../components/LandingNav.jsx'
import WhatsAppWidget from '../components/WhatsAppWidget.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import { Reveal } from '../lib/useReveal.jsx'
import { useLandingDarkMode } from '../lib/useLandingDarkMode.js'
import '../landing.css'

const WHATSAPP_URL = 'https://wa.me/6285692050908'

export default function LandingTentang() {
  const { t } = useTranslation()
  const [isDark, toggleDark] = useLandingDarkMode()

  return (
    <div className={`lp ${isDark ? "dark" : ""}`}>
      <LandingNav isDark={isDark} onToggleDark={toggleDark} />

      <header className="lp-page-header lp-wrap">
        <h1 className="lp-head">{t('landing.tentangPage.title')}</h1>
        <p>{t('landing.tentangPage.subtitle')}</p>
      </header>

      <section className="lp-section-tight">
        <div className="lp-wrap-narrow">
          <Reveal>
            <img src="/sbc-logo-full.jpg" alt="PT. Sistem Bisnis Cerdas" style={{ width: '100%', maxWidth: 460, display: 'block', margin: '0 auto 40px', borderRadius: 'var(--radius-md)' }} />
          </Reveal>
          <Reveal className="lp-center" style={{ marginBottom: 40 }}>
            <p className="lp-p-lead lp-center" style={{ margin: '0 auto', maxWidth: 620 }}>{t('landing.tentangPage.body1')}</p>
          </Reveal>
          <Reveal className="lp-center" style={{ marginBottom: 56 }}>
            <p className="lp-p-lead lp-center" style={{ margin: '0 auto', maxWidth: 620 }}>{t('landing.tentangPage.body2')}</p>
          </Reveal>

          <Reveal>
            <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{t('landing.tentangPage.productLabel')}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--primary-dark)' }}>My Worksheet</div>
              </div>
              <Link to="/fitur" className="lp-btn lp-btn-ghost">{t('landing.nav.fitur')} <ArrowRight size={15} /></Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section-tight lp-section-alt">
        <div className="lp-wrap-narrow lp-center">
          <Reveal>
            <span className="lp-eyebrow-label">{t('landing.tentangPage.contactKicker')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.tentangPage.contactTitle')}</h2>
            <p className="lp-p-lead lp-center" style={{ margin: '0 auto 28px' }}>{t('landing.tentangPage.contactDesc')}</p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-primary lp-btn-lg">
              <MessageCircle size={16} /> {t('landing.tentangPage.contactButton')}
            </a>
          </Reveal>
        </div>
      </section>

      <LandingFooter />
      <WhatsAppWidget />
    </div>
  )
}
