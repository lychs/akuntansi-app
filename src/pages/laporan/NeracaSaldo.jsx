import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

export default function NeracaSaldo() {
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
    setRows(data || [])
  }

  const filteredRows = rows.filter((r) => Number(r.total_debit) || Number(r.total_credit))
  const totalDebit = rows.reduce((s, r) => s + Number(r.total_debit), 0)
  const totalCredit = rows.reduce((s, r) => s + Number(r.total_credit), 0)

  const exportColumns = [
    { key: 'code', headerId: tid('neracaSaldo.colCode'), headerEn: ten('neracaSaldo.colCode'), align: 'left' },
    { key: 'name', headerId: tid('neracaSaldo.colAccountName'), headerEn: ten('neracaSaldo.colAccountName'), align: 'left' },
    { key: 'debit', headerId: tid('neracaSaldo.colTotalDebit'), headerEn: ten('neracaSaldo.colTotalDebit'), align: 'right' },
    { key: 'credit', headerId: tid('neracaSaldo.colTotalCredit'), headerEn: ten('neracaSaldo.colTotalCredit'), align: 'right' },
  ]
  const exportRows = [
    ...filteredRows.map((r) => ({ code: r.account_code, name: r.account_name, debit: Number(r.total_debit), credit: Number(r.total_credit) })),
    { code: '', name: `${tid('neracaSaldo.total')} / ${ten('neracaSaldo.total')}`, debit: totalDebit, credit: totalCredit, _rowType: 'total' },
  ]
  const exportConfig = {
    companyName,
    titleId: tid('neracaSaldo.title'), titleEn: ten('neracaSaldo.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: exportColumns,
    rows: exportRows,
    fileBaseName: `neraca-saldo_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('neracaSaldo.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <PeriodFilter {...period} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr><th>{t('neracaSaldo.colCode')}</th><th>{t('neracaSaldo.colAccountName')}</th><th className="num">{t('neracaSaldo.colTotalDebit')}</th><th className="num">{t('neracaSaldo.colTotalCredit')}</th></tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.account_id}>
                <td>{r.account_code}</td>
                <td>{r.account_name}</td>
                <td className="num">{Number(r.total_debit).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(r.total_credit).toLocaleString(i18n.language)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={2}>{t('neracaSaldo.total')}</td>
              <td className="num">{totalDebit.toLocaleString(i18n.language)}</td>
              <td className="num">{totalCredit.toLocaleString(i18n.language)}</td>
            </tr>
          </tbody>
        </table>
        {totalDebit !== totalCredit && (
          <p className="error">{t('neracaSaldo.mismatch')}</p>
        )}
      </div>
    </div>
  )
}
