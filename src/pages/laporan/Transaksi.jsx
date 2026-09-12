import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, Paperclip } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import { DOC_TYPE_BY_TRANSACTION_TYPE, generateTransactionDocument } from '../../lib/documentPrint.js'

export default function LaporanTransaksi() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const TYPE_LABEL = {
    general: t('laporanTransaksi.typeGeneral'), pemasukan: t('laporanTransaksi.typePemasukan'), pengeluaran: t('laporanTransaksi.typePengeluaran'),
    hutang: t('laporanTransaksi.typeHutang'), piutang: t('laporanTransaksi.typePiutang'), tanam_modal: t('laporanTransaksi.typeTanamModal'),
    tarik_modal: t('laporanTransaksi.typeTarikModal'), transfer: t('laporanTransaksi.typeTransfer'),
    pemasukan_sebagai_piutang: t('laporanTransaksi.typePelunasanPiutang'), pengeluaran_sebagai_hutang: t('laporanTransaksi.typePelunasanHutang'),
  }
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const dim = useDimensionFilters(companyId)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period.start, period.end, dim.depsKey])

  async function load() {
    const { data, error } = await supabase.rpc('get_transaction_report', {
      p_company_id: companyId,
      p_start: period.start,
      p_end: period.end + 'T23:59:59',
      ...dim.rpcParams,
    })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  const typeKeyMap = {
    general: 'typeGeneral', pemasukan: 'typePemasukan', pengeluaran: 'typePengeluaran',
    hutang: 'typeHutang', piutang: 'typePiutang', tanam_modal: 'typeTanamModal', tarik_modal: 'typeTarikModal',
    transfer: 'typeTransfer', pemasukan_sebagai_piutang: 'typePelunasanPiutang', pengeluaran_sebagai_hutang: 'typePelunasanHutang',
  }
  const exportColumns = [
    { key: 'date', headerId: tid('laporanTransaksi.colDate'), headerEn: ten('laporanTransaksi.colDate'), align: 'left' },
    { key: 'type', headerId: tid('laporanTransaksi.colType'), headerEn: ten('laporanTransaksi.colType'), align: 'left' },
    { key: 'note', headerId: tid('laporanTransaksi.colNote'), headerEn: ten('laporanTransaksi.colNote'), align: 'left' },
    { key: 'contact', headerId: tid('laporanTransaksi.colContact'), headerEn: ten('laporanTransaksi.colContact'), align: 'left' },
    { key: 'amount', headerId: tid('laporanTransaksi.colAmount'), headerEn: ten('laporanTransaksi.colAmount'), align: 'right' },
  ]
  const exportRows = rows.map((t2) => {
    const tk = typeKeyMap[t2.type]
    return {
      date: new Date(t2.date).toLocaleString('id-ID'),
      type: tk ? `${tid(`laporanTransaksi.${tk}`)} / ${ten(`laporanTransaksi.${tk}`)}` : t2.type,
      note: t2.note,
      contact: t2.contact_name || '-',
      amount: Number(t2.total_amount),
    }
  })
  const exportConfig = {
    companyName,
    titleId: tid('laporanTransaksi.title'), titleEn: ten('laporanTransaksi.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: exportColumns,
    rows: exportRows,
    fileBaseName: `laporan-transaksi_${period.start}_${period.end}`,
  }

  async function handlePrint(t2) {
    let lineItems = []
    if (['pembelian_barang', 'penjualan_barang', 'retur_pembelian', 'retur_penjualan'].includes(t2.type)) {
      const { data } = await supabase.rpc('get_transaction_line_items', { p_transaction_id: t2.id })
      lineItems = (data || []).map((r) => ({
        name: r.product_name, qty: Number(r.qty), unit: r.unit,
        unitPrice: Number(r.unit_cost), subtotal: Number(r.total_cost),
      }))
    }
    generateTransactionDocument(t2, companyName, lineItems)
  }

  async function handleViewReceipt(path) {
    const { data, error } = await supabase.storage.from('transaction-receipts').createSignedUrl(path, 60)
    if (error || !data) { alert(t('laporanTransaksi.errReceiptOpen')); return }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('laporanTransaksi.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <PeriodFilter {...period} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr><th>{t('laporanTransaksi.colDate')}</th><th>{t('laporanTransaksi.colType')}</th><th>{t('laporanTransaksi.colNote')}</th><th>{t('laporanTransaksi.colContact')}</th><th className="num">{t('laporanTransaksi.colAmount')}</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((t2) => (
              <tr key={t2.id}>
                <td>{new Date(t2.date).toLocaleString(i18n.language)}</td>
                <td>{TYPE_LABEL[t2.type] || t2.type}</td>
                <td>{t2.note}</td>
                <td>{t2.contact_name || '-'}</td>
                <td className="num">{Number(t2.total_amount).toLocaleString(i18n.language)}</td>
                <td style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {t2.receipt_path && (
                    <button className="btn-icon-danger" style={{ color: 'var(--brand)' }} onClick={() => handleViewReceipt(t2.receipt_path)} title={t('laporanTransaksi.viewReceipt')}>
                      <Paperclip size={14} />
                    </button>
                  )}
                  {DOC_TYPE_BY_TRANSACTION_TYPE[t2.type] && (
                    <button className="btn-icon-danger" style={{ color: 'var(--brand)' }} onClick={() => handlePrint(t2)} title={t('laporanTransaksi.printDocument')}>
                      <Printer size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="empty">{t('laporanTransaksi.noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
