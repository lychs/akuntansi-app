import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { DateRangeField } from '../../components/DateField.jsx'
import CurrencyInput from '../../components/CurrencyInput.jsx'

export default function LaporanBiayaProduksi() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10) }
  })
  const [labors, setLabors] = useState([])
  const [overheads, setOverheads] = useState([])
  const [actualOverheads, setActualOverheads] = useState([])
  const [variances, setVariances] = useState([])
  const [costPerProduct, setCostPerProduct] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showActualForm, setShowActualForm] = useState(false)
  const [actualDate, setActualDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [actualOverheadAccount, setActualOverheadAccount] = useState('')
  const [actualPaymentAccount, setActualPaymentAccount] = useState('')
  const [actualAmount, setActualAmount] = useState(0)
  const [actualNote, setActualNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period])

  async function load() {
    const { data: laborData } = await supabase.from('manufacturing_direct_labor').select('amount, production_orders(order_number, products(name))').eq('company_id', companyId).gte('date', period.start).lte('date', period.end)
    setLabors(laborData || [])

    const { data: ohData } = await supabase.from('manufacturing_overheads').select('applied_amount, accounts(name), production_orders(order_number)').eq('company_id', companyId).gte('date', period.start).lte('date', period.end)
    setOverheads(ohData || [])

    const { data: actualOhData } = await supabase.from('manufacturing_actual_overheads').select('id, date, amount, note, accounts:overhead_account_id(name)').eq('company_id', companyId).gte('date', period.start).lte('date', period.end).order('date', { ascending: false })
    setActualOverheads(actualOhData || [])

    const { data: varData } = await supabase.from('manufacturing_variances').select('amount, variance_type, production_orders(order_number, products(name))').eq('company_id', companyId).gte('date', period.start).lte('date', period.end)
    setVariances(varData || [])

    const { data: results } = await supabase.from('production_results').select('good_qty, total_wip_cost_absorbed, production_orders(products(name, code))').eq('company_id', companyId).gte('date', period.start).lte('date', period.end)
    const grouped = {}
    for (const r of (results || [])) {
      const key = r.production_orders?.products?.code || 'unknown'
      if (!grouped[key]) grouped[key] = { name: r.production_orders?.products?.name, totalQty: 0, totalCost: 0 }
      grouped[key].totalQty += Number(r.good_qty)
      grouped[key].totalCost += Number(r.total_wip_cost_absorbed)
    }
    setCostPerProduct(Object.values(grouped))

    const { data: accData } = await supabase.from('accounts').select('id, code, name').eq('company_id', companyId).order('code')
    setAccounts(accData || [])
  }

  async function handleSaveActual(e) {
    e.preventDefault()
    setError(null); setSaving(true)
    const { error } = await supabase.rpc('record_actual_overhead', {
      p_company_id: companyId, p_date: actualDate, p_overhead_account_id: actualOverheadAccount,
      p_payment_account_id: actualPaymentAccount, p_amount: Number(actualAmount), p_note: actualNote || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setActualAmount(0); setActualNote(''); setShowActualForm(false)
    load()
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)
  const totalLabor = labors.reduce((s, l) => s + Number(l.amount), 0)
  const totalAppliedOverhead = overheads.reduce((s, o) => s + Number(o.applied_amount), 0)
  const totalActualOverhead = actualOverheads.reduce((s, o) => s + Number(o.amount), 0)
  const overheadVariance = totalActualOverhead - totalAppliedOverhead
  const totalVariance = variances.reduce((s, v) => s + Number(v.amount), 0)

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('laporanBiayaProduksi.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('laporanBiayaProduksi.pageHint')}</p>
      <div style={{ marginBottom: 20 }}><DateRangeField value={period} onChange={setPeriod} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('productionOrder.laborCost')}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalLabor)}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('productionOrder.overheadCost')}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalAppliedOverhead)}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanBiayaProduksi.totalVariance')}</div><div style={{ fontSize: 18, fontWeight: 700, color: totalVariance > 0 ? 'var(--negative)' : 'var(--positive)' }}>{fmt(totalVariance)}</div></div>
      </div>

      <h4>{t('laporanBiayaProduksi.costPerProduct')}</h4>
      <table className="tbl" style={{ marginBottom: 24 }}>
        <thead><tr><th>{t('productionOrder.colProduct')}</th><th className="num">{t('productionOrder.goodQty')}</th><th className="num">{t('laporanKonsumsiBahan.totalCost')}</th><th className="num">{t('productionOrder.costPerUnit')}</th></tr></thead>
        <tbody>
          {costPerProduct.map((c, i) => <tr key={i}><td>{c.name}</td><td className="num">{c.totalQty}</td><td className="num">{fmt(c.totalCost)}</td><td className="num">{c.totalQty > 0 ? fmt(c.totalCost / c.totalQty) : '-'}</td></tr>)}
          {!costPerProduct.length && <tr><td colSpan={4} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
      </table>

      <h4>{t('productionOrder.tab_overhead')}</h4>
      <table className="tbl" style={{ marginBottom: 24 }}>
        <thead><tr><th>{t('productionOrder.colNumber')}</th><th>{t('productionOrder.overheadAccount')}</th><th className="num">{t('productionOrder.amount')}</th></tr></thead>
        <tbody>
          {overheads.map((o, i) => <tr key={i}><td>{o.production_orders?.order_number}</td><td>{o.accounts?.name}</td><td className="num">{fmt(o.applied_amount)}</td></tr>)}
          {!overheads.length && <tr><td colSpan={3} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
      </table>

      <div className="page-header" style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>{t('laporanBiayaProduksi.overheadVarianceTitle')}</h4>
        <button className="btn-secondary" onClick={() => setShowActualForm(!showActualForm)}>
          <Plus size={13} style={{ verticalAlign: -2 }} /> {t('laporanBiayaProduksi.recordActualOverhead')}
        </button>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>{t('laporanBiayaProduksi.overheadVarianceHint')}</p>

      {showActualForm && (
        <form className="section inline-form" onSubmit={handleSaveActual}>
          <div className="field"><label>{t('laporanTransaksi.colDate')}</label><input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} required /></div>
          <div className="field">
            <label>{t('laporanBiayaProduksi.overheadAccountActual')}</label>
            <select value={actualOverheadAccount} onChange={(e) => setActualOverheadAccount(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('laporanBiayaProduksi.paymentAccount')}</label>
            <select value={actualPaymentAccount} onChange={(e) => setActualPaymentAccount(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field"><label>{t('productionOrder.amount')}</label><CurrencyInput value={actualAmount} onChange={setActualAmount} /></div>
          <div className="field" style={{ flex: 1 }}><label>{t('transaksi.note')}</label><input value={actualNote} onChange={(e) => setActualNote(e.target.value)} /></div>
          <button className="btn-primary" disabled={saving}>{saving ? t('transaksi.saving') : t('costCenter.save')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanBiayaProduksi.appliedOverhead')}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(totalAppliedOverhead)}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanBiayaProduksi.actualOverhead')}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(totalActualOverhead)}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanBiayaProduksi.overheadVarianceLabel')}</div><div style={{ fontSize: 16, fontWeight: 700, color: overheadVariance > 0 ? 'var(--negative)' : 'var(--positive)' }}>{fmt(overheadVariance)}</div></div>
      </div>

      <table className="tbl" style={{ marginBottom: 24 }}>
        <thead><tr><th>{t('laporanTransaksi.colDate')}</th><th>{t('laporanBiayaProduksi.overheadAccountActual')}</th><th>{t('transaksi.note')}</th><th className="num">{t('productionOrder.amount')}</th></tr></thead>
        <tbody>
          {actualOverheads.map((o) => <tr key={o.id}><td>{o.date}</td><td>{o.accounts?.name}</td><td>{o.note}</td><td className="num">{fmt(o.amount)}</td></tr>)}
          {!actualOverheads.length && <tr><td colSpan={4} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
      </table>

      <h4>{t('laporanBiayaProduksi.varianceDetail')}</h4>
      <table className="tbl">
        <thead><tr><th>{t('productionOrder.colNumber')}</th><th>{t('productionOrder.colProduct')}</th><th className="num">{t('productionOrder.amount')}</th></tr></thead>
        <tbody>
          {variances.map((v, i) => <tr key={i}><td>{v.production_orders?.order_number}</td><td>{v.production_orders?.products?.name}</td><td className="num">{fmt(v.amount)}</td></tr>)}
          {!variances.length && <tr><td colSpan={3} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
