import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

export default function Jurnal() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const dim = useDimensionFilters(companyId)
  const [rawRows, setRawRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period.start, period.end, dim.depsKey])

  async function load() {
    const { data, error } = await supabase.rpc('get_journal_report', {
      p_company_id: companyId,
      p_start: period.start,
      p_end: period.end + 'T23:59:59',
      ...dim.rpcParams,
    })
    if (error) { setError(error.message); return }
    setRawRows(data || [])
  }

  const grouped = []
  const map = new Map()
  for (const r of rawRows) {
    if (!map.has(r.transaction_id)) {
      const g = { id: r.transaction_id, date: r.date, note: r.note, lines: [] }
      map.set(r.transaction_id, g)
      grouped.push(g)
    }
    map.get(r.transaction_id).lines.push({ account_name: r.account_name, account_code: r.account_code, debit: r.debit, credit: r.credit })
  }

  const exportColumns = [
    { key: 'date', headerId: tid('laporanTransaksi.colDate'), headerEn: ten('laporanTransaksi.colDate'), align: 'left' },
    { key: 'note', headerId: tid('laporanTransaksi.colNote'), headerEn: ten('laporanTransaksi.colNote'), align: 'left' },
    { key: 'account', headerId: tid('jurnal.colAccount'), headerEn: ten('jurnal.colAccount'), align: 'left' },
    { key: 'debit', headerId: tid('jurnal.colDebit'), headerEn: ten('jurnal.colDebit'), align: 'right' },
    { key: 'credit', headerId: tid('jurnal.colCredit'), headerEn: ten('jurnal.colCredit'), align: 'right' },
  ]
  const exportRows = []
  grouped.forEach((g) => {
    g.lines.forEach((l) => {
      exportRows.push({
        date: new Date(g.date).toLocaleString('id-ID'),
        note: g.note,
        account: `${l.account_name} (${l.account_code})`,
        debit: l.debit || 0,
        credit: l.credit || 0,
      })
    })
  })
  const exportConfig = {
    companyName,
    titleId: tid('jurnal.title'), titleEn: ten('jurnal.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: exportColumns,
    rows: exportRows,
    fileBaseName: `jurnal_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('jurnal.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <PeriodFilter {...period} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}

        {grouped.map((g) => (
          <div key={g.id} className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong>{g.note}</strong>
              <span className="hint">{new Date(g.date).toLocaleString(i18n.language)}</span>
            </div>
            <table className="tbl">
              <thead><tr><th>{t('jurnal.colAccount')}</th><th className="num">{t('jurnal.colDebit')}</th><th className="num">{t('jurnal.colCredit')}</th></tr></thead>
              <tbody>
                {g.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.account_name} ({l.account_code})</td>
                    <td className="num">{l.debit ? Number(l.debit).toLocaleString(i18n.language) : '-'}</td>
                    <td className="num">{l.credit ? Number(l.credit).toLocaleString(i18n.language) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!grouped.length && <p className="hint">{t('jurnal.noData')}</p>}
      </div>
    </div>
  )
}
