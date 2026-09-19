import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const WHATSAPP_URL = 'https://wa.me/6285692050908'
const FEATURE_KEYS = ['validity', 'team', 'companies', 'bizType', 'reports', 'importExcel', 'printDoc', 'receipt', 'branch', 'recurring', 'support', 'customMenu']

export default function LandingPricingGrid() {
  const { t } = useTranslation()

  const plans = [
    { key: 'free', name: t('landing.pricing.freeName'), price: t('landing.pricing.freePrice'), cta: t('landing.pricing.ctaFree'), btnClass: 'lp-btn-ghost', link: '/login' },
    { key: 'basic', name: t('landing.pricing.basicName'), price: t('landing.pricing.basicPrice'), perYear: true, cta: t('landing.pricing.ctaBasic'), btnClass: 'lp-btn-ghost', link: '/login' },
    { key: 'pro', name: t('landing.pricing.proName'), price: t('landing.pricing.proPrice'), perYear: true, featured: true, badge: t('landing.pricing.proBadge'), cta: t('landing.pricing.ctaPro'), btnClass: 'lp-btn-light', link: '/login' },
    { key: 'corporate', name: t('landing.pricing.corporateName'), price: t('landing.pricing.corporatePrice'), cta: t('landing.pricing.ctaCorporate'), btnClass: 'lp-btn-ghost', link: WHATSAPP_URL, external: true },
  ]

  return (
    <div className="lp-pricing-grid lp-pricing-grid-4">
      {plans.map((p) => (
        <div key={p.key} className={`lp-price-card ${p.featured ? 'featured' : ''}`}>
          {p.badge && <span className="lp-price-badge">{p.badge}</span>}
          <div className="lp-price-name">{p.name}</div>
          <div className="lp-price-amount lp-tabular">{p.price}{p.perYear && <span className="lp-price-per">{t('landing.pricing.perYear')}</span>}</div>
          <ul className="lp-price-detail-list">
            {FEATURE_KEYS.map((fk) => (
              <li key={fk}>
                <span className="lp-price-detail-label">{t(`planFeatures.labels.${fk}`)}</span>
                <span className="lp-price-detail-value">{t(`planFeatures.${p.key}.${fk}`)}</span>
              </li>
            ))}
          </ul>
          {p.external ? (
            <a href={p.link} target="_blank" rel="noopener noreferrer" className={`lp-btn ${p.btnClass} lp-btn-block`}>{p.cta}</a>
          ) : (
            <Link to={p.link} className={`lp-btn ${p.btnClass} lp-btn-block`}>{p.cta}</Link>
          )}
        </div>
      ))}
    </div>
  )
}
