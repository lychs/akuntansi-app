import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

function netAmount(row) {
  return row.normal_balance === 'kredit'
    ? Number(row.total_credit) - Number(row.total_debit)
    : Number(row.total_debit) - Number(row.total_credit)
}

export default function LabaRugi() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const dim = useDimensionFilters(companyId)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period.start, period.end, dim.depsKey])

  async function load() {
    const { data, error } = await supabase.rpc('get_trial_balance', {
      p_company_id: companyId,
      p_start: period.start,
      p_end: period.end,
      ...dim.rpcParams,
    })
    if (error) { setError(error.message); return }
    setRows((data || []).filter((r) => Number(r.total_debit) || Number(r.total_credit)))
  }

  const groups = {
    pendapatan: rows.filter((r) => r.category === 'pendapatan'),
    beban_pokok: rows.filter((r) => r.category === 'beban_pokok'),
    beban_operasional: rows.filter((r) => r.category === 'beban_operasional'),
  }
  const totalPendapatan = groups.pendapatan.reduce((s, r) => s + netAmount(r), 0)
  const totalBebanPokok = groups.beban_pokok.reduce((s, r) => s + netAmount(r), 0)
  const totalBebanOps = groups.beban_operasional.reduce((s, r) => s + netAmount(r), 0)
  const labaKotor = totalPendapatan - totalBebanPokok
  const labaBersih = labaKotor - totalBebanOps

  function renderGroup(title, list) {
    return (
      <>
        <tr className="subtotal-row"><td colSpan={2}>{title}</td></tr>
        {list.map((r) => (
          <tr key={r.account_id}>
            <td style={{ paddingLeft: 24 }}>{r.account_name}</td>
            <td className="num">{netAmount(r).toLocaleString(i18n.language)}</td>
          </tr>
        ))}
      </>
    )
  }

  function exportGroup(labelId, labelEn, list) {
    return [
      { account: `${labelId} / ${labelEn}`, amount: null, _rowType: 'subtotal' },
      ...list.map((r) => ({ account: r.account_name, amount: netAmount(r) })),
    ]
  }
  const exportRows = [
    ...exportGroup(tid('labaRugi.revenue'), ten('labaRugi.revenue'), groups.pendapatan),
    { account: `${tid('labaRugi.totalRevenue')} / ${ten('labaRugi.totalRevenue')}`, amount: totalPendapatan, _rowType: 'total' },
    ...exportGroup(tid('labaRugi.cogs'), ten('labaRugi.cogs'), groups.beban_pokok),
    { account: `${tid('labaRugi.grossProfit')} / ${ten('labaRugi.grossProfit')}`, amount: labaKotor, _rowType: 'total' },
    ...exportGroup(tid('labaRugi.opex'), ten('labaRugi.opex'), groups.beban_operasional),
    { account: `${tid('labaRugi.netProfit')} / ${ten('labaRugi.netProfit')}`, amount: labaBersih, _rowType: 'total' },
  ]
  const exportConfig = {
    companyName,
    titleId: tid('labaRugi.title'), titleEn: ten('labaRugi.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: [
      { key: 'account', headerId: tid('labaRugi.colAccount'), headerEn: ten('labaRugi.colAccount'), align: 'left' },
      { key: 'amount', headerId: tid('labaRugi.colAmount'), headerEn: ten('labaRugi.colAmount'), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `laba-rugi_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('labaRugi.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <PeriodFilter {...period} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead><tr><th>{t('labaRugi.colAccount')}</th><th className="num">{t('labaRugi.colAmount')}</th></tr></thead>
          <tbody>
            {renderGroup(t('labaRugi.revenue'), groups.pendapatan)}
            <tr className="total-row"><td>{t('labaRugi.totalRevenue')}</td><td className="num">{totalPendapatan.toLocaleString(i18n.language)}</td></tr>
            {renderGroup(t('labaRugi.cogs'), groups.beban_pokok)}
            <tr className="total-row"><td>{t('labaRugi.grossProfit')}</td><td className="num">{labaKotor.toLocaleString(i18n.language)}</td></tr>
            {renderGroup(t('labaRugi.opex'), groups.beban_operasional)}
            <tr className="total-row"><td>{t('labaRugi.netProfit')}</td><td className="num">{labaBersih.toLocaleString(i18n.language)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
