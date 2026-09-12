import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import CostCenterFilter, { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

export default function KartuPersediaan() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const cc = useCostCenterFilter(companyId)
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('products').select('id, code, name').eq('company_id', companyId).order('name')
      .then(({ data }) => {
        setProducts(data || [])
        if (data && data.length && !productId) setProductId(data[0].id)
      })
  }, [companyId])

  useEffect(() => {
    if (productId) load()
  }, [productId, period.start, period.end, cc.costCenterId])

  async function load() {
    let query = supabase
      .from('v_product_card')
      .select('*')
      .eq('company_id', companyId)
      .eq('product_id', productId)
      .gte('date', period.start)
      .lt('date', period.end + 'T23:59:59')
    if (cc.costCenterId) query = query.eq('cost_center_id', cc.costCenterId)
    const { data, error } = await query.order('date', { ascending: true })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  const selectedProduct = products.find((p) => p.id === productId)

  const exportColumns = [
    { key: 'date', headerId: tid('kartuPersediaan.colDate'), headerEn: ten('kartuPersediaan.colDate'), align: 'left' },
    { key: 'type', headerId: tid('kartuPersediaan.colType'), headerEn: ten('kartuPersediaan.colType'), align: 'left' },
    { key: 'qty', headerId: tid('kartuPersediaan.colQty'), headerEn: ten('kartuPersediaan.colQty'), align: 'right' },
    { key: 'unitCost', headerId: tid('kartuPersediaan.colUnitCost'), headerEn: ten('kartuPersediaan.colUnitCost'), align: 'right' },
    { key: 'totalCost', headerId: tid('kartuPersediaan.colTotalCost'), headerEn: ten('kartuPersediaan.colTotalCost'), align: 'right' },
    { key: 'runningQty', headerId: tid('kartuPersediaan.colRunningQty'), headerEn: ten('kartuPersediaan.colRunningQty'), align: 'right' },
    { key: 'runningValue', headerId: tid('kartuPersediaan.colRunningValue'), headerEn: ten('kartuPersediaan.colRunningValue'), align: 'right' },
  ]
  const exportRows = rows.map((r) => ({
    date: new Date(r.date).toLocaleString('id-ID'),
    type: r.type === 'in' ? `${tid('kartuPersediaan.typeIn')} / ${ten('kartuPersediaan.typeIn')}` : `${tid('kartuPersediaan.typeOut')} / ${ten('kartuPersediaan.typeOut')}`,
    qty: r.qty, unitCost: r.unit_cost, totalCost: r.total_cost, runningQty: r.running_qty, runningValue: r.running_value,
  }))
  const exportConfig = {
    companyName,
    titleId: `${tid('kartuPersediaan.title')} — ${selectedProduct?.name || ''}`,
    titleEn: `${ten('kartuPersediaan.title')} — ${selectedProduct?.name || ''}`,
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: exportColumns,
    rows: exportRows,
    fileBaseName: `kartu-persediaan_${selectedProduct?.code || ''}_${period.start}_${period.end}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('kartuPersediaan.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
          <PeriodFilter {...period} />
          <CostCenterFilter {...cc} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('kartuPersediaan.colDate')}</th><th>{t('kartuPersediaan.colType')}</th>
              <th className="num">{t('kartuPersediaan.colQty')}</th><th className="num">{t('kartuPersediaan.colUnitCost')}</th>
              <th className="num">{t('kartuPersediaan.colTotalCost')}</th>
              <th className="num">{t('kartuPersediaan.colRunningQty')}</th><th className="num">{t('kartuPersediaan.colRunningValue')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.date).toLocaleString(i18n.language)}</td>
                <td>
                  <span className={`badge ${r.type === 'in' ? 'lunas' : 'pending'}`}>
                    {r.type === 'in' ? t('kartuPersediaan.typeIn') : t('kartuPersediaan.typeOut')}
                  </span>
                </td>
                <td className="num">{Number(r.qty).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(r.unit_cost).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(r.total_cost).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(r.running_qty).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(r.running_value).toLocaleString(i18n.language)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="empty">{t('kartuPersediaan.noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
