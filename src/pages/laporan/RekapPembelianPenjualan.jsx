import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import CostCenterFilter, { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import { fmt } from '../../lib/reportHelpers.js'

export default function RekapPembelianPenjualan() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const cc = useCostCenterFilter(companyId)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId, period.start, period.end, cc.costCenterId])

  async function load() {
    const { data, error } = await supabase.rpc('get_purchase_sales_recap', {
      p_company_id: companyId, p_start: period.start, p_end: period.end, p_cost_center_id: cc.costCenterId || null,
    })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  const exportRows = rows.map((r) => ({
    product: `${r.product_name} (${r.product_code})`,
    branch: r.cost_center_name || '-',
    qtyPurchased: Number(r.qty_purchased), valuePurchased: Number(r.value_purchased),
    qtySold: Number(r.qty_sold), valueSold: Number(r.value_sold),
    qtyReturnedPurchase: Number(r.qty_returned_purchase), qtyReturnedSales: Number(r.qty_returned_sales),
  }))
  const exportConfig = {
    companyName,
    titleId: tid('rekapPembelianPenjualan.title'), titleEn: ten('rekapPembelianPenjualan.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: [
      { key: 'product', headerId: tid('produk.colName'), headerEn: ten('produk.colName'), align: 'left' },
      { key: 'branch', headerId: tid('costCenter.colName'), headerEn: ten('costCenter.colName'), align: 'left' },
      { key: 'qtyPurchased', headerId: tid('rekapPembelianPenjualan.colQtyPurchased'), headerEn: ten('rekapPembelianPenjualan.colQtyPurchased'), align: 'right' },
      { key: 'valuePurchased', headerId: tid('rekapPembelianPenjualan.colValuePurchased'), headerEn: ten('rekapPembelianPenjualan.colValuePurchased'), align: 'right' },
      { key: 'qtySold', headerId: tid('rekapPembelianPenjualan.colQtySold'), headerEn: ten('rekapPembelianPenjualan.colQtySold'), align: 'right' },
      { key: 'valueSold', headerId: tid('rekapPembelianPenjualan.colValueSold'), headerEn: ten('rekapPembelianPenjualan.colValueSold'), align: 'right' },
      { key: 'qtyReturnedPurchase', headerId: tid('rekapPembelianPenjualan.colQtyReturnedPurchase'), headerEn: ten('rekapPembelianPenjualan.colQtyReturnedPurchase'), align: 'right' },
      { key: 'qtyReturnedSales', headerId: tid('rekapPembelianPenjualan.colQtyReturnedSales'), headerEn: ten('rekapPembelianPenjualan.colQtyReturnedSales'), align: 'right' },
    ],
    rows: exportRows,
    fileBaseName: `rekap-pembelian-penjualan_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('rekapPembelianPenjualan.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <PeriodFilter {...period} />
          <CostCenterFilter {...cc} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('produk.colName')}</th><th>{t('costCenter.colName')}</th>
              <th className="num">{t('rekapPembelianPenjualan.colQtyPurchased')}</th>
              <th className="num">{t('rekapPembelianPenjualan.colValuePurchased')}</th>
              <th className="num">{t('rekapPembelianPenjualan.colQtySold')}</th>
              <th className="num">{t('rekapPembelianPenjualan.colValueSold')}</th>
              <th className="num">{t('rekapPembelianPenjualan.colQtyReturnedPurchase')}</th>
              <th className="num">{t('rekapPembelianPenjualan.colQtyReturnedSales')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.product_name} <span className="hint">({r.product_code})</span></td>
                <td>{r.cost_center_name || '-'}</td>
                <td className="num">{Number(r.qty_purchased).toLocaleString(i18n.language)}</td>
                <td className="num">{fmt(r.value_purchased)}</td>
                <td className="num">{Number(r.qty_sold).toLocaleString(i18n.language)}</td>
                <td className="num">{fmt(r.value_sold)}</td>
                <td className="num">{Number(r.qty_returned_purchase).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(r.qty_returned_sales).toLocaleString(i18n.language)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="empty">{t('rekapPembelianPenjualan.noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
