import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'

const FIELDS = [
  { key: 'inventory_account_id', labelKey: 'rawMaterialAccount', category: 'persediaan' },
  { key: 'wip_account_id', labelKey: 'wipAccount', category: 'persediaan' },
  { key: 'finished_goods_account_id', labelKey: 'finishedGoodsAccount', category: 'persediaan' },
  { key: 'cogs_account_id', labelKey: 'cogsAccount', category: 'beban_pokok' },
  { key: 'payroll_clearing_account_id', labelKey: 'payrollClearingAccount', category: 'hutang' },
  { key: 'production_variance_account_id', labelKey: 'varianceAccount', category: 'beban_operasional' },
]

export default function ManufacturingAccountSettings({ companyId, initialData, onSaved }) {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState([])
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, initialData?.[f.key] || '']))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).order('code')
      .then(({ data }) => setAccounts(data || []))
  }, [companyId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = Object.fromEntries(FIELDS.map((f) => [f.key, values[f.key] || null]))
    const { error } = await supabase.from('companies').update(payload).eq('id', companyId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setSaved(true)
    onSaved?.()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="section" style={{ maxWidth: '100%' }}>
      <h3>{t('manufacturingAccountSettings.title')}</h3>
      <p className="hint" style={{ marginBottom: 16 }}>{t('manufacturingAccountSettings.desc')}</p>

      {FIELDS.map((f) => {
        const matching = accounts.filter((a) => a.category === f.category)
        const others = accounts.filter((a) => a.category !== f.category)
        return (
          <div className="field" key={f.key} style={{ maxWidth: 460, marginBottom: 14 }}>
            <label>{t(`manufacturingAccountSettings.${f.labelKey}`)}</label>
            <select value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
              <option value="">{t('transaksi.selectAccount')}</option>
              {matching.length > 0 && (
                <optgroup label={t('dagangAccountSettings.recommended')}>
                  {matching.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label={t('dagangAccountSettings.otherAccounts')}>
                  {others.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                </optgroup>
              )}
            </select>
          </div>
        )
      })}

      {error && <p className="error">{error}</p>}
      {saved && <p style={{ color: 'var(--positive)', fontSize: 13 }}>{t('profilPerusahaan.updateSuccess')}</p>}
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? t('transaksi.saving') : t('costCenter.save')}
      </button>
    </div>
  )
}
