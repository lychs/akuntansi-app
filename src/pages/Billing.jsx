import { useTranslation } from 'react-i18next'
import { CreditCard, Check } from 'lucide-react'

export default function Billing() {
  const { t } = useTranslation()

  const plans = [
    {
      key: 'free', name: t('pengaturan.planFreeName'), price: t('pengaturan.priceFree'), current: true,
      features: [t('pengaturan.featureCompanies1'), t('pengaturan.featureUsersLimited'), t('pengaturan.featureReportsBasic')],
    },
    {
      key: 'pro', name: t('pengaturan.planProName'), price: t('pengaturan.pricePro'), featured: true,
      features: [t('pengaturan.featureCompaniesUnlimited'), t('pengaturan.featureUsersUnlimited'), t('pengaturan.featureReportsAdvanced')],
    },
    {
      key: 'business', name: t('pengaturan.planBusinessName'), price: t('pengaturan.priceBusiness'),
      features: [t('pengaturan.featureCompaniesUnlimited'), t('pengaturan.featureUsersUnlimited'), t('pengaturan.featureReportsAdvanced'), t('pengaturan.featurePrioritySupport')],
    },
  ]

  function handleUpgradeClick() {
    alert(t('pengaturan.comingSoonToast'))
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('pengaturan.billingMenuTitle')}</h1></div>

      <div className="settings-section">
        <div className="settings-card">
          <h3><CreditCard size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('pengaturan.billingTitle')}</h3>
          <p>{t('pengaturan.billingDesc')}</p>

          <div className="plan-grid">
            {plans.map((p) => (
              <div key={p.key} className={`plan-card ${p.featured ? 'featured' : ''}`}>
                <h4>{p.name}</h4>
                <div className="plan-price">{p.price}<span>{p.price !== t('pengaturan.priceFree') ? t('pengaturan.perMonth') : ''}</span></div>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}><Check size={13} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--positive)' }} />{f}</li>
                  ))}
                </ul>
                {p.current ? (
                  <button className="btn-secondary" disabled style={{ width: '100%' }}>{t('pengaturan.currentPlanBadge')}</button>
                ) : (
                  <button className="btn-primary" style={{ width: '100%' }} onClick={handleUpgradeClick}>{t('pengaturan.upgradeButton')}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
