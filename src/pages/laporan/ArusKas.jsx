import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import { sumCategory, dayBefore, fmt } from '../../lib/reportHelpers.js'

const PENDANAAN_TYPES = ['tanam_modal', 'tarik_modal']

export default function ArusKas() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const dim = useDimensionFilters(companyId)
  const [saldoAwal, setSaldoAwal] = useState(0)
  const [saldoAkhirAktual, setSaldoAkhirAktual] = useState(0)
  const [operasional, setOperasional] = useState(0)
  const [pendanaan, setPendanaan] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period.start, period.end, dim.depsKey])

  async function trialBalance(start, end) {
    const { data, error } = await supabase.rpc('get_trial_balance', { p_company_id: companyId, p_start: start, p_end: end, ...dim.rpcParams })
    if (error) { setError(error.message); return [] }
    return data || []
  }

  async function load() {
    setError(null)
    const tbAwal = await trialBalance('1900-01-01', dayBefore(period.start))
    setSaldoAwal(sumCategory(tbAwal, 'kas_bank'))

    const tbAkhir = await trialBalance('1900-01-01', period.end)
    setSaldoAkhirAktual(sumCategory(tbAkhir, 'kas_bank'))

    const { data, error: jeError } = await supabase.rpc('get_cash_movement', {
      p_company_id: companyId,
      p_start: period.start,
      p_end: period.end + 'T23:59:59',
      ...dim.rpcParams,
    })
    if (jeError) { setError(jeError.message); return }

    let opAmt = 0, pendAmt = 0
    for (const r of data || []) {
      const net = Number(r.debit) - Number(r.credit)
      if (PENDANAAN_TYPES.includes(r.type)) pendAmt += net
      else opAmt += net
    }
    setOperasional(opAmt)
    setPendanaan(pendAmt)
  }

  const kasBersih = operasional + pendanaan
  const saldoAkhirDihitung = saldoAwal + kasBersih
  const selisih = saldoAkhirAktual - saldoAkhirDihitung

  const exportRows = [
    { desc: `${tid('arusKas.openingCash')} / ${ten('arusKas.openingCash')}`, amount: saldoAwal },
    { desc: `${tid('arusKas.operatingActivities')} / ${ten('arusKas.operatingActivities')}`, amount: null, _rowType: 'subtotal' },
    { desc: `${tid('arusKas.netOperatingCash')} / ${ten('arusKas.netOperatingCash')}`, amount: operasional },
    { desc: `${tid('arusKas.financingActivities')} / ${ten('arusKas.financingActivities')}`, amount: null, _rowType: 'subtotal' },
    { desc: `${tid('arusKas.netFinancingCash')} / ${ten('arusKas.netFinancingCash')}`, amount: pendanaan },
    { desc: `${tid('arusKas.netCashChange')} / ${ten('arusKas.netCashChange')}`, amount: kasBersih, _rowType: 'total' },
    { desc: `${tid('arusKas.closingCashCalc')} / ${ten('arusKas.closingCashCalc')}`, amount: saldoAkhirDihitung, _rowType: 'total' },
    { desc: `${tid('arusKas.closingCashActual')} / ${ten('arusKas.closingCashActual')}`, amount: saldoAkhirAktual },
  ]
  const exportConfig = {
    companyName,
    titleId: tid('arusKas.title'), titleEn: ten('arusKas.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: [
      { key: 'desc', headerId: tid('common.notes'), headerEn: ten('common.notes'), align: 'left' },
      { key: 'amount', headerId: tid('common.amount'), headerEn: ten('common.amount'), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `arus-kas_${period.start}_${period.end}`,
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1>{t('arusKas.title')}</h1>
        <ExportMenu config={exportConfig} />
      </div>
      <div className="filters">
        <PeriodFilter {...period} />
        <DimensionFilters {...dim} />
      </div>
      {error && <p className="error">{error}</p>}
      <table className="tbl">
        <tbody>
          <tr><td>{t('arusKas.openingCash')}</td><td className="num">{fmt(saldoAwal)}</td></tr>
          <tr className="subtotal-row"><td colSpan={2}>{t('arusKas.operatingActivities')}</td></tr>
          <tr><td style={{ paddingLeft: 24 }}>{t('arusKas.netOperatingCash')}</td><td className="num">{fmt(operasional)}</td></tr>
          <tr className="subtotal-row"><td colSpan={2}>{t('arusKas.financingActivities')}</td></tr>
          <tr><td style={{ paddingLeft: 24 }}>{t('arusKas.netFinancingCash')}</td><td className="num">{fmt(pendanaan)}</td></tr>
          <tr className="total-row"><td>{t('arusKas.netCashChange')}</td><td className="num">{fmt(kasBersih)}</td></tr>
          <tr className="total-row"><td>{t('arusKas.closingCashCalc')}</td><td className="num">{fmt(saldoAkhirDihitung)}</td></tr>
          <tr><td>{t('arusKas.closingCashActual')}</td><td className="num">{fmt(saldoAkhirAktual)}</td></tr>
        </tbody>
      </table>
      {Math.abs(selisih) > 1 && (
        <p className="error" style={{ marginTop: 10 }}>
          {t('arusKas.mismatch', { amount: fmt(Math.abs(selisih)) })}
        </p>
      )}
      <p className="hint" style={{ marginTop: 14 }}>
        {t('arusKas.footnote')}
      </p>
    </div>
  )
}
