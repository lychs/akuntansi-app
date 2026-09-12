import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, PackagePlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'
import ReceiptUpload, { uploadReceiptIfNeeded } from '../../components/ReceiptUpload.jsx'

let lineIdCounter = 0
function newLine() { lineIdCounter += 1; return { id: lineIdCounter, product_id: '', qty: '', unit_cost: 0 } }

export default function SaldoAwalPersediaan() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const cc = useCostCenterFilter(companyId)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState(t('saldoAwalPersediaan.notePlaceholder'))
  const [lines, setLines] = useState([newLine()])
  const [error, setError] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!companyId) return
    supabase.from('products').select('id, code, name, unit, qty_on_hand').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
  }, [companyId])

  function updateLine(id, patch) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function addLine() { setLines((ls) => [...ls, newLine()]) }
  function removeLine(id) { setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls)) }

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (lines.some((l) => !l.product_id || !l.qty || Number(l.qty) <= 0)) { setError(t('pembelianBarang.errLines')); return }
    if (!cc.costCenterId) { setError(t('saldoAwalPersediaan.errBranchRequired')); return }
    if (!note.trim()) { setError(t('transaksi.errNote')); return }

    setSaving(true)
    let receiptPath = null
    try {
      receiptPath = await uploadReceiptIfNeeded(supabase, companyId, receiptFile)
    } catch (uploadErr) {
      setSaving(false)
      setError(uploadErr.message)
      return
    }
    const { error } = await supabase.rpc('record_opening_stock', {
      p_company_id: companyId,
      p_date: new Date(date).toISOString(),
      p_note: note.trim(),
      p_lines: lines.map((l) => ({ product_id: l.product_id, qty: Number(l.qty), unit_cost: Number(l.unit_cost) })),
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
        <div className="page-header"><h1>{t('saldoAwalPersediaan.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('saldoAwalPersediaan.title')}</h1></div>

      <div className="adj-box" style={{ marginBottom: 18, borderStyle: 'solid' }}>
        <div className="adj-box-header">
          <PackagePlus size={16} />
          <div>
            <div className="adj-box-title">{t('saldoAwalPersediaan.boxTitle')}</div>
            <div className="adj-box-desc">{t('saldoAwalPersediaan.boxDesc')}</div>
          </div>
        </div>
      </div>

      <form className="txn-form-panel" onSubmit={handleSubmit} style={{ maxWidth: 1100 }}>
        <div className="dimension-row">
          <div className="field">
            <label>{t('saldoAwalPersediaan.branchRequired')}</label>
            <select value={cc.costCenterId} onChange={(e) => cc.setCostCenterId(e.target.value)} required>
              <option value="">{t('transaksi.select')}</option>
              {cc.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('saldoAwalPersediaan.date')}</label>
            <DateField value={date} onChange={setDate} required />
          </div>
          <div className="field">
            <label>{t('transaksi.note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} required />
          </div>
        </div>

        <ReceiptUpload file={receiptFile} setFile={setReceiptFile} />

        <div className="adj-box">
          <div className="adj-lines">
            {lines.map((line, idx) => (
              <div className="adj-line" key={line.id} style={{ gridTemplateColumns: '22px 2fr 1fr 1fr 30px' }}>
                <span className="adj-line-no">{idx + 1}</span>
                <select value={line.product_id} onChange={(e) => updateLine(line.id, { product_id: e.target.value })} required>
                  <option value="">{t('pembelianBarang.selectProduct')}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code}) — {t('saldoAwalPersediaan.currentStock')}: {Number(p.qty_on_hand).toLocaleString(i18n.language)}</option>
                  ))}
                </select>
                <div className="adj-line-amount">
                  <label>{t('pembelianBarang.qty')}</label>
                  <input type="number" min="0.01" step="any" value={line.qty} onChange={(e) => updateLine(line.id, { qty: e.target.value })} placeholder={t('saldoAwalPersediaan.qtyPlaceholder')} />
                </div>
                <div className="adj-line-amount">
                  <label>{t('saldoAwalPersediaan.unitCost')}</label>
                  <CurrencyInput value={line.unit_cost} onChange={(v) => updateLine(line.id, { unit_cost: v })} />
                </div>
                <button type="button" className="btn-icon-danger" onClick={() => removeLine(line.id)} disabled={lines.length <= 1} title={t('transaksi.adjRemoveLine')}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary adj-add-line-btn" onClick={addLine}>
            <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('pembelianBarang.addLine')}
          </button>
          <div className="adj-balance-bar ok" style={{ justifyContent: 'flex-end' }}>
            <div><span>{t('saldoAwalPersediaan.totalValue')}</span><strong>{total.toLocaleString(i18n.language)}</strong></div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('transaksi.saving') : t('saldoAwalPersediaan.save')}
        </button>
      </form>
    </div>
  )
}
