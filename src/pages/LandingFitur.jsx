import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import LandingNav from '../components/LandingNav.jsx'
import WhatsAppWidget from '../components/WhatsAppWidget.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import FeatureSearchTable from '../components/FeatureSearchTable.jsx'
import { Reveal } from '../lib/useReveal.jsx'
import { useLandingDarkMode } from '../lib/useLandingDarkMode.js'
import '../landing.css'

export default function LandingFitur() {
  const { t } = useTranslation()
  const [isDark, toggleDark] = useLandingDarkMode()

  return (
    <div className={`lp ${isDark ? "dark" : ""}`}>
      <LandingNav isDark={isDark} onToggleDark={toggleDark} />

      <header className="lp-page-header lp-wrap">
        <h1 className="lp-head">{t('featureTable.search.title')}</h1>
        <p>{t('featureTable.search.subtitle')}</p>
      </header>

      <section className="lp-section-tight">
        <div className="lp-wrap">
          <Reveal>
            <FeatureSearchTable />
          </Reveal>
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
