import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ArrowRight } from 'lucide-react'
import LandingNav from '../components/LandingNav.jsx'
import WhatsAppWidget from '../components/WhatsAppWidget.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import LandingPricingGrid from '../components/LandingPricingGrid.jsx'
import { Reveal } from '../lib/useReveal.jsx'
import { useLandingDarkMode } from '../lib/useLandingDarkMode.js'
import '../landing.css'

export default function LandingHarga() {
  const { t } = useTranslation()
  const [isDark, toggleDark] = useLandingDarkMode()

  return (
    <div className={`lp ${isDark ? "dark" : ""}`}>
      <LandingNav isDark={isDark} onToggleDark={toggleDark} />

      <header className="lp-page-header lp-wrap">
        <h1 className="lp-head">{t('landing.hargaPage.title')}</h1>
        <p>{t('landing.hargaPage.subtitle')}</p>
      </header>

      <section className="lp-section-tight">
        <div className="lp-wrap">
          <Reveal>
            <LandingPricingGrid />
          </Reveal>
        </div>
      </section>

      <section className="lp-section-tight lp-section-alt">
        <div className="lp-wrap-narrow">
          <Reveal className="lp-center" style={{ marginBottom: 8 }}>
            <h2 className="lp-h2 lp-head">{t('landing.hargaPage.faqTitle')}</h2>
          </Reveal>
          {['faq1', 'faq2', 'faq3'].map((k) => (
            <div key={k} style={{ borderTop: '1px solid var(--border)', padding: '22px 0' }}>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8, color: 'var(--primary-dark)' }}>{t(`landing.hargaPage.${k}q`)}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{t(`landing.hargaPage.${k}a`)}</p>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)' }} />
        </div>
      </section>

      <section className="lp-final-cta">
        <div className="lp-final-cta-bg" />
        <div className="lp-wrap lp-final-cta-content">
          <Reveal>
            <h2 className="lp-h2 lp-head" style={{ fontSize: 'clamp(28px,4vw,44px)' }}>{t('landing.cta.title')}</h2>
            <p className="lp-p-lead lp-center" style={{ margin: '0 auto 32px' }}>{t('landing.cta.desc')}</p>
            <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">{t('landing.cta.button')} <ArrowRight size={15} /></Link>
          </Reveal>
        </div>
      </section>

      <LandingFooter />
      <WhatsAppWidget />
    </div>
  )
}
