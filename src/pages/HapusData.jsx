import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'

export default function HapusData() {
  const { t } = useTranslation()
  const { activeCompanyId, activeRole, companies, refresh } = useCompany()
  const activeCompany = companies.find((c) => c.id === activeCompanyId)
  const isAdmin = activeRole === 'admin'

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const companyName = activeCompany?.name || ''
  const canConfirm = confirmText.trim() === companyName.trim() && companyName.trim() !== ''

  async function handleDeleteAll() {
    if (!canConfirm) return
    if (!confirm(t('common.confirmDelete', { name: companyName }))) return
    setDeleting(true)
    setError(null)
    setSuccess(null)
    const { error } = await supabase.rpc('reset_company_data', { p_company_id: activeCompanyId })
    setDeleting(false)
    if (error) { setError(error.message); return }
    setSuccess(t('pengaturan.deleteSuccess'))
    setConfirmText('')
    refresh()
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('pengaturan.hapusDataTitle')}</h1></div>

      <div className="settings-section">
        <div className="settings-card danger">
          <h3><AlertTriangle size={16} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--negative)' }} />{t('pengaturan.dangerZoneTitle')}</h3>
          <p>{t('pengaturan.dangerZoneDesc')}</p>

          {!isAdmin ? (
            <p className="hint">{t('pengaturan.adminOnlyHint')}</p>
          ) : (
            <>
              <div className="field" style={{ maxWidth: 360, marginBottom: 12 }}>
                <label>{t('pengaturan.typeToConfirmLabel', { name: companyName })}</label>
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={companyName} />
              </div>
              {error && <p className="error">{error}</p>}
              {success && <p style={{ color: 'var(--positive)', fontSize: 13, marginBottom: 10 }}>{success}</p>}
              <button
                className="btn-primary"
                style={{ background: 'var(--negative)' }}
                disabled={!canConfirm || deleting}
                onClick={handleDeleteAll}
              >
                {deleting ? t('pengaturan.deleting') : t('pengaturan.deleteAllButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
