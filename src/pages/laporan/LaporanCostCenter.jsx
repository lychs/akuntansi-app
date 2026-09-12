import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import { fmt } from '../../lib/reportHelpers.js'

export default function LaporanCostCenter() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period.start, period.end])

  async function load() {
    const { data, error } = await supabase.rpc('get_cost_center_summary', {
      p_company_id: companyId, p_start: period.start, p_end: period.end,
    })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  const exportRows = rows.map((r) => ({
    code: r.code, name: r.name, revenue: Number(r.total_pendapatan), expense: Number(r.total_beban), net: Number(r.net), count: r.jumlah_transaksi,
  }))
  const exportConfig = {
    companyName,
    titleId: tid('laporanCostCenter.title'), titleEn: ten('laporanCostCenter.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: [
      { key: 'code', headerId: tid('costCenter.colCode'), headerEn: ten('costCenter.colCode'), align: 'left' },
      { key: 'name', headerId: tid('costCenter.colName'), headerEn: ten('costCenter.colName'), align: 'left' },
      { key: 'revenue', headerId: tid('laporanCostCenter.colRevenue'), headerEn: ten('laporanCostCenter.colRevenue'), align: 'right' },
      { key: 'expense', headerId: tid('laporanCostCenter.colExpense'), headerEn: ten('laporanCostCenter.colExpense'), align: 'right' },
      { key: 'net', headerId: tid('laporanCostCenter.colNet'), headerEn: ten('laporanCostCenter.colNet'), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `laporan-cost-center_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('laporanCostCenter.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <p className="hint" style={{ marginBottom: 16 }}>{t('laporanCostCenter.pageHint')}</p>
        <div className="filters"><PeriodFilter {...period} /></div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('costCenter.colCode')}</th><th>{t('costCenter.colName')}</th>
              <th className="num">{t('laporanCostCenter.colRevenue')}</th>
              <th className="num">{t('laporanCostCenter.colExpense')}</th>
              <th className="num">{t('laporanCostCenter.colNet')}</th>
              <th className="num">{t('laporanCostCenter.colCount')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cost_center_id}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td className="num">{fmt(r.total_pendapatan)}</td>
                <td className="num">{fmt(r.total_beban)}</td>
                <td className="num" style={{ color: Number(r.net) >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 700 }}>{fmt(r.net)}</td>
                <td className="num">{r.jumlah_transaksi}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="empty">{t('laporanCostCenter.noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
