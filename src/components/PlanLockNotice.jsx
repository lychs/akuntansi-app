import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'

// Ditampilin sebagai pengganti halaman/fitur yang dikunci buat paket Free.
export default function PlanLockNotice({ featureName }) {
  const { t } = useTranslation()
  return (
    <div className="section" style={{ textAlign: 'center', padding: '40px 24px', maxWidth: 480, margin: '40px auto' }}>
      <Lock size={28} style={{ color: 'var(--ink-muted)', marginBottom: 12 }} />
      <h3 style={{ marginBottom: 8 }}>{t('planLock.title', { feature: featureName })}</h3>
      <p className="hint" style={{ marginBottom: 20 }}>{t('planLock.desc')}</p>
      <Link to="/billing" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>{t('planLock.cta')}</Link>
    </div>
  )
}
