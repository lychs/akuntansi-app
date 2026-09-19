import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { DateRangeField } from '../../components/DateField.jsx'

export default function LaporanTenagaKerja() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10) }
  })
  const [labors, setLabors] = useState([])

  useEffect(() => { load() }, [companyId, period])

  async function load() {
    const { data } = await supabase
      .from('manufacturing_direct_labor')
      .select('id, date, amount, note, production_orders(id, order_number, products(name))')
      .eq('company_id', companyId)
      .gte('date', period.start).lte('date', period.end)
      .order('date', { ascending: false })
    setLabors(data || [])
  }

  const fmt = (n) => Number(n || 0).toLocaleString(i18n.language)
  const total = labors.reduce((s, l) => s + Number(l.amount), 0)

  const byOrder = {}
  for (const l of labors) {
    const key = l.production_orders?.order_number || '-'
    byOrder[key] = (byOrder[key] || 0) + Number(l.amount)
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('laporanTenagaKerja.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('laporanTenagaKerja.pageHint')}</p>
      <div style={{ marginBottom: 20 }}><DateRangeField value={period} onChange={setPeriod} /></div>

      <div className="settings-card" style={{ padding: 16, marginBottom: 20, maxWidth: 280 }}>
        <div className="hint">{t('laporanTenagaKerja.totalLabor')}</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(total)}</div>
      </div>

      <h4>{t('laporanTenagaKerja.perOrder')}</h4>
      <table className="tbl" style={{ marginBottom: 24 }}>
        <thead><tr><th>{t('productionOrder.colNumber')}</th><th className="num">{t('productionOrder.amount')}</th></tr></thead>
        <tbody>
          {Object.entries(byOrder).map(([num, amt]) => <tr key={num}><td>{num}</td><td className="num">{fmt(amt)}</td></tr>)}
          {!Object.keys(byOrder).length && <tr><td colSpan={2} className="empty">{t('laporanKonsumsiBahan.noData')}</td></tr>}
        </tbody>
      </table>

      <h4>{t('laporanTenagaKerja.detail')}</h4>
      <table className="tbl">
        <thead><tr><th>{t('laporanTransaksi.colDate')}</th><th>{t('productionOrder.colNumber')}</th><th>{t('productionOrder.colProduct')}</th><th>{t('transaksi.note')}</th><th className="num">{t('productionOrder.amount')}</th></tr></thead>
        <tbody>
          {labors.map((l) => (
            <tr key={l.id}>
              <td>{l.date}</td>
              <td>{l.production_orders && <Link to={`/manufaktur/production-order/${l.production_orders.id}`}>{l.production_orders.order_number}</Link>}</td>
              <td>{l.production_orders?.products?.name}</td><td>{l.note}</td><td className="num">{fmt(l.amount)}</td>
            </tr>
          ))}
          {!labors.length && <tr><td colSpan={5} className="empty">{t('laporanTenagaKerja.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
