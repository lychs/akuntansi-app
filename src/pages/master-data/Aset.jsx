import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Settings2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField } from '../../components/DateField.jsx'
import { computeBookValue, fmt } from '../../lib/reportHelpers.js'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function Aset() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [assets, setAssets] = useState([])
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ depreciation_start_date: '', useful_life_months: '', salvage_value: 0 })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('assets')
      .select('id, code, name, description, acquisition_date, acquisition_cost, depreciation_start_date, useful_life_months, salvage_value, accounts ( id, code, name )')
      .eq('company_id', companyId)
      .order('acquisition_date', { ascending: false })
    if (error) setError(error.message)
    else setAssets(data || [])
  }

  function openEdit(a) {
    setEditingId(a.id)
    setEditForm({
      depreciation_start_date: a.depreciation_start_date || '',
      useful_life_months: a.useful_life_months || '',
      salvage_value: a.salvage_value || 0,
    })
  }

  async function handleSaveDepreciation(e) {
    e.preventDefault()
    setError(null)
    if (editForm.depreciation_start_date && !editForm.useful_life_months) {
      setError(t('aset.errDeprLifeRequired'))
      return
    }
    setSaving(true)
    const { error } = await supabase.from('assets').update({
      depreciation_start_date: editForm.depreciation_start_date || null,
      useful_life_months: editForm.useful_life_months || null,
      salvage_value: editForm.salvage_value || 0,
    }).eq('id', editingId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setEditingId(null)
    load()
  }

  async function handleDelete(a) {
    if (!confirm(t('common.confirmDelete', { name: a.name }))) return
    setError(null)
    const { error } = await supabase.from('assets').delete().eq('id', a.id)
    if (error) { setError(error.message); return }
    load()
  }

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.code.includes(q))

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('aset.title')}</h1>
          <input placeholder={t('aset.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="hint" style={{ marginBottom: 16 }}>{t('aset.autoCreatedHint')}</p>
        {!canEdit && <ViewerNotice />}
        {error && <p className="error">{error}</p>}

        <table className="tbl">
          <thead>
            <tr>
              <th>{t('aset.colCode')}</th><th>{t('aset.colName')}</th><th>{t('aset.colAssetAccount')}</th><th>{t('aset.colAcqDate')}</th>
              <th className="num">{t('aset.colAcqCost')}</th><th>{t('aset.colDepreciation')}</th><th className="num">{t('aset.colBookValue')}</th>{canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const bv = computeBookValue(a)
              const isEditing = editingId === a.id
              return (
                <Fragment key={a.id}>
                  <tr>
                    <td>{a.code}</td>
                    <td>{a.name}</td>
                    <td>{a.accounts ? `${a.accounts.name} (${a.accounts.code})` : '-'}</td>
                    <td>{a.acquisition_date}</td>
                    <td className="num">{fmt(a.acquisition_cost)}</td>
                    <td>
                      {bv.started
                        ? <span className="badge lunas">{t('aset.running', { elapsed: bv.monthsElapsed, life: bv.usefulLife })}</span>
                        : <span className="badge pending">{t('aset.notStarted')}</span>}
                    </td>
                    <td className="num">{fmt(bv.bookValue)}</td>
                    {canEdit && (
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon-danger" onClick={() => openEdit(a)} title={t('aset.configureDepreciation')} style={{ color: 'var(--brand)' }}>
                          <Settings2 size={14} />
                        </button>
                        <button className="btn-icon-danger" onClick={() => handleDelete(a)} title={t('common.delete')}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                  {isEditing && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-alt)', padding: 0 }}>
                        <form className="inline-form" onSubmit={handleSaveDepreciation} style={{ padding: 16, margin: 0 }}>
                          <div className="field">
                            <label>{t('aset.depreciationStart')}</label>
                            <DateField value={editForm.depreciation_start_date} onChange={(v) => setEditForm({ ...editForm, depreciation_start_date: v })} />
                          </div>
                          <div className="field">
                            <label>{t('aset.usefulLife')}{editForm.depreciation_start_date ? ' *' : ''}</label>
                            <input type="number" min="1" value={editForm.useful_life_months} onChange={(e) => setEditForm({ ...editForm, useful_life_months: e.target.value })} placeholder={t('aset.usefulLifePlaceholder')} required={!!editForm.depreciation_start_date} />
                          </div>
                          <div className="field">
                            <label>{t('aset.salvageValue')}</label>
                            <CurrencyInput value={editForm.salvage_value} onChange={(v) => setEditForm({ ...editForm, salvage_value: v })} />
                          </div>
                          <button className="btn-primary" disabled={saving}>{saving ? t('aset.saving') : t('aset.save')}</button>
                          <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!filtered.length && <tr><td colSpan={8} className="empty">{t('aset.noAssets')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
