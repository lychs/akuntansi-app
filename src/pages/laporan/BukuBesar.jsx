import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

export default function BukuBesar() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const dim = useDimensionFilters(companyId)
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .order('code')
      .then(({ data }) => {
        setAccounts(data || [])
        if (data && data.length && !accountId) setAccountId(data[0].id)
      })
  }, [companyId])

  useEffect(() => {
    if (accountId) load()
  }, [accountId, period.start, period.end, dim.depsKey])

  async function load() {
    const { data, error } = await supabase.rpc('get_general_ledger', {
      p_company_id: companyId,
      p_account_id: accountId,
      p_start: period.start,
      p_end: period.end + 'T23:59:59',
      ...dim.rpcParams,
    })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  const selectedAccount = accounts.find((a) => a.id === accountId)

  const exportColumns = [
    { key: 'date', headerId: tid('bukuBesar.colDate'), headerEn: ten('bukuBesar.colDate'), align: 'left' },
    { key: 'note', headerId: tid('bukuBesar.colNote'), headerEn: ten('bukuBesar.colNote'), align: 'left' },
    { key: 'counterparty', headerId: tid('bukuBesar.colCounterparty'), headerEn: ten('bukuBesar.colCounterparty'), align: 'left' },
    { key: 'debit', headerId: tid('bukuBesar.colDebit'), headerEn: ten('bukuBesar.colDebit'), align: 'right' },
    { key: 'credit', headerId: tid('bukuBesar.colCredit'), headerEn: ten('bukuBesar.colCredit'), align: 'right' },
    { key: 'balance', headerId: tid('bukuBesar.colBalance'), headerEn: ten('bukuBesar.colBalance'), align: 'right' },
  ]
  const exportRows = rows.map((r) => ({
    date: new Date(r.date).toLocaleString('id-ID'),
    note: r.note,
    counterparty: r.contact_name || '-',
    debit: r.debit || 0,
    credit: r.credit || 0,
    balance: r.running_balance,
  }))
  const exportConfig = {
    companyName,
    titleId: `${tid('bukuBesar.title')} — ${selectedAccount?.name || ''}`,
    titleEn: `${ten('bukuBesar.title')} — ${selectedAccount?.name || ''}`,
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: exportColumns,
    rows: exportRows,
    fileBaseName: `buku-besar_${selectedAccount?.code || ''}_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('bukuBesar.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
            ))}
          </select>
          <PeriodFilter {...period} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr><th>{t('bukuBesar.colDate')}</th><th>{t('bukuBesar.colNote')}</th><th>{t('bukuBesar.colCounterparty')}</th><th className="num">{t('bukuBesar.colDebit')}</th><th className="num">{t('bukuBesar.colCredit')}</th><th className="num">{t('bukuBesar.colBalance')}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.journal_entry_id}>
                <td>{new Date(r.date).toLocaleString(i18n.language)}</td>
                <td>{r.note}</td>
                <td>{r.contact_name || '-'}</td>
                <td className="num">{r.debit ? Number(r.debit).toLocaleString(i18n.language) : '-'}</td>
                <td className="num">{r.credit ? Number(r.credit).toLocaleString(i18n.language) : '-'}</td>
                <td className="num">{Number(r.running_balance).toLocaleString(i18n.language)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="empty">{t('bukuBesar.noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
