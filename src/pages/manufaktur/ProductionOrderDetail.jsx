import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, PlayCircle, CheckCircle2, XCircle, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField } from '../../components/DateField.jsx'

const TABS = ['overview', 'materials', 'labor', 'overhead', 'result']
const STATUS_BADGE = { draft: 'pending', released: 'pending', in_progress: 'pending', completed: 'lunas', cancelled: 'overdue' }

export default function ProductionOrderDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()

  const [po, setPo] = useState(null)
  const [bomItems, setBomItems] = useState([])
  const [materialRequest, setMaterialRequest] = useState(null)
  const [issues, setIssues] = useState([])
  const [labors, setLabors] = useState([])
  const [overheads, setOverheads] = useState([])
  const [results, setResults] = useState([])
  const [accounts, setAccounts] = useState([])
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: poData } = await supabase.from('production_orders')
      .select('*, products(name, code), cost_centers(name), warehouses(name), manufacturing_boms(version)')
      .eq('id', id).maybeSingle()
    setPo(poData)
    if (!poData) return

    const { data: bomData } = await supabase.from('manufacturing_bom_items')
      .select('id, qty_per_unit, waste_percentage, products(name, code, unit)')
      .eq('bom_id', poData.bom_id)
    setBomItems(bomData || [])

    const { data: mr } = await supabase.from('material_requests').select('id, material_request_items(id, product_id, qty_needed, qty_issued, products(name, code, unit))').eq('production_order_id', id).maybeSingle()
    setMaterialRequest(mr)

    const { data: issueData } = await supabase.from('material_issues').select('id, date, note, material_issue_items(product_id, qty, unit_cost, total_cost, products(name, unit))').eq('production_order_id', id).order('date')
    setIssues(issueData || [])

    const { data: laborData } = await supabase.from('manufacturing_direct_labor').select('*').eq('production_order_id', id).order('date')
    setLabors(laborData || [])

    const { data: ohData } = await supabase.from('manufacturing_overheads').select('*, accounts(name)').eq('production_order_id', id).order('date')
    setOverheads(ohData || [])

    const { data: resultData } = await supabase.from('production_results').select('*').eq('production_order_id', id).order('date')
    setResults(resultData || [])

    const { data: accData } = await supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).order('code')
    setAccounts(accData || [])
  }

  async function handleRelease() {
    setActionLoading(true); setError(null)
    const { error } = await supabase.rpc('release_production_order', { p_production_order_id: id })
    setActionLoading(false)
    if (error) { setError(error.message); return }
    load()
  }
  async function handleComplete() {
    if (!confirm(t('productionOrder.confirmComplete'))) return
    setActionLoading(true); setError(null)
    const { error } = await supabase.rpc('complete_production_order', { p_production_order_id: id })
    setActionLoading(false)
    if (error) { setError(error.message); return }
    load()
  }
  async function handleCancel() {
    if (!confirm(t('productionOrder.confirmCancel'))) return
    setActionLoading(true); setError(null)
    const { error } = await supabase.rpc('cancel_production_order', { p_production_order_id: id })
    setActionLoading(false)
    if (error) { setError(error.message); return }
    load()
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)
  const totalWip = po ? Number(po.accumulated_material_cost) + Number(po.accumulated_labor_cost) + Number(po.accumulated_overhead_cost) : 0

  if (!po) return <div className="p-6"><p className="hint">{t('common.loading')}</p></div>

  return (
    <div className="p-6">
      <Link to="/manufaktur/production-order" className="hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        <ArrowLeft size={13} /> {t('productionOrder.title')}
      </Link>
      <div className="page-header">
        <div>
          <h1>{po.order_number} <span className={`badge ${STATUS_BADGE[po.status]}`} style={{ marginLeft: 10 }}>{t(`productionOrder.status_${po.status}`)}</span></h1>
          <p className="hint">{po.products?.name} · {t('productionOrder.plannedQty')}: {po.planned_qty} · {po.cost_centers?.name || '-'} · BOM v{po.manufacturing_boms?.version}</p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            {po.status === 'draft' && <button className="btn-primary" onClick={handleRelease} disabled={actionLoading}><PlayCircle size={14} style={{ verticalAlign: -2 }} /> {t('productionOrder.release')}</button>}
            {['released', 'in_progress'].includes(po.status) && <button className="btn-primary" onClick={handleComplete} disabled={actionLoading}><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> {t('productionOrder.complete')}</button>}
            {po.status === 'draft' && <button className="btn-secondary" onClick={handleCancel} disabled={actionLoading}><XCircle size={14} style={{ verticalAlign: -2 }} /> {t('productionOrder.cancel')}</button>}
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="settings-card" style={{ padding: 14 }}>
          <div className="hint" style={{ marginBottom: 4 }}>{t('productionOrder.materialCost')}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(po.accumulated_material_cost)}</div>
        </div>
        <div className="settings-card" style={{ padding: 14 }}>
          <div className="hint" style={{ marginBottom: 4 }}>{t('productionOrder.laborCost')}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(po.accumulated_labor_cost)}</div>
        </div>
        <div className="settings-card" style={{ padding: 14 }}>
          <div className="hint" style={{ marginBottom: 4 }}>{t('productionOrder.overheadCost')}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(po.accumulated_overhead_cost)}</div>
        </div>
        <div className="settings-card" style={{ padding: 14 }}>
          <div className="hint" style={{ marginBottom: 4 }}>{t('productionOrder.totalWip')}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}>{fmt(totalWip)}</div>
        </div>
      </div>

      <div className="tab-row" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {TABS.map((tb) => (
          <button key={tb} className={`tab-btn ${tab === tb ? 'active' : ''}`} onClick={() => setTab(tb)}
            style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: tab === tb ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', fontWeight: tab === tb ? 700 : 500, color: tab === tb ? 'var(--brand)' : 'var(--ink-muted)' }}>
            {t(`productionOrder.tab_${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <h4>{t('bom.components')}</h4>
          <table className="tbl">
            <thead><tr><th>{t('bom.component')}</th><th className="num">{t('bom.qtyPerUnit')}</th><th className="num">{t('productionOrder.totalNeeded')}</th></tr></thead>
            <tbody>
              {bomItems.map((it) => (
                <tr key={it.id}>
                  <td>{it.products?.name}</td>
                  <td className="num">{it.qty_per_unit} {it.products?.unit}</td>
                  <td className="num">{(it.qty_per_unit * po.planned_qty * (1 + it.waste_percentage / 100)).toLocaleString(i18n.language)} {it.products?.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {materialRequest && (
            <>
              <h4 style={{ marginTop: 24 }}>{t('productionOrder.materialRequestStatus')}</h4>
              <table className="tbl">
                <thead><tr><th>{t('bom.component')}</th><th className="num">{t('productionOrder.needed')}</th><th className="num">{t('productionOrder.issued')}</th></tr></thead>
                <tbody>
                  {materialRequest.material_request_items?.map((it) => (
                    <tr key={it.id}>
                      <td>{it.products?.name}</td>
                      <td className="num">{it.qty_needed} {it.products?.unit}</td>
                      <td className="num">{it.qty_issued} {it.products?.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === 'materials' && (
        <MaterialIssueTab po={po} materialRequest={materialRequest} issues={issues} canEdit={canEdit} onSaved={load} />
      )}
      {tab === 'labor' && (
        <LaborTab po={po} labors={labors} canEdit={canEdit} onSaved={load} fmt={fmt} />
      )}
      {tab === 'overhead' && (
        <OverheadTab po={po} overheads={overheads} accounts={accounts} canEdit={canEdit} onSaved={load} fmt={fmt} />
      )}
      {tab === 'result' && (
        <ResultTab po={po} results={results} canEdit={canEdit} onSaved={load} fmt={fmt} totalWip={totalWip} />
      )}
    </div>
  )
}

function MaterialIssueTab({ po, materialRequest, issues, canEdit, onSaved }) {
  const { t, i18n } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [qtys, setQtys] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const items = materialRequest?.material_request_items || []

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    const payloadLines = items
      .map((it) => ({ product_id: it.product_id, qty: Number(qtys[it.id] || 0) }))
      .filter((l) => l.qty > 0)
    if (!payloadLines.length) { setError(t('productionOrder.errNoQty')); return }

    setSaving(true)
    const { error } = await supabase.rpc('record_material_issue', {
      p_production_order_id: po.id, p_date: new Date(date).toISOString(), p_lines: payloadLines, p_note: note || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setQtys({}); setNote(''); setShowForm(false)
    onSaved()
  }

  return (
    <div>
      {canEdit && ['released', 'in_progress'].includes(po.status) && (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(!showForm)}>
          <Plus size={14} style={{ verticalAlign: -2 }} /> {showForm ? t('costCenter.closeForm') : t('productionOrder.recordMaterialIssue')}
        </button>
      )}
      {showForm && (
        <form className="section inline-form" style={{ flexDirection: 'column', alignItems: 'stretch' }} onSubmit={handleSave}>
          <div className="txn-form-row">
            <div className="field"><label>{t('laporanTransaksi.colDate')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="field" style={{ flex: 1 }}><label>{t('transaksi.note')}</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <table className="tbl">
            <thead><tr><th>{t('bom.component')}</th><th className="num">{t('productionOrder.needed')}</th><th className="num">{t('productionOrder.qtyToIssue')}</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.products?.name}</td>
                  <td className="num">{it.qty_needed - it.qty_issued} {it.products?.unit}</td>
                  <td className="num"><input type="number" step="any" min="0" style={{ width: 110, textAlign: 'right' }} value={qtys[it.id] || ''} onChange={(e) => setQtys({ ...qtys, [it.id]: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" style={{ width: 'fit-content', marginTop: 12 }} disabled={saving}>{saving ? t('transaksi.saving') : t('costCenter.save')}</button>
        </form>
      )}

      <h4>{t('productionOrder.issueHistory')}</h4>
      {issues.map((iss) => (
        <div key={iss.id} className="settings-card" style={{ marginBottom: 10 }}>
          <p className="hint">{iss.date} · {iss.note}</p>
          <table className="tbl" style={{ margin: 0 }}>
            <tbody>
              {iss.material_issue_items.map((li, i) => (
                <tr key={i}><td>{li.products?.name}</td><td className="num">{li.qty} {li.products?.unit}</td><td className="num">{Number(li.total_cost).toLocaleString(i18n.language)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {!issues.length && <p className="hint">{t('productionOrder.noIssueYet')}</p>}
    </div>
  )
}

function LaborTab({ po, labors, canEdit, onSaved, fmt }) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setError(null); setSaving(true)
    const { error } = await supabase.rpc('record_direct_labor', { p_production_order_id: po.id, p_date: date, p_amount: Number(amount), p_note: note || null })
    setSaving(false)
    if (error) { setError(error.message); return }
    setAmount(0); setNote(''); setShowForm(false)
    onSaved()
  }

  return (
    <div>
      {canEdit && ['released', 'in_progress'].includes(po.status) && (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(!showForm)}>
          <Plus size={14} style={{ verticalAlign: -2 }} /> {showForm ? t('costCenter.closeForm') : t('productionOrder.recordLabor')}
        </button>
      )}
      {showForm && (
        <form className="section inline-form" onSubmit={handleSave}>
          <div className="field"><label>{t('laporanTransaksi.colDate')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div className="field"><label>{t('productionOrder.amount')}</label><CurrencyInput value={amount} onChange={setAmount} /></div>
          <div className="field" style={{ flex: 1 }}><label>{t('transaksi.note')}</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn-primary" disabled={saving}>{saving ? t('transaksi.saving') : t('costCenter.save')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <table className="tbl">
        <thead><tr><th>{t('laporanTransaksi.colDate')}</th><th>{t('transaksi.note')}</th><th className="num">{t('productionOrder.amount')}</th></tr></thead>
        <tbody>
          {labors.map((l) => <tr key={l.id}><td>{l.date}</td><td>{l.note}</td><td className="num">{fmt(l.amount)}</td></tr>)}
          {!labors.length && <tr><td colSpan={3} className="empty">{t('productionOrder.noLaborYet')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function OverheadTab({ po, overheads, accounts, canEdit, onSaved, fmt }) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setError(null); setSaving(true)
    const { error } = await supabase.rpc('record_manufacturing_overhead', { p_production_order_id: po.id, p_date: date, p_overhead_source_account_id: accountId, p_amount: Number(amount), p_note: note || null })
    setSaving(false)
    if (error) { setError(error.message); return }
    setAmount(0); setNote(''); setAccountId(''); setShowForm(false)
    onSaved()
  }

  return (
    <div>
      {canEdit && ['released', 'in_progress'].includes(po.status) && (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(!showForm)}>
          <Plus size={14} style={{ verticalAlign: -2 }} /> {showForm ? t('costCenter.closeForm') : t('productionOrder.recordOverhead')}
        </button>
      )}
      {showForm && (
        <form className="section inline-form" onSubmit={handleSave}>
          <div className="field"><label>{t('laporanTransaksi.colDate')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div className="field">
            <label>{t('productionOrder.overheadAccount')}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field"><label>{t('productionOrder.amount')}</label><CurrencyInput value={amount} onChange={setAmount} /></div>
          <div className="field" style={{ flex: 1 }}><label>{t('transaksi.note')}</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn-primary" disabled={saving}>{saving ? t('transaksi.saving') : t('costCenter.save')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <table className="tbl">
        <thead><tr><th>{t('laporanTransaksi.colDate')}</th><th>{t('productionOrder.overheadAccount')}</th><th>{t('transaksi.note')}</th><th className="num">{t('productionOrder.amount')}</th></tr></thead>
        <tbody>
          {overheads.map((o) => <tr key={o.id}><td>{o.date}</td><td>{o.accounts?.name}</td><td>{o.note}</td><td className="num">{fmt(o.applied_amount)}</td></tr>)}
          {!overheads.length && <tr><td colSpan={4} className="empty">{t('productionOrder.noOverheadYet')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function ResultTab({ po, results, canEdit, onSaved, fmt, totalWip }) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [goodQty, setGoodQty] = useState('')
  const [rejectQty, setRejectQty] = useState(0)
  const [scrapQty, setScrapQty] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const alreadyAbsorbed = results.reduce((s, r) => s + Number(r.total_wip_cost_absorbed), 0)

  async function handleSave(e) {
    e.preventDefault()
    setError(null); setSaving(true)
    const { error } = await supabase.rpc('record_production_result', {
      p_production_order_id: po.id, p_date: date, p_good_qty: Number(goodQty || 0), p_reject_qty: Number(rejectQty || 0), p_scrap_qty: Number(scrapQty || 0), p_note: note || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setGoodQty(''); setRejectQty(0); setScrapQty(0); setNote(''); setShowForm(false)
    onSaved()
  }

  return (
    <div>
      <p className="hint" style={{ marginBottom: 12 }}>{t('productionOrder.wipAbsorbedHint', { absorbed: fmt(alreadyAbsorbed), total: fmt(totalWip) })}</p>
      {canEdit && ['released', 'in_progress'].includes(po.status) && (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(!showForm)}>
          <Plus size={14} style={{ verticalAlign: -2 }} /> {showForm ? t('costCenter.closeForm') : t('productionOrder.recordResult')}
        </button>
      )}
      {showForm && (
        <form className="section inline-form" onSubmit={handleSave}>
          <div className="field"><label>{t('laporanTransaksi.colDate')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div className="field"><label>{t('productionOrder.goodQty')}</label><input type="number" step="any" min="0" value={goodQty} onChange={(e) => setGoodQty(e.target.value)} /></div>
          <div className="field"><label>{t('productionOrder.rejectQty')}</label><input type="number" step="any" min="0" value={rejectQty} onChange={(e) => setRejectQty(e.target.value)} /></div>
          <div className="field"><label>{t('productionOrder.scrapQty')}</label><input type="number" step="any" min="0" value={scrapQty} onChange={(e) => setScrapQty(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>{t('transaksi.note')}</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn-primary" disabled={saving}>{saving ? t('transaksi.saving') : t('costCenter.save')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <table className="tbl">
        <thead><tr><th>{t('laporanTransaksi.colDate')}</th><th className="num">{t('productionOrder.goodQty')}</th><th className="num">{t('productionOrder.rejectQty')}</th><th className="num">{t('productionOrder.scrapQty')}</th><th className="num">{t('productionOrder.costPerUnit')}</th><th className="num">{t('productionOrder.totalAbsorbed')}</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}><td>{r.date}</td><td className="num">{r.good_qty}</td><td className="num">{r.reject_qty}</td><td className="num">{r.scrap_qty}</td><td className="num">{fmt(r.cost_per_unit)}</td><td className="num">{fmt(r.total_wip_cost_absorbed)}</td></tr>
          ))}
          {!results.length && <tr><td colSpan={6} className="empty">{t('productionOrder.noResultYet')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
