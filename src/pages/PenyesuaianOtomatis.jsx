import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Calculator, Package } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { DateField } from '../components/DateField.jsx'
import CurrencyInput from '../components/CurrencyInput.jsx'
import { useCompany } from '../lib/CompanyContext.jsx'
import ViewerNotice from '../components/ViewerNotice.jsx'

const DEFAULT_TIERS = [
  { label: '0-30', min: 0, max: 30, pct: 1 },
  { label: '31-60', min: 31, max: 60, pct: 5 },
  { label: '61-90', min: 61, max: 90, pct: 10 },
  { label: '90+', min: 91, max: 999999, pct: 25 },
]

export default function PenyesuaianOtomatis() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit, activeBusinessType } = useCompany()
  const [accounts, setAccounts] = useState([])
  const [tab, setTab] = useState('deferred')

  useEffect(() => {
    if (!companyId) return
    supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).order('code')
      .then(({ data }) => setAccounts(data || []))
  }, [companyId])

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('penyesuaian.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('penyesuaian.pageHint')}</p>
      {!canEdit && <ViewerNotice />}

      <div className="tab-row" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <button className={`tab-btn ${tab === 'deferred' ? 'active' : ''}`} onClick={() => setTab('deferred')}
          style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: tab === 'deferred' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: tab === 'deferred' ? 700 : 500, color: tab === 'deferred' ? 'var(--brand)' : 'var(--ink-muted)' }}>
          {t('penyesuaian.tabDeferred')}
        </button>
        <button className={`tab-btn ${tab === 'baddebt' ? 'active' : ''}`} onClick={() => setTab('baddebt')}
          style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: tab === 'baddebt' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: tab === 'baddebt' ? 700 : 500, color: tab === 'baddebt' ? 'var(--brand)' : 'var(--ink-muted)' }}>
          {t('penyesuaian.tabBadDebt')}
        </button>
        {(activeBusinessType === 'dagang' || activeBusinessType === 'manufaktur') && (
          <button className={`tab-btn ${tab === 'writedown' ? 'active' : ''}`} onClick={() => setTab('writedown')}
            style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: tab === 'writedown' ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: tab === 'writedown' ? 700 : 500, color: tab === 'writedown' ? 'var(--brand)' : 'var(--ink-muted)' }}>
            {t('penyesuaian.tabWritedown')}
          </button>
        )}
      </div>

      {tab === 'deferred' && <DeferredItemsSection companyId={companyId} canEdit={canEdit} accounts={accounts} t={t} />}
      {tab === 'baddebt' && <BadDebtSection companyId={companyId} canEdit={canEdit} accounts={accounts} t={t} />}
      {tab === 'writedown' && (activeBusinessType === 'dagang' || activeBusinessType === 'manufaktur') && (
        <WritedownSection companyId={companyId} canEdit={canEdit} accounts={accounts} t={t} />
      )}
    </div>
  )
}

