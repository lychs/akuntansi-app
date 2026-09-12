import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'
import ReceiptUpload, { uploadReceiptIfNeeded } from '../../components/ReceiptUpload.jsx'

export default function StockOpname() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const navigate = useNavigate()
  const cc = useCostCenterFilter(companyId)

  const [products, setProducts] = useState([])
  const [branchStock, setBranchStock] = useState({}) // { product_id: qty }
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [counted, setCounted] = useState({})
  const [error, setError] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!companyId) return
    supabase.from('products').select('id, code, name, unit').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
  }, [companyId])

  useEffect(() => {
    if (!cc.costCenterId || !products.length) { setBranchStock({}); return }
    supabase.from('product_branch_stock').select('product_id, qty_on_hand, avg_unit_cost').eq('cost_center_id', cc.costCenterId)
      .then(({ data }) => {
        const map = {}
        for (const r of data || []) map[r.product_id] = { qty: Number(r.qty_on_hand), avgCost: Number(r.avg_unit_cost) }
        setBranchStock(map)
      })
  }, [cc.costCenterId, products])

  function setCount(productId, field, value) {
    setCounted((c) => ({ ...c, [productId]: { ...c[productId], [field]: value } }))
  }

  const rowsWithDiff = products
    .map((p) => {
      const entry = counted[p.id]
      if (!entry || entry.qty === undefined || entry.qty === '') return null
      const countedQty = Number(entry.qty)
      const systemQty = branchStock[p.id]?.qty || 0
      const diff = countedQty - systemQty
      return { product: p, countedQty, diff, unitCost: entry.unit_cost, systemQty }
    })
    .filter((r) => r && r.diff !== 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!cc.costCenterId) { setError(t('stockOpname.errBranchRequired')); return }
    if (!rowsWithDiff.length) { setError(t('stockOpname.errNoDiff')); return }
    if (!note.trim()) { setError(t('transaksi.errNote')); return }
    const missingCost = rowsWithDiff.find((r) => r.diff > 0 && !branchStock[r.product.id]?.avgCost && !r.unitCost)
    if (missingCost) { setError(t('stockOpname.errUnitCostRequired', { name: missingCost.product.name })); return }

    setSaving(true)
    let receiptPath = null
    try {
      receiptPath = await uploadReceiptIfNeeded(supabase, companyId, receiptFile)
    } catch (uploadErr) {
      setSaving(false)
      setError(uploadErr.message)
      return
    }
    const { error } = await supabase.rpc('record_stock_opname', {
      p_company_id: companyId,
      p_date: new Date(date).toISOString(),
      p_note: note.trim(),
      p_lines: rowsWithDiff.map((r) => ({
        product_id: r.product.id,
        counted_qty: r.countedQty,
        unit_cost: r.unitCost ? Number(r.unitCost) : null,
      })),
      p_cost_center_id: cc.costCenterId,
      p_receipt_path: receiptPath,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    navigate('/dagang/produk')
  }

  if (!canEdit) {
    return (
      <div className="p-6">
        <div className="page-header"><h1>{t('stockOpname.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('stockOpname.title')}</h1></div>

      <form onSubmit={handleSubmit}>
        <div className="adj-box" style={{ marginBottom: 18 }}>
          <div className="adj-box-header">
            <ClipboardCheck size={16} />
            <div>
              <div className="adj-box-title">{t('stockOpname.boxTitle')}</div>
              <div className="adj-box-desc">{t('stockOpname.boxDesc')}</div>
            </div>
          </div>
          <div className="dimension-row" style={{ marginTop: 14 }}>
            <div className="field">
              <label>{t('stockOpname.branchRequired')}</label>
              <select value={cc.costCenterId} onChange={(e) => cc.setCostCenterId(e.target.value)} required>
                <option value="">{t('transaksi.select')}</option>
                {cc.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('stockOpname.date')}</label>
              <DateField value={date} onChange={setDate} required />
            </div>
            <div className="field">
              <label>{t('transaksi.note')}</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('stockOpname.notePlaceholder')} required />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <ReceiptUpload file={receiptFile} setFile={setReceiptFile} />
          </div>
        </div>

        {cc.costCenterId && (
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('produk.colCode')}</th><th>{t('produk.colName')}</th>
                <th className="num">{t('stockOpname.colSystemQty')}</th>
                <th className="num">{t('stockOpname.colCountedQty')}</th>
                <th className="num">{t('stockOpname.colDiff')}</th>
                <th className="num">{t('stockOpname.colUnitCost')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const entry = counted[p.id] || {}
                const countedQty = entry.qty === undefined || entry.qty === '' ? null : Number(entry.qty)
                const systemQty = branchStock[p.id]?.qty || 0
                const diff = countedQty === null ? 0 : countedQty - systemQty
                const needsCost = diff > 0 && !branchStock[p.id]?.avgCost
                return (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td className="num">{systemQty.toLocaleString(i18n.language)}</td>
                    <td className="num" style={{ maxWidth: 120 }}>
                      <input
                        type="number" step="any" placeholder={t('stockOpname.countPlaceholder')}
                        value={entry.qty ?? ''} onChange={(e) => setCount(p.id, 'qty', e.target.value)}
                        style={{ textAlign: 'right', width: 100 }}
                      />
                    </td>
                    <td className="num" style={{ color: diff < 0 ? 'var(--negative)' : diff > 0 ? 'var(--positive)' : undefined, fontWeight: diff !== 0 ? 700 : 400 }}>
                      {diff !== 0 ? (diff > 0 ? `+${diff.toLocaleString(i18n.language)}` : diff.toLocaleString(i18n.language)) : '-'}
                    </td>
                    <td className="num" style={{ maxWidth: 140 }}>
                      {needsCost ? (
                        <input
                          type="number" step="any" placeholder={t('stockOpname.unitCostPlaceholder')}
                          value={entry.unit_cost ?? ''} onChange={(e) => setCount(p.id, 'unit_cost', e.target.value)}
                          style={{ textAlign: 'right', width: 110 }}
                        />
                      ) : diff > 0 ? (branchStock[p.id]?.avgCost || 0).toLocaleString(i18n.language) : '-'}
                    </td>
                  </tr>
                )
              })}
              {!products.length && <tr><td colSpan={6} className="empty">{t('produk.noProducts')}</td></tr>}
            </tbody>
          </table>
        )}

        {error && <p className="error" style={{ marginTop: 14 }}>{error}</p>}

        <button type="submit" className="btn-primary" disabled={saving || !rowsWithDiff.length} style={{ marginTop: 16 }}>
          {saving ? t('transaksi.saving') : t('stockOpname.save', { count: rowsWithDiff.length })}
        </button>
      </form>
    </div>
  )
}
