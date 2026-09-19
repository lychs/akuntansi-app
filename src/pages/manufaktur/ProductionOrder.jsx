import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, Cog } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import CostCenterFilter, { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

const STATUS_BADGE = { draft: 'pending', released: 'pending', in_progress: 'pending', completed: 'lunas', cancelled: 'overdue' }

export default function ProductionOrder() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const cc = useCostCenterFilter(companyId)

  const [orders, setOrders] = useState([])
  const [finishedGoods, setFinishedGoods] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [productId, setProductId] = useState('')
  const [plannedQty, setPlannedQty] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [plannedStart, setPlannedStart] = useState('')
  const [plannedFinish, setPlannedFinish] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data } = await supabase
      .from('production_orders')
      .select('id, order_number, date, planned_qty, status, product_id, products(name, code), cost_centers(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    const { data: products } = await supabase.from('products').select('id, code, name').eq('company_id', companyId).eq('item_type', 'finished_goods').order('name')
    setFinishedGoods(products || [])
    const { data: wh } = await supabase.from('warehouses').select('id, name').eq('company_id', companyId).order('name')
    setWarehouses(wh || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.rpc('create_production_order', {
      p_company_id: companyId, p_date: date, p_cost_center_id: cc.costCenterId || null, p_warehouse_id: warehouseId || null,
      p_product_id: productId, p_planned_qty: Number(plannedQty), p_planned_start_date: plannedStart || null, p_planned_finish_date: plannedFinish || null,
      p_note: note || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setProductId(''); setPlannedQty(''); setNote(''); setShowForm(false)
    load()
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1><Cog size={20} style={{ verticalAlign: -3, marginRight: 8 }} />{t('productionOrder.title')}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <CostCenterFilter {...cc} />
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              <Plus size={15} style={{ verticalAlign: -2, marginRight: 4 }} />{showForm ? t('costCenter.closeForm') : t('productionOrder.newOrder')}
            </button>
          )}
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('productionOrder.pageHint')}</p>
      {!canEdit && <ViewerNotice />}

      {canEdit && showForm && (
        <form className="section inline-form" style={{ flexDirection: 'column', alignItems: 'stretch' }} onSubmit={handleCreate}>
          <div className="txn-form-row">
            <div className="field">
              <label>{t('productionOrder.finishedProduct')}</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">{t('transaksi.select')}</option>
                {finishedGoods.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('productionOrder.plannedQty')}</label>
              <input type="number" step="any" min="0" value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} required />
            </div>
            <div className="field">
              <label>{t('productionOrder.warehouse')}</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">{t('transaksi.select')}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="txn-form-row">
            <div className="field">
              <label>{t('laporanTransaksi.colDate')}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>{t('productionOrder.plannedStart')}</label>
              <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('productionOrder.plannedFinish')}</label>
              <input type="date" value={plannedFinish} onChange={(e) => setPlannedFinish(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('transaksi.note')}</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" style={{ width: 'fit-content', marginTop: 8 }} disabled={saving}>
            {saving ? t('transaksi.saving') : t('costCenter.save')}
          </button>
        </form>
      )}

      <table className="tbl">
        <thead>
          <tr>
            <th>{t('productionOrder.colNumber')}</th><th>{t('laporanTransaksi.colDate')}</th><th>{t('productionOrder.colProduct')}</th>
            <th className="num">{t('productionOrder.colQty')}</th><th>{t('costCenter.name')}</th><th>{t('hutangPiutang.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ cursor: 'pointer' }}>
              <td><Link to={`/manufaktur/production-order/${o.id}`}>{o.order_number}</Link></td>
              <td>{o.date}</td>
              <td>{o.products?.name}</td>
              <td className="num">{o.planned_qty}</td>
              <td>{o.cost_centers?.name || '-'}</td>
              <td><span className={`badge ${STATUS_BADGE[o.status]}`}>{t(`productionOrder.status_${o.status}`)}</span></td>
            </tr>
          ))}
          {!orders.length && <tr><td colSpan={6} className="empty">{t('productionOrder.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
