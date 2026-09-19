import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Settings2, Pencil } from 'lucide-react'
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
  const [accounts, setAccounts] = useState([])
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    depreciation_start_date: '', useful_life_months: '', salvage_value: 0,
    depreciation_expense_account_id: '', accumulated_depreciation_account_id: '',
  })
  const [editingBasicId, setEditingBasicId] = useState(null)
  const [basicForm, setBasicForm] = useState({ code: '', name: '', description: '', acquisition_date: '', acquisition_cost: 0 })
  const [basicSaving, setBasicSaving] = useState(false)
  const [basicError, setBasicError] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('assets')
      .select('id, code, name, description, acquisition_date, acquisition_cost, depreciation_start_date, useful_life_months, salvage_value, depreciation_expense_account_id, accumulated_depreciation_account_id, accounts!account_id ( id, code, name )')
      .eq('company_id', companyId)
      .order('acquisition_date', { ascending: false })
    if (error) setError(error.message)
    else setAssets(data || [])
    supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).order('code')
      .then(({ data }) => setAccounts(data || []))
  }

  function openEditBasic(a) {
    setEditingBasicId(a.id)
    setEditingId(null)
    setBasicError(null)
    setBasicForm({
      code: a.code || '',
      name: a.name || '',
      description: a.description || '',
      acquisition_date: a.acquisition_date || '',
      acquisition_cost: a.acquisition_cost || 0,
    })
  }

  async function handleSaveBasic(e) {
    e.preventDefault()
    setBasicError(null)
    setBasicSaving(true)
    const { error } = await supabase.from('assets').update(basicForm).eq('id', editingBasicId)
    setBasicSaving(false)
    if (error) { setBasicError(error.message); return }
    setEditingBasicId(null)
    load()
  }

  function openEdit(a) {
    setEditingId(a.id)
    setEditingBasicId(null)
    setError(null)
    setEditForm({
      depreciation_start_date: a.depreciation_start_date || '',
      useful_life_months: a.useful_life_months || '',
      salvage_value: a.salvage_value || 0,
      depreciation_expense_account_id: a.depreciation_expense_account_id || '',
      accumulated_depreciation_account_id: a.accumulated_depreciation_account_id || '',
    })
  }

  async function handleSaveDepreciation(e) {
    e.preventDefault()
    setError(null)
    if (editForm.depreciation_start_date && !editForm.useful_life_months) {
      setError(t('aset.errDeprLifeRequired'))
      return
    }
    if (editForm.depreciation_start_date && (!editForm.depreciation_expense_account_id || !editForm.accumulated_depreciation_account_id)) {
      setError(t('aset.errDeprAccountsRequired'))
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('set_asset_depreciation', {
      p_asset_id: editingId,
      p_depreciation_start_date: editForm.depreciation_start_date || null,
      p_useful_life_months: editForm.useful_life_months ? Number(editForm.useful_life_months) : null,
      p_salvage_value: Number(editForm.salvage_value) || 0,
      p_expense_account_id: editForm.depreciation_expense_account_id || null,
      p_accumulated_account_id: editForm.accumulated_depreciation_account_id || null,
    })
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
        <p className="hint" style={{ marginBottom: 16 }}>{t('aset.autoPostingHint')}</p>
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
                        ? (
                          <span className="badge lunas">
                            {t('aset.running', { elapsed: bv.monthsElapsed, life: bv.usefulLife })}
                            {a.depreciation_expense_account_id ? ` · ${t('aset.autoPosting')}` : ` · ${t('aset.manualOnly')}`}
                          </span>
                        )
                        : <span className="badge pending">{t('aset.notStarted')}</span>}
                    </td>
                    <td className="num">{fmt(bv.bookValue)}</td>
                    {canEdit && (
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => openEditBasic(a)} title={t('common.edit')}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-icon-danger" onClick={() => openEdit(a)} title={t('aset.configureDepreciation')} style={{ color: 'var(--brand)' }}>
                          <Settings2 size={14} />
                        </button>
                        <button className="btn-icon-danger" onClick={() => handleDelete(a)} title={t('common.delete')}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                  {editingBasicId === a.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-alt)', padding: 0 }}>
                        <form onSubmit={handleSaveBasic} style={{ padding: 16, margin: 0 }}>
                          <div className="txn-form-row">
                            <div className="field">
                              <label>{t('aset.colCode')}</label>
                              <input value={basicForm.code} onChange={(e) => setBasicForm({ ...basicForm, code: e.target.value })} required />
                            </div>
                            <div className="field">
                              <label>{t('aset.colName')}</label>
                              <input value={basicForm.name} onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })} required />
                            </div>
                            <div className="field">
                              <label>{t('aset.colAcqDate')}</label>
                              <DateField value={basicForm.acquisition_date} onChange={(v) => setBasicForm({ ...basicForm, acquisition_date: v })} required />
                            </div>
                            <div className="field">
                              <label>{t('aset.colAcqCost')}</label>
                              <CurrencyInput value={basicForm.acquisition_cost} onChange={(v) => setBasicForm({ ...basicForm, acquisition_cost: v })} required />
                            </div>
                          </div>
                          <div className="field" style={{ marginTop: 8 }}>
                            <label>{t('akun.descriptionLabel')}</label>
                            <input value={basicForm.description} onChange={(e) => setBasicForm({ ...basicForm, description: e.target.value })} />
                          </div>
                          {basicError && <p className="error" style={{ marginTop: 10 }}>{basicError}</p>}
                          <div style={{ marginTop: 12 }}>
                            <button className="btn-primary" disabled={basicSaving}>{basicSaving ? t('common.saving') : t('common.save')}</button>
                            <button type="button" className="btn-secondary" onClick={() => setEditingBasicId(null)} style={{ marginLeft: 8 }}>{t('common.cancel')}</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                  {isEditing && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-alt)', padding: 0 }}>
                        <form onSubmit={handleSaveDepreciation} style={{ padding: 16, margin: 0 }}>
                          <div className="txn-form-row">
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
                          </div>
                          {editForm.depreciation_start_date && (
                            <>
                              <p className="hint" style={{ margin: '10px 0' }}>{t('aset.autoPostingExplain')}</p>
                              <div className="txn-form-row">
                                <div className="field">
                                  <label>{t('aset.expenseAccount')} *</label>
                                  <select value={editForm.depreciation_expense_account_id} onChange={(e) => setEditForm({ ...editForm, depreciation_expense_account_id: e.target.value })} required>
                                    <option value="">{t('transaksi.selectAccount')}</option>
                                    {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>)}
                                  </select>
                                </div>
                                <div className="field">
                                  <label>{t('aset.accumulatedAccount')} *</label>
                                  <select value={editForm.accumulated_depreciation_account_id} onChange={(e) => setEditForm({ ...editForm, accumulated_depreciation_account_id: e.target.value })} required>
                                    <option value="">{t('transaksi.selectAccount')}</option>
                                    {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>)}
                                  </select>
                                </div>
                              </div>
                            </>
                          )}
                          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
                          <div style={{ marginTop: 12 }}>
                            <button className="btn-primary" disabled={saving}>{saving ? t('aset.saving') : t('aset.save')}</button>
                            <button type="button" className="btn-secondary" onClick={() => setEditingId(null)} style={{ marginLeft: 8 }}>{t('common.cancel')}</button>
                          </div>
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
