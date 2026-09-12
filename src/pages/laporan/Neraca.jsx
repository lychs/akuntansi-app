import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

function netAmount(row) {
  return row.normal_balance === 'kredit'
    ? Number(row.total_credit) - Number(row.total_debit)
    : Number(row.total_debit) - Number(row.total_credit)
}

const ASSET_CATS = ['kas_bank', 'piutang', 'persediaan', 'harta_lancar_lainnya', 'harta_tetap']

export default function Neraca() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10))
  const dim = useDimensionFilters(companyId)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, asOf, dim.depsKey])

  async function load() {
    const { data, error } = await supabase.rpc('get_trial_balance', {
      p_company_id: companyId,
      p_start: '1900-01-01',
      p_end: asOf,
      ...dim.rpcParams,
    })
    if (error) { setError(error.message); return }
    setRows((data || []).filter((r) => Number(r.total_debit) || Number(r.total_credit)))
  }

  const aset = rows.filter((r) => ASSET_CATS.includes(r.category))
  const hutang = rows.filter((r) => r.category === 'hutang')
  const modal = rows.filter((r) => r.category === 'modal')
  const pendapatanBeban = rows.filter((r) => ['pendapatan', 'beban_pokok', 'beban_operasional'].includes(r.category))

  const totalAset = aset.reduce((s, r) => s + netAmount(r), 0)
  const totalHutang = hutang.reduce((s, r) => s + netAmount(r), 0)
  const totalModal = modal.reduce((s, r) => s + netAmount(r), 0)
  const labaTahunBerjalan = pendapatanBeban.reduce((s, r) => {
    const amt = netAmount(r)
    return s + (r.category === 'pendapatan' ? amt : -amt)
  }, 0)
  const totalModalDenganLaba = totalModal + labaTahunBerjalan

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
      { account: `${labelId} / ${labelEn}`, balance: null, _rowType: 'subtotal' },
      ...list.map((r) => ({ account: r.account_name, balance: netAmount(r) })),
    ]
  }
  const exportRows = [
    ...exportGroup(tid('neraca.assets'), ten('neraca.assets'), aset),
    { account: `${tid('neraca.totalAssets')} / ${ten('neraca.totalAssets')}`, balance: totalAset, _rowType: 'total' },
    ...exportGroup(tid('neraca.liabilities'), ten('neraca.liabilities'), hutang),
    { account: `${tid('neraca.totalLiabilities')} / ${ten('neraca.totalLiabilities')}`, balance: totalHutang, _rowType: 'total' },
    ...exportGroup(tid('neraca.equity'), ten('neraca.equity'), modal),
    { account: `${tid('neraca.currentYearProfit')} / ${ten('neraca.currentYearProfit')}`, balance: labaTahunBerjalan },
    { account: `${tid('neraca.totalEquity')} / ${ten('neraca.totalEquity')}`, balance: totalModalDenganLaba, _rowType: 'total' },
    { account: `${tid('neraca.totalLiabilitiesEquity')} / ${ten('neraca.totalLiabilitiesEquity')}`, balance: totalHutang + totalModalDenganLaba, _rowType: 'total' },
  ]
  const exportConfig = {
    companyName,
    titleId: tid('neraca.title'), titleEn: ten('neraca.title'),
    periodTextId: `${tid('common.asOfLabel')}: ${asOf}`,
    periodTextEn: `${ten('common.asOfLabel')}: ${asOf}`,
    columns: [
      { key: 'account', headerId: tid('neraca.colAccount'), headerEn: ten('neraca.colAccount'), align: 'left' },
      { key: 'balance', headerId: tid('neraca.colBalance'), headerEn: ten('neraca.colBalance'), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `neraca_${asOf}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('neraca.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <label style={{ fontSize: 13, fontWeight: 600 }}>{t('neraca.asOfDate')}</label>
          <DateField value={asOf} onChange={setAsOf} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead><tr><th>{t('neraca.colAccount')}</th><th className="num">{t('neraca.colBalance')}</th></tr></thead>
          <tbody>
            {renderGroup(t('neraca.assets'), aset)}
            <tr className="total-row"><td>{t('neraca.totalAssets')}</td><td className="num">{totalAset.toLocaleString(i18n.language)}</td></tr>
            {renderGroup(t('neraca.liabilities'), hutang)}
            <tr className="total-row"><td>{t('neraca.totalLiabilities')}</td><td className="num">{totalHutang.toLocaleString(i18n.language)}</td></tr>
            {renderGroup(t('neraca.equity'), modal)}
            <tr>
              <td style={{ paddingLeft: 24 }}>{t('neraca.currentYearProfit')}</td>
              <td className="num">{labaTahunBerjalan.toLocaleString(i18n.language)}</td>
            </tr>
            <tr className="total-row"><td>{t('neraca.totalEquity')}</td><td className="num">{totalModalDenganLaba.toLocaleString(i18n.language)}</td></tr>
            <tr className="total-row">
              <td>{t('neraca.totalLiabilitiesEquity')}</td>
              <td className="num">{(totalHutang + totalModalDenganLaba).toLocaleString(i18n.language)}</td>
            </tr>
          </tbody>
        </table>
        {Math.round(totalAset) !== Math.round(totalHutang + totalModalDenganLaba) && (
          <p className="error">{t('neraca.unbalanced')}</p>
        )}
      </div>
    </div>
  )
}
