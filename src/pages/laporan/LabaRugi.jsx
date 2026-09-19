import { useEffect, useState, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  const [expandedId, setExpandedId] = useState(null)
  const [detailRows, setDetailRows] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

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
  // netAmount() udah diarahkan sesuai normal_balance akun itu sendiri. Buat akun
  // kategori "pendapatan" yang normal_balance-nya KREDIT (pendapatan asli), itu
  // nambah pendapatan. Tapi akun kontra-pendapatan (misal "Retur Penjualan",
  // normal_balance DEBIT walau kategorinya pendapatan) harus MENGURANGI, bukan
  // menambah — dihitung lewat displayAmount() di bawah biar konsisten sama
  // yang ditampilkan di tabel.
  const totalPendapatan = groups.pendapatan.reduce((s, r) => s + displayAmount(r), 0)
  const totalBebanPokok = groups.beban_pokok.reduce((s, r) => s + netAmount(r), 0)
  const totalBebanOps = groups.beban_operasional.reduce((s, r) => s + netAmount(r), 0)
  const labaKotor = totalPendapatan - totalBebanPokok
  const labaBersih = labaKotor - totalBebanOps

  // Nilai yang DITAMPILKAN per baris — akun kontra-pendapatan (normal_balance
  // debit di kategori pendapatan, misal "Retur Penjualan") ditampilkan NEGATIF
  // biar kalau dijumlah manual sama pembaca, hasilnya tetap benar & gak ketuker
  // dikira nambah padahal ngurangin.
  function displayAmount(r) {
    const amt = netAmount(r)
    return r.category === 'pendapatan' && r.normal_balance !== 'kredit' ? -amt : amt
  }

  async function toggleExpand(accountId) {
    if (expandedId === accountId) { setExpandedId(null); return }
    setExpandedId(accountId)
    setDetailLoading(true)
    setDetailError(null)
    let query = supabase
      .from('journal_entries')
      .select('debit, credit, transactions!inner(id, date, note, type, cost_center_id, department_id, project_id, warehouse_id)')
      .eq('account_id', accountId)
      .gte('transactions.date', period.start)
      .lt('transactions.date', period.end + 'T23:59:59')
    if (dim.costCenterId) query = query.eq('transactions.cost_center_id', dim.costCenterId)
    if (dim.departmentId) query = query.eq('transactions.department_id', dim.departmentId)
    if (dim.projectId) query = query.eq('transactions.project_id', dim.projectId)
    if (dim.warehouseId) query = query.eq('transactions.warehouse_id', dim.warehouseId)
    const { data, error } = await query.order('date', { referencedTable: 'transactions', ascending: true })
    setDetailLoading(false)
    if (error) { setDetailError(error.message); return }
    setDetailRows(data || [])
  }

  function renderGroup(title, list) {
    return (
      <>
        <tr className="subtotal-row"><td colSpan={2}>{title}</td></tr>
        {list.map((r) => (
          <Fragment key={r.account_id}>
            <tr className="drilldown-row" onClick={() => toggleExpand(r.account_id)}>
              <td style={{ paddingLeft: 24, cursor: 'pointer' }}>
                {expandedId === r.account_id ? <ChevronDown size={13} style={{ verticalAlign: -2, marginRight: 6 }} /> : <ChevronRight size={13} style={{ verticalAlign: -2, marginRight: 6 }} />}
                {r.account_name}
              </td>
              <td className="num">{displayAmount(r).toLocaleString(i18n.language)}</td>
            </tr>
            {expandedId === r.account_id && (
              <tr>
                <td colSpan={2} style={{ padding: 0, background: 'var(--surface-alt)' }}>
                  {detailLoading && <p className="hint" style={{ padding: 12 }}>{t('common.loading')}</p>}
                  {detailError && <p className="error" style={{ padding: 12 }}>{detailError}</p>}
                  {!detailLoading && !detailError && (
                    detailRows.length ? (
                      <table className="tbl" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ paddingLeft: 40 }}>{t('labaRugi.colDate')}</th>
                            <th>{t('labaRugi.colNote')}</th>
                            <th className="num">{t('labaRugi.colDebit')}</th>
                            <th className="num">{t('labaRugi.colCredit')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailRows.map((d, i) => (
                            <tr key={i}>
                              <td style={{ paddingLeft: 40 }}>{new Date(d.transactions.date).toLocaleDateString(i18n.language)}</td>
                              <td>{d.transactions.note || '-'}</td>
                              <td className="num">{Number(d.debit) ? Number(d.debit).toLocaleString(i18n.language) : ''}</td>
                              <td className="num">{Number(d.credit) ? Number(d.credit).toLocaleString(i18n.language) : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="hint" style={{ padding: 12 }}>{t('labaRugi.noDetail')}</p>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </>
    )
  }

  function exportGroup(labelId, labelEn, list) {
    return [
      { account: `${labelId} / ${labelEn}`, amount: null, _rowType: 'subtotal' },
      ...list.map((r) => ({ account: r.account_name, amount: displayAmount(r) })),
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
