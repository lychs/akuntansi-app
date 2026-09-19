import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { DateRangeField } from '../../components/DateField.jsx'

export default function LaporanProduksi() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10) }
  })
  const [status, setStatus] = useState('all')
  const [orders, setOrders] = useState([])
  const [goodQtyMap, setGoodQtyMap] = useState({})

  useEffect(() => { load() }, [companyId, period])

  async function load() {
    const { data } = await supabase
      .from('production_orders')
      .select('id, order_number, date, planned_qty, status, accumulated_material_cost, accumulated_labor_cost, accumulated_overhead_cost, products(name, code), cost_centers(name)')
      .eq('company_id', companyId)
      .gte('date', period.start).lte('date', period.end)
      .order('date', { ascending: false })
    setOrders(data || [])

    const { data: results } = await supabase.from('production_results').select('production_order_id, good_qty')
    const map = {}
    for (const r of (results || [])) map[r.production_order_id] = (map[r.production_order_id] || 0) + Number(r.good_qty)
    setGoodQtyMap(map)
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)
  const filtered = status === 'all' ? orders : orders.filter((o) => o.status === status)
  const grandTotal = filtered.reduce((s, o) => s + Number(o.accumulated_material_cost) + Number(o.accumulated_labor_cost) + Number(o.accumulated_overhead_cost), 0)

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('laporanProduksi.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('laporanProduksi.pageHint')}</p>

      <div className="txn-form-row" style={{ marginBottom: 16 }}>
        <DateRangeField value={period} onChange={setPeriod} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">{t('laporanProduksi.allStatus')}</option>
          <option value="draft">{t('productionOrder.status_draft')}</option>
          <option value="released">{t('productionOrder.status_released')}</option>
          <option value="in_progress">{t('productionOrder.status_in_progress')}</option>
          <option value="completed">{t('productionOrder.status_completed')}</option>
          <option value="cancelled">{t('productionOrder.status_cancelled')}</option>
        </select>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>{t('productionOrder.colNumber')}</th><th>{t('laporanTransaksi.colDate')}</th><th>{t('productionOrder.colProduct')}</th>
            <th>{t('costCenter.name')}</th><th>{t('hutangPiutang.colStatus')}</th>
            <th className="num">{t('productionOrder.plannedQty')}</th><th className="num">{t('productionOrder.goodQty')}</th>
            <th className="num">{t('productionOrder.materialCost')}</th><th className="num">{t('productionOrder.laborCost')}</th>
            <th className="num">{t('productionOrder.overheadCost')}</th><th className="num">{t('productionOrder.totalWip')}</th>
            <th className="num">{t('productionOrder.costPerUnit')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => {
            const total = Number(o.accumulated_material_cost) + Number(o.accumulated_labor_cost) + Number(o.accumulated_overhead_cost)
            const good = goodQtyMap[o.id] || 0
            return (
              <tr key={o.id}>
                <td><Link to={`/manufaktur/production-order/${o.id}`}>{o.order_number}</Link></td>
                <td>{o.date}</td><td>{o.products?.name}</td><td>{o.cost_centers?.name || '-'}</td>
                <td>{t(`productionOrder.status_${o.status}`)}</td>
                <td className="num">{o.planned_qty}</td><td className="num">{good}</td>
                <td className="num">{fmt(o.accumulated_material_cost)}</td><td className="num">{fmt(o.accumulated_labor_cost)}</td>
                <td className="num">{fmt(o.accumulated_overhead_cost)}</td><td className="num">{fmt(total)}</td>
                <td className="num">{good > 0 ? fmt(total / good) : '-'}</td>
              </tr>
            )
          })}
          {!filtered.length && <tr><td colSpan={12} className="empty">{t('productionOrder.noData')}</td></tr>}
        </tbody>
        {filtered.length > 0 && (
          <tfoot><tr className="subtotal-row"><td colSpan={10}>{t('laporanProduksi.grandTotal')}</td><td className="num">{fmt(grandTotal)}</td><td></td></tr></tfoot>
        )}
      </table>
    </div>
  )
}
