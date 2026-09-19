import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, AlertTriangle } from 'lucide-react'
import { useCompany } from '../lib/CompanyContext.jsx'

export default function TrialBanner() {
  const { t } = useTranslation()
  const { activePlan, activeTrialExpiresAt } = useCompany()

  if (activePlan !== 'free' || !activeTrialExpiresAt) return null

  const expiresAt = new Date(activeTrialExpiresAt)
  const now = new Date()
  const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
  const isExpired = daysLeft <= 0

  return (
    <Link to="/billing" className={`trial-banner ${isExpired ? 'expired' : ''}`}>
      {isExpired ? <AlertTriangle size={15} /> : <Clock size={15} />}
      <span>
        {isExpired
          ? t('trialBanner.expired')
          : t('trialBanner.daysLeft', { count: daysLeft })}
      </span>
      <span className="trial-banner-cta">{t('trialBanner.upgradeCta')}</span>
    </Link>
  )
}
