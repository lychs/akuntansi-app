import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Ticket, Clock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import { useCountdown } from '../lib/useCountdown.js'

const WHATSAPP_URL = 'https://wa.me/6285692050908'

export default function Billing() {
  const { t } = useTranslation()
  const { activeCompanyId, activePlan, activePlanExpiresAt, activeTrialExpiresAt, refresh } = useCompany()
  const [tokenCode, setTokenCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState(null)
  const [redeemSuccess, setRedeemSuccess] = useState(false)

  // Buat paket berbayar (dari tebus token), tampilkan countdown sampai plan_expires_at.
  // Buat paket Free, tampilkan countdown trial (trial_expires_at) kalau ada.
  const countdownTarget = activePlan !== 'free' ? activePlanExpiresAt : activeTrialExpiresAt
  const countdown = useCountdown(countdownTarget)

  const FEATURE_KEYS = ['validity', 'team', 'companies', 'bizType', 'reports', 'importExcel', 'printDoc', 'receipt', 'branch', 'recurring', 'support', 'customMenu']
  const plans = [
    { key: 'free', name: t('pengaturan.planFreeName'), price: t('pengaturan.priceFree') },
    { key: 'basic', name: t('pengaturan.planBasicName'), price: t('pengaturan.priceBasic') },
    { key: 'pro', name: t('pengaturan.planProName'), price: t('pengaturan.pricePro'), featured: true },
    { key: 'corporate', name: t('pengaturan.planCorporateName'), price: t('pengaturan.priceCorporate'), contactOnly: true },
  ]

  function handleUpgradeClick() {
    alert(t('pengaturan.comingSoonToast'))
  }

  async function handleRedeemToken(e) {
    e.preventDefault()
    setRedeemError(null)
    setRedeemSuccess(false)
    setRedeeming(true)
    const { error } = await supabase.rpc('redeem_subscription_token', {
      p_company_id: activeCompanyId, p_code: tokenCode.trim(),
    })
    setRedeeming(false)
    if (error) { setRedeemError(error.message); return }
    setRedeemSuccess(true)
    setTokenCode('')
    refresh()
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('pengaturan.billingMenuTitle')}</h1></div>

      {countdown && !countdown.expired && (
        <div className="plan-countdown-card">
          <Clock size={18} />
          <div>
            <div className="plan-countdown-label">
              {activePlan !== 'free' ? t('pengaturan.planActiveUntil') : t('pengaturan.trialActiveUntil')}
            </div>
            <div className="plan-countdown-timer">
              <span><strong>{countdown.days}</strong> {t('pengaturan.countdownDays')}</span>
              <span><strong>{String(countdown.hours).padStart(2, '0')}</strong> {t('pengaturan.countdownHours')}</span>
              <span><strong>{String(countdown.minutes).padStart(2, '0')}</strong> {t('pengaturan.countdownMinutes')}</span>
              <span><strong>{String(countdown.seconds).padStart(2, '0')}</strong> {t('pengaturan.countdownSeconds')}</span>
            </div>
          </div>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-card">
          <h3><CreditCard size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('pengaturan.billingTitle')}</h3>
          <p>{t('pengaturan.billingDesc')}</p>

          <div className="plan-grid">
            {plans.map((p) => (
              <div key={p.key} className={`plan-card ${p.featured ? 'featured' : ''}`}>
                <h4>{p.name}</h4>
                <div className="plan-price">{p.price}<span>{p.price !== t('pengaturan.priceFree') && p.price !== t('pengaturan.priceCorporate') ? t('pengaturan.perYear') : ''}</span></div>
                <ul className="plan-feature-detail-list">
                  {FEATURE_KEYS.map((fk) => (
                    <li key={fk}>
                      <span className="plan-feature-label">{t(`planFeatures.labels.${fk}`)}</span>
                      <span className="plan-feature-value">{t(`planFeatures.${p.key}.${fk}`)}</span>
                    </li>
                  ))}
                </ul>
                {activePlan === p.key ? (
                  <button className="btn-secondary" disabled style={{ width: '100%' }}>{t('pengaturan.currentPlanBadge')}</button>
                ) : p.contactOnly ? (
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>{t('pengaturan.contactUsButton')}</a>
                ) : (
                  <button className="btn-primary" style={{ width: '100%' }} onClick={handleUpgradeClick}>{t('pengaturan.upgradeButton')}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-card">
          <h3><Ticket size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('pengaturan.redeemTokenTitle')}</h3>
          <p>{t('pengaturan.redeemTokenDesc')}</p>
          <form onSubmit={handleRedeemToken} style={{ display: 'flex', gap: 10, maxWidth: 420, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <input value={tokenCode} onChange={(e) => setTokenCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" required style={{ fontFamily: 'monospace' }} />
            </div>
            <button className="btn-primary" disabled={redeeming}>{redeeming ? t('transaksi.saving') : t('pengaturan.redeemTokenButton')}</button>
          </form>
          {redeemError && <p className="error" style={{ marginTop: 10 }}>{redeemError}</p>}
          {redeemSuccess && <p style={{ color: 'var(--positive)', fontSize: 13, marginTop: 10 }}>{t('pengaturan.redeemTokenSuccess')}</p>}
        </div>
      </div>
    </div>
  )
}
