import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import { DateRangeField } from '../../components/DateField.jsx'

export default function LaporanProfitabilitas() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10) }
  })
  const [rows, setRows] = useState([])

  useEffect(() => { load() }, [companyId, period])

  async function load() {
    // Ambil penjualan barang jadi (produk item_type = finished_goods) di periode ini.
    const { data } = await supabase
      .from('product_movements')
      .select('qty, total_cost, revenue_amount, products!inner(id, name, code, item_type)')
      .eq('company_id', companyId)
      .eq('type', 'out')
      .eq('products.item_type', 'finished_goods')
      .gte('date', period.start).lte('date', period.end)

    const grouped = {}
    for (const r of (data || [])) {
      const key = r.products?.code
      if (!key) continue
      if (!grouped[key]) grouped[key] = { name: r.products?.name, qtySold: 0, revenue: 0, cogs: 0 }
      grouped[key].qtySold += Number(r.qty)
      grouped[key].revenue += Number(r.revenue_amount || 0)
      grouped[key].cogs += Number(r.total_cost)
    }
    setRows(Object.values(grouped).map((g) => ({ ...g, profit: g.revenue - g.cogs, margin: g.revenue > 0 ? ((g.revenue - g.cogs) / g.revenue) * 100 : 0 })))
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0)
  const totalProfit = totalRevenue - totalCogs

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('laporanProfitabilitas.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('laporanProfitabilitas.pageHint')}</p>
      <div style={{ marginBottom: 20 }}><DateRangeField value={period} onChange={setPeriod} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanProfitabilitas.totalRevenue')}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalRevenue)}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanProfitabilitas.totalCogs')}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalCogs)}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanProfitabilitas.totalProfit')}</div><div style={{ fontSize: 18, fontWeight: 700, color: totalProfit >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{fmt(totalProfit)}</div></div>
      </div>

      <table className="tbl">
        <thead>
          <tr><th>{t('productionOrder.colProduct')}</th><th className="num">{t('laporanProfitabilitas.qtySold')}</th><th className="num">{t('laporanProfitabilitas.revenue')}</th><th className="num">{t('laporanProfitabilitas.cogs')}</th><th className="num">{t('laporanProfitabilitas.profit')}</th><th className="num">{t('laporanProfitabilitas.margin')}</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td><td className="num">{r.qtySold}</td><td className="num">{fmt(r.revenue)}</td><td className="num">{fmt(r.cogs)}</td>
              <td className="num" style={{ color: r.profit >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{fmt(r.profit)}</td>
              <td className="num">{r.margin.toFixed(1)}%</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
