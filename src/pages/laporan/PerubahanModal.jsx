import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import { sumCategory, dayBefore, fmt } from '../../lib/reportHelpers.js'

export default function PerubahanModal() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const dim = useDimensionFilters(companyId)
  const [modalAwal, setModalAwal] = useState(0)
  const [setoran, setSetoran] = useState(0)
  const [penarikan, setPenarikan] = useState(0)
  const [labaBersih, setLabaBersih] = useState(0)
  const [modalAkhirAktual, setModalAkhirAktual] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period.start, period.end, dim.depsKey])

  async function trialBalance(start, end) {
    const { data, error } = await supabase.rpc('get_trial_balance', { p_company_id: companyId, p_start: start, p_end: end, ...dim.rpcParams })
    if (error) { setError(error.message); return [] }
    return data || []
  }

  async function modalMovement(type, start, end) {
    const { data, error } = await supabase.rpc('get_modal_movement', {
      p_company_id: companyId, p_type: type, p_start: start, p_end: end + 'T23:59:59', ...dim.rpcParams,
    })
    if (error) { console.error(error); return 0 }
    return Number(data) || 0
  }

  async function load() {
    setError(null)
    const tbAwal = await trialBalance('1900-01-01', dayBefore(period.start))
    setModalAwal(sumCategory(tbAwal, 'modal'))

    const setoranAmt = await modalMovement('tanam_modal', period.start, period.end)
    setSetoran(setoranAmt)
    const penarikanAmt = await modalMovement('tarik_modal', period.start, period.end)
    setPenarikan(-penarikanAmt)

    const tbPeriod = await trialBalance(period.start, period.end)
    const pendapatan = sumCategory(tbPeriod, 'pendapatan')
    const beban = sumCategory(tbPeriod, 'beban_pokok') + sumCategory(tbPeriod, 'beban_operasional')
    setLabaBersih(pendapatan - beban)

    const tbAkhir = await trialBalance('1900-01-01', period.end)
    setModalAkhirAktual(sumCategory(tbAkhir, 'modal'))
  }

  const modalAkhirDihitung = modalAwal + setoran - penarikan + labaBersih
  const selisih = modalAkhirAktual - modalAkhirDihitung

  const exportRows = [
    { desc: `${tid('perubahanModal.openingCapital')} / ${ten('perubahanModal.openingCapital')}`, amount: modalAwal },
    { desc: `${tid('perubahanModal.capitalInjection')} / ${ten('perubahanModal.capitalInjection')}`, amount: setoran },
    { desc: `${tid('perubahanModal.capitalWithdrawal')} / ${ten('perubahanModal.capitalWithdrawal')}`, amount: penarikan },
    { desc: `${tid('perubahanModal.netIncomePeriod')} / ${ten('perubahanModal.netIncomePeriod')}`, amount: labaBersih },
    { desc: `${tid('perubahanModal.closingCapitalCalc')} / ${ten('perubahanModal.closingCapitalCalc')}`, amount: modalAkhirDihitung, _rowType: 'total' },
    { desc: `${tid('perubahanModal.closingCapitalActual')} / ${ten('perubahanModal.closingCapitalActual')}`, amount: modalAkhirAktual },
  ]
  const exportConfig = {
    companyName,
    titleId: tid('perubahanModal.title'), titleEn: ten('perubahanModal.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: [
      { key: 'desc', headerId: tid('common.notes'), headerEn: ten('common.notes'), align: 'left' },
      { key: 'amount', headerId: tid('common.amount'), headerEn: ten('common.amount'), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `perubahan-modal_${period.start}_${period.end}`,
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1>{t('perubahanModal.title')}</h1>
        <ExportMenu config={exportConfig} />
      </div>
      <div className="filters">
        <PeriodFilter {...period} />
        <DimensionFilters {...dim} />
      </div>
      {error && <p className="error">{error}</p>}
      <table className="tbl">
        <tbody>
          <tr><td>{t('perubahanModal.openingCapital')}</td><td className="num">{fmt(modalAwal)}</td></tr>
          <tr><td style={{ paddingLeft: 24 }}>{t('perubahanModal.capitalInjection')}</td><td className="num">{fmt(setoran)}</td></tr>
          <tr><td style={{ paddingLeft: 24 }}>{t('perubahanModal.capitalWithdrawal')}</td><td className="num">{fmt(penarikan)}</td></tr>
          <tr><td style={{ paddingLeft: 24 }}>{t('perubahanModal.netIncomePeriod')}</td><td className="num">{fmt(labaBersih)}</td></tr>
          <tr className="total-row"><td>{t('perubahanModal.closingCapitalCalc')}</td><td className="num">{fmt(modalAkhirDihitung)}</td></tr>
          <tr><td>{t('perubahanModal.closingCapitalActual')}</td><td className="num">{fmt(modalAkhirAktual)}</td></tr>
        </tbody>
      </table>
      {Math.abs(selisih) > 1 && (
        <p className="error" style={{ marginTop: 10 }}>
          {t('perubahanModal.mismatch', { amount: fmt(Math.abs(selisih)) })}
        </p>
      )}
    </div>
  )
}
