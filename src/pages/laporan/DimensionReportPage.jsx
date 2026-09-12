import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import { fmt } from '../../lib/reportHelpers.js'

// Laporan ringkasan generik dipakai berulang buat Departemen / Proyek /
// Gudang (sama persis strukturnya kayak Laporan per Cabang) — biar gak
// nulis 3x kode yang sama persis.
export default function DimensionReportPage({ rpcName, titleKey, masterKey, fileSlug }) {
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
    const { data, error } = await supabase.rpc(rpcName, {
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
    titleId: tid(`${titleKey}.title`), titleEn: ten(`${titleKey}.title`),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: [
      { key: 'code', headerId: tid(`${masterKey}.colCode`), headerEn: ten(`${masterKey}.colCode`), align: 'left' },
      { key: 'name', headerId: tid(`${masterKey}.colName`), headerEn: ten(`${masterKey}.colName`), align: 'left' },
      { key: 'revenue', headerId: tid(`${titleKey}.colRevenue`), headerEn: ten(`${titleKey}.colRevenue`), align: 'right' },
      { key: 'expense', headerId: tid(`${titleKey}.colExpense`), headerEn: ten(`${titleKey}.colExpense`), align: 'right' },
      { key: 'net', headerId: tid(`${titleKey}.colNet`), headerEn: ten(`${titleKey}.colNet`), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `${fileSlug}_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t(`${titleKey}.title`)}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <p className="hint" style={{ marginBottom: 16 }}>{t(`${titleKey}.pageHint`)}</p>
        <div className="filters"><PeriodFilter {...period} /></div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr>
              <th>{t(`${masterKey}.colCode`)}</th><th>{t(`${masterKey}.colName`)}</th>
              <th className="num">{t(`${titleKey}.colRevenue`)}</th>
              <th className="num">{t(`${titleKey}.colExpense`)}</th>
              <th className="num">{t(`${titleKey}.colNet`)}</th>
              <th className="num">{t(`${titleKey}.colCount`)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dimension_id}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td className="num">{fmt(r.total_pendapatan)}</td>
                <td className="num">{fmt(r.total_beban)}</td>
                <td className="num" style={{ color: Number(r.net) >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 700 }}>{fmt(r.net)}</td>
                <td className="num">{r.jumlah_transaksi}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="empty">{t(`${titleKey}.noData`)}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
