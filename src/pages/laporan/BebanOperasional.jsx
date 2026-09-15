import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

export default function BebanOperasional() {
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
    setRows((data || []).filter((r) => r.category === 'beban_operasional' && (Number(r.total_debit) || Number(r.total_credit))))
  }

  const total = rows.reduce((s, r) => s + Number(r.total_debit) - Number(r.total_credit), 0)

  const exportRows = [
    ...rows.map((r) => ({ code: r.account_code, name: r.account_name, amount: Number(r.total_debit) - Number(r.total_credit) })),
    { code: '', name: `${tid('bebanOperasional.total')} / ${ten('bebanOperasional.total')}`, amount: total, _rowType: 'total' },
  ]
  const exportConfig = {
    companyName,
    titleId: tid('bebanOperasional.title'), titleEn: ten('bebanOperasional.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: [
      { key: 'code', headerId: tid('bebanOperasional.colCode'), headerEn: ten('bebanOperasional.colCode'), align: 'left' },
      { key: 'name', headerId: tid('bebanOperasional.colAccountName'), headerEn: ten('bebanOperasional.colAccountName'), align: 'left' },
      { key: 'amount', headerId: tid('bebanOperasional.colAmount'), headerEn: ten('bebanOperasional.colAmount'), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `beban-operasional_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('bebanOperasional.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <PeriodFilter {...period} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead><tr><th>{t('bebanOperasional.colCode')}</th><th>{t('bebanOperasional.colAccountName')}</th><th className="num">{t('bebanOperasional.colAmount')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account_id}>
                <td>{r.account_code}</td>
                <td>{r.account_name}</td>
                <td className="num">{(Number(r.total_debit) - Number(r.total_credit)).toLocaleString(i18n.language)}</td>
              </tr>
            ))}
            <tr className="total-row"><td colSpan={2}>{t('bebanOperasional.total')}</td><td className="num">{total.toLocaleString(i18n.language)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
