import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import { DateRangeField } from '../../components/DateField.jsx'

export default function LaporanRejectScrap() {
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
      .from('production_results')
      .select('date, good_qty, reject_qty, scrap_qty, production_orders(order_number, products(name))')
      .eq('company_id', companyId)
      .gte('date', period.start).lte('date', period.end)
      .order('date', { ascending: false })
    setRows(data || [])
  }

  const totalGood = rows.reduce((s, r) => s + Number(r.good_qty), 0)
  const totalReject = rows.reduce((s, r) => s + Number(r.reject_qty), 0)
  const totalScrap = rows.reduce((s, r) => s + Number(r.scrap_qty), 0)
  const rejectRate = totalGood + totalReject + totalScrap > 0 ? ((totalReject + totalScrap) / (totalGood + totalReject + totalScrap)) * 100 : 0

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('laporanRejectScrap.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('laporanRejectScrap.pageHint')}</p>
      <div style={{ marginBottom: 20 }}><DateRangeField value={period} onChange={setPeriod} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('productionOrder.goodQty')}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{totalGood}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('productionOrder.rejectQty')}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{totalReject}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('productionOrder.scrapQty')}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{totalScrap}</div></div>
        <div className="settings-card" style={{ padding: 14 }}><div className="hint">{t('laporanRejectScrap.rejectRate')}</div><div style={{ fontSize: 18, fontWeight: 700, color: rejectRate > 5 ? 'var(--negative)' : 'var(--positive)' }}>{rejectRate.toFixed(1)}%</div></div>
      </div>

      <table className="tbl">
        <thead><tr><th>{t('laporanTransaksi.colDate')}</th><th>{t('productionOrder.colNumber')}</th><th>{t('productionOrder.colProduct')}</th><th className="num">{t('productionOrder.goodQty')}</th><th className="num">{t('productionOrder.rejectQty')}</th><th className="num">{t('productionOrder.scrapQty')}</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}><td>{r.date}</td><td>{r.production_orders?.order_number}</td><td>{r.production_orders?.products?.name}</td><td className="num">{r.good_qty}</td><td className="num">{r.reject_qty}</td><td className="num">{r.scrap_qty}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
