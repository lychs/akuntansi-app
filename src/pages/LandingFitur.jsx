import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Receipt, BarChart3, LayoutDashboard, Wallet, HandCoins, Package, GitBranch, Download, ArrowRight } from 'lucide-react'
import LandingNav from '../components/LandingNav.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import { Reveal } from '../lib/useReveal.jsx'
import { useLandingDarkMode } from '../lib/useLandingDarkMode.js'
import '../landing.css'

const ICONS = [Receipt, BarChart3, LayoutDashboard, Wallet, HandCoins, Package, GitBranch, Download]

export default function LandingFitur() {
  const { t } = useTranslation()
  const [isDark, toggleDark] = useLandingDarkMode()
  const f = (n, part) => t(`landing.features.f${n}${part}`)

  return (
    <div className={`lp ${isDark ? "dark" : ""}`}>
      <LandingNav isDark={isDark} onToggleDark={toggleDark} />

      <header className="lp-page-header lp-wrap">
        <h1 className="lp-head">{t('landing.fiturPage.title')}</h1>
        <p>{t('landing.fiturPage.subtitle')}</p>
      </header>

      <section className="lp-section-tight">
        <div className="lp-wrap-narrow">
          <Reveal stagger>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
              const Icon = ICONS[n - 1]
              return (
                <div className="lp-feat-simple-row" key={n}>
                  <div className="lp-feat-simple-icon"><Icon size={19} /></div>
                  <div>
                    <h3 className="lp-feat-simple-title">{f(n, 't')}</h3>
                    <p className="lp-feat-simple-desc">{f(n, 'd')}</p>
                  </div>
                </div>
              )
            })}
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
    </div>
  )
}
