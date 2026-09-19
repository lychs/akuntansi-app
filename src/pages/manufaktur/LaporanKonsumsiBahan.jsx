import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import { DateRangeField } from '../../components/DateField.jsx'

export default function LaporanKonsumsiBahan() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10) }
  })
  const [rows, setRows] = useState([])

  useEffect(() => { load() }, [companyId, period])

  async function load() {
    const { data } = await supabase
      .from('material_issue_items')
      .select('qty, total_cost, products(name, code, unit), material_issues!inner(date, company_id, production_order_id, production_orders(order_number))')
      .eq('material_issues.company_id', companyId)
      .gte('material_issues.date', period.start).lte('material_issues.date', period.end)

    const grouped = {}
    for (const r of (data || [])) {
      const key = r.products?.code || 'unknown'
      if (!grouped[key]) grouped[key] = { name: r.products?.name, code: r.products?.code, unit: r.products?.unit, totalQty: 0, totalCost: 0, orderCount: new Set() }
      grouped[key].totalQty += Number(r.qty)
      grouped[key].totalCost += Number(r.total_cost)
      grouped[key].orderCount.add(r.material_issues?.production_order_id)
    }
    setRows(Object.values(grouped).map((g) => ({ ...g, orderCount: g.orderCount.size })).sort((a, b) => b.totalCost - a.totalCost))
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)
  const grandTotal = rows.reduce((s, r) => s + r.totalCost, 0)

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('laporanKonsumsiBahan.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('laporanKonsumsiBahan.pageHint')}</p>
      <div style={{ marginBottom: 16 }}><DateRangeField value={period} onChange={setPeriod} /></div>

      <table className="tbl">
        <thead>
          <tr><th>{t('bom.component')}</th><th className="num">{t('laporanKonsumsiBahan.totalQty')}</th><th className="num">{t('laporanKonsumsiBahan.orderCount')}</th><th className="num">{t('laporanKonsumsiBahan.totalCost')}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}><td>{r.name} ({r.code})</td><td className="num">{fmt(r.totalQty)} {r.unit}</td><td className="num">{r.orderCount}</td><td className="num">{fmt(r.totalCost)}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr className="subtotal-row"><td colSpan={3}>{t('laporanProduksi.grandTotal')}</td><td className="num">{fmt(grandTotal)}</td></tr></tfoot>}
      </table>
    </div>
  )
}