// ============================================================================
// SECTION A: Biaya Dibayar Dimuka & Pendapatan Diterima Dimuka
// ============================================================================
function DeferredItemsSection({ companyId, canEdit, accounts, t }) {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'prepaid_expense', name: '', total_amount: 0,
    start_date: new Date().toISOString().slice(0, 10), month_count: 12,
    balance_account_id: '', pl_account_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase.from('deferred_items').select('*').eq('company_id', companyId).order('start_date', { ascending: false })
    if (error) setError(error.message)
    else setItems(data || [])
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    if (!form.balance_account_id || !form.pl_account_id) { setError(t('penyesuaian.errAccountsRequired')); return }
    setSaving(true)
    const { error } = await supabase.rpc('set_deferred_item', {
      p_id: null,
      p_company_id: companyId,
      p_type: form.type,
      p_name: form.name.trim(),
      p_total_amount: Number(form.total_amount),
      p_start_date: form.start_date,
      p_month_count: Number(form.month_count),
      p_balance_account_id: form.balance_account_id,
      p_pl_account_id: form.pl_account_id,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ type: 'prepaid_expense', name: '', total_amount: 0, start_date: new Date().toISOString().slice(0, 10), month_count: 12, balance_account_id: '', pl_account_id: '' })
    setShowForm(false)
    load()
  }

  async function handleDelete(id, name) {
    if (!confirm(t('common.confirmDelete', { name }))) return
    const { error } = await supabase.rpc('delete_deferred_item', { p_id: id })
    if (error) { setError(error.message); return }
    load()
  }

  function accName(id) {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.name} (${a.code})` : '-'
  }

  function monthsElapsed(item) {
    const start = new Date(item.start_date)
    const now = new Date()
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    if (now.getDate() < start.getDate()) months -= 1
    return Math.min(Math.max(months, 0), item.month_count)
  }

  return (
    <div>
      {canEdit && (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(!showForm)}>
          <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          {showForm ? t('common.cancel') : t('penyesuaian.addDeferred')}
        </button>
      )}

      {showForm && (
        <form className="section inline-form" onSubmit={handleSave}>
          <div className="field">
            <label>{t('penyesuaian.deferredType')}</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="prepaid_expense">{t('penyesuaian.typePrepaidExpense')}</option>
              <option value="unearned_revenue">{t('penyesuaian.typeUnearnedRevenue')}</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>{t('penyesuaian.deferredName')}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('penyesuaian.deferredNamePlaceholder')} required />
          </div>
          <div className="field">
            <label>{t('penyesuaian.totalAmount')}</label>
            <CurrencyInput value={form.total_amount} onChange={(v) => setForm({ ...form, total_amount: v })} required />
          </div>
          <div className="field">
            <label>{t('penyesuaian.startDate')}</label>
            <DateField value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} required />
          </div>
          <div className="field">
            <label>{t('penyesuaian.monthCount')}</label>
            <input type="number" min="1" value={form.month_count} onChange={(e) => setForm({ ...form, month_count: e.target.value })} required />
          </div>
          <div className="field">
            <label>{form.type === 'prepaid_expense' ? t('penyesuaian.balanceAccountPrepaid') : t('penyesuaian.balanceAccountUnearned')}</label>
            <select value={form.balance_account_id} onChange={(e) => setForm({ ...form, balance_account_id: e.target.value })} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{form.type === 'prepaid_expense' ? t('penyesuaian.plAccountExpense') : t('penyesuaian.plAccountRevenue')}</label>
            <select value={form.pl_account_id} onChange={(e) => setForm({ ...form, pl_account_id: e.target.value })} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          {form.total_amount > 0 && form.month_count > 0 && (
            <p className="hint" style={{ flexBasis: '100%' }}>
              {t('penyesuaian.monthlyPreview', { amount: Math.round(Number(form.total_amount) / Number(form.month_count)).toLocaleString('id-ID') })}
            </p>
          )}
          <button className="btn-primary" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <table className="tbl">
        <thead>
          <tr>
            <th>{t('penyesuaian.deferredName')}</th><th>{t('penyesuaian.deferredType')}</th>
            <th className="num">{t('penyesuaian.totalAmount')}</th><th>{t('penyesuaian.progress')}</th>
            <th>{t('penyesuaian.balanceAccountPrepaid')}</th><th>{t('penyesuaian.plAccountExpense')}</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td>{it.type === 'prepaid_expense' ? t('penyesuaian.typePrepaidExpense') : t('penyesuaian.typeUnearnedRevenue')}</td>
              <td className="num">{Number(it.total_amount).toLocaleString('id-ID')}</td>
              <td>{monthsElapsed(it)} / {it.month_count} {t('penyesuaian.months')}</td>
              <td>{accName(it.balance_account_id)}</td>
              <td>{accName(it.pl_account_id)}</td>
              {canEdit && (
                <td>
                  <button className="btn-icon-danger" onClick={() => handleDelete(it.id, it.name)} title={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!items.length && <tr><td colSpan={7} className="empty">{t('penyesuaian.noDeferred')}</td></tr>}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: 10 }}>{t('penyesuaian.deferredHint')}</p>
    </div>
  )
}

// ============================================================================
// SECTION B: Cadangan Kerugian Piutang (Bad Debt Provision)
// ============================================================================
function BadDebtSection({ companyId, canEdit, accounts, t }) {
  const [receivables, setReceivables] = useState([])
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [contraAccountId, setContraAccountId] = useState('')
  const [currentBalance, setCurrentBalance] = useState(0)
  const [note, setNote] = useState(t('penyesuaian.badDebtDefaultNote'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => { load() }, [companyId])
  useEffect(() => { if (contraAccountId) loadBalance() }, [contraAccountId])

  async function load() {
    const { data, error } = await supabase.from('v_receivables_payables').select('*').eq('company_id', companyId).eq('type', 'piutang')
    if (error) { setError(error.message); return }
    setReceivables((data || []).filter((r) => Number(r.sisa) > 0))
  }

  async function loadBalance() {
    const { data } = await supabase.rpc('get_trial_balance', { p_company_id: companyId, p_start: '1900-01-01', p_end: new Date().toISOString().slice(0, 10) })
    const row = (data || []).find((r) => r.account_id === contraAccountId)
    setCurrentBalance(row ? Number(row.total_credit || 0) - Number(row.total_debit || 0) : 0)
  }

  const today = new Date()
  const aging = tiers.map((tier) => {
    const items = receivables.filter((r) => {
      if (!r.due_date) return tier.min === 0
      const days = Math.floor((today - new Date(r.due_date)) / 86400000)
      return days >= tier.min && days <= tier.max
    })
    const total = items.reduce((s, r) => s + Number(r.sisa), 0)
    return { ...tier, total, provision: Math.round(total * tier.pct / 100) }
  })
  const totalProvisionTarget = aging.reduce((s, a) => s + a.provision, 0)
  const adjustmentNeeded = totalProvisionTarget - currentBalance

  function updateTierPct(idx, pct) {
    setTiers((ts) => ts.map((t2, i) => (i === idx ? { ...t2, pct: Number(pct) } : t2)))
  }

  async function handleGenerate() {
    setError(null)
    setSuccess(null)
    if (!expenseAccountId || !contraAccountId) { setError(t('penyesuaian.errAccountsRequired')); return }
    if (!adjustmentNeeded) { setError(t('penyesuaian.errNoAdjustmentNeeded')); return }
    setSaving(true)
    const amount = Math.abs(adjustmentNeeded)
    const lines = adjustmentNeeded > 0
      ? [{ account_id: expenseAccountId, debit: amount, credit: 0 }, { account_id: contraAccountId, debit: 0, credit: amount }]
      : [{ account_id: contraAccountId, debit: amount, credit: 0 }, { account_id: expenseAccountId, debit: 0, credit: amount }]
    const { error } = await supabase.rpc('create_transaction', {
      p_company_id: companyId,
      p_date: new Date().toISOString(),
      p_type: 'penyesuaian',
      p_note: note.trim(),
      p_contact_id: null,
      p_lines: lines,
      p_cost_center_id: null,
      p_department_id: null,
      p_project_id: null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(t('penyesuaian.badDebtSuccess'))
    loadBalance()
  }

  return (
    <div>
      <p className="hint" style={{ marginBottom: 14 }}>{t('penyesuaian.badDebtExplain')}</p>

      <table className="tbl" style={{ marginBottom: 16 }}>
        <thead><tr><th>{t('penyesuaian.agingBucket')}</th><th className="num">{t('penyesuaian.agingTotal')}</th><th>{t('penyesuaian.agingPct')}</th><th className="num">{t('penyesuaian.agingProvision')}</th></tr></thead>
        <tbody>
          {aging.map((a, i) => (
            <tr key={a.label}>
              <td>{t('penyesuaian.agingDays', { range: a.label })}</td>
              <td className="num">{a.total.toLocaleString('id-ID')}</td>
              <td>
                <input type="number" min="0" max="100" step="0.5" value={a.pct} disabled={!canEdit}
                  onChange={(e) => updateTierPct(i, e.target.value)} style={{ width: 70 }} /> %
              </td>
              <td className="num">{a.provision.toLocaleString('id-ID')}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={3}>{t('penyesuaian.totalProvisionTarget')}</td>
            <td className="num">{totalProvisionTarget.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>

      {canEdit && (
        <div className="section inline-form">
          <div className="field">
            <label>{t('penyesuaian.badDebtExpenseAccount')}</label>
            <select value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('penyesuaian.badDebtContraAccount')}</label>
            <select value={contraAccountId} onChange={(e) => setContraAccountId(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>{t('transaksi.note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {contraAccountId && (
            <p className="hint" style={{ flexBasis: '100%' }}>
              {t('penyesuaian.currentBalanceHint', { balance: currentBalance.toLocaleString('id-ID') })}
              {' '}{t('penyesuaian.adjustmentNeededHint', { amount: adjustmentNeeded.toLocaleString('id-ID') })}
            </p>
          )}
          {error && <p className="error" style={{ flexBasis: '100%' }}>{error}</p>}
          {success && <p style={{ flexBasis: '100%', color: 'var(--positive)', fontSize: 13 }}>{success}</p>}
          <button className="btn-primary" disabled={saving || !adjustmentNeeded} onClick={handleGenerate}>
            <Calculator size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
            {saving ? t('common.saving') : t('penyesuaian.generateAdjustment')}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SECTION C: Penyusutan Nilai Persediaan (Dagang & Manufaktur)
// ============================================================================
function WritedownSection({ companyId, canEdit, accounts, t }) {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState({}) // { productId: pctOrAmount }
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [inventoryAccountId, setInventoryAccountId] = useState('')
  const [note, setNote] = useState(t('penyesuaian.writedownDefaultNote'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, unit, qty_on_hand, avg_unit_cost')
      .eq('company_id', companyId)
      .gt('qty_on_hand', 0)
      .order('name')
    if (error) { setError(error.message); return }
    setProducts(data || [])
  }

  function toggleSelect(id) {
    setSelected((s) => {
      const copy = { ...s }
      if (copy[id] !== undefined) delete copy[id]
      else copy[id] = 100
      return copy
    })
  }

  function setPct(id, pct) {
    setSelected((s) => ({ ...s, [id]: Number(pct) }))
  }

  function rowValue(p) { return Number(p.qty_on_hand) * Number(p.avg_unit_cost || 0) }
  function rowWritedown(p) {
    const pct = selected[p.id]
    if (pct === undefined) return 0
    return Math.round(rowValue(p) * pct / 100)
  }
  const totalWritedown = products.reduce((s, p) => s + rowWritedown(p), 0)

  async function handleGenerate() {
    setError(null)
    setSuccess(null)
    if (!expenseAccountId || !inventoryAccountId) { setError(t('penyesuaian.errAccountsRequired')); return }
    if (!totalWritedown) { setError(t('penyesuaian.errNoProductSelected')); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_transaction', {
      p_company_id: companyId,
      p_date: new Date().toISOString(),
      p_type: 'penyesuaian',
      p_note: note.trim(),
      p_contact_id: null,
      p_lines: [
        { account_id: expenseAccountId, debit: totalWritedown, credit: 0 },
        { account_id: inventoryAccountId, debit: 0, credit: totalWritedown },
      ],
      p_cost_center_id: null,
      p_department_id: null,
      p_project_id: null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(t('penyesuaian.writedownSuccess'))
    setSelected({})
  }

  return (
    <div>
      <p className="hint" style={{ marginBottom: 14 }}>{t('penyesuaian.writedownExplain')}</p>

      <table className="tbl" style={{ marginBottom: 16 }}>
        <thead>
          <tr><th></th><th>{t('penyesuaian.colProduct')}</th><th className="num">{t('penyesuaian.colQty')}</th>
            <th className="num">{t('penyesuaian.colValue')}</th><th>{t('penyesuaian.colWritedownPct')}</th>
            <th className="num">{t('penyesuaian.colWritedownAmount')}</th></tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td><input type="checkbox" checked={selected[p.id] !== undefined} onChange={() => toggleSelect(p.id)} disabled={!canEdit} /></td>
              <td><Package size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{p.name} ({p.code})</td>
              <td className="num">{Number(p.qty_on_hand).toLocaleString('id-ID')} {p.unit}</td>
              <td className="num">{rowValue(p).toLocaleString('id-ID')}</td>
              <td>
                {selected[p.id] !== undefined && (
                  <><input type="number" min="0" max="100" step="1" value={selected[p.id]} disabled={!canEdit}
                    onChange={(e) => setPct(p.id, e.target.value)} style={{ width: 60 }} /> %</>
                )}
              </td>
              <td className="num">{rowWritedown(p).toLocaleString('id-ID')}</td>
            </tr>
          ))}
          {!products.length && <tr><td colSpan={6} className="empty">{t('penyesuaian.noProducts')}</td></tr>}
          {!!products.length && (
            <tr style={{ fontWeight: 600 }}>
              <td colSpan={5}>{t('penyesuaian.totalWritedown')}</td>
              <td className="num">{totalWritedown.toLocaleString('id-ID')}</td>
            </tr>
          )}
        </tbody>
      </table>

      {canEdit && (
        <div className="section inline-form">
          <div className="field">
            <label>{t('penyesuaian.writedownExpenseAccount')}</label>
            <select value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('penyesuaian.writedownInventoryAccount')}</label>
            <select value={inventoryAccountId} onChange={(e) => setInventoryAccountId(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>{t('transaksi.note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="error" style={{ flexBasis: '100%' }}>{error}</p>}
          {success && <p style={{ flexBasis: '100%', color: 'var(--positive)', fontSize: 13 }}>{success}</p>}
          <button className="btn-primary" disabled={saving || !totalWritedown} onClick={handleGenerate}>
            {saving ? t('common.saving') : t('penyesuaian.generateAdjustment')}
          </button>
        </div>
      )}
    </div>
  )
}
