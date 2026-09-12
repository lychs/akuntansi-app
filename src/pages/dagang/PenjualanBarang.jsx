import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateTimeField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'
import ReceiptUpload, { uploadReceiptIfNeeded } from '../../components/ReceiptUpload.jsx'

let lineIdCounter = 0
function newLine() { lineIdCounter += 1; return { id: lineIdCounter, product_id: '', qty: 1, sale_price: 0, layer_id: '', layers: [], stock: null } }

export default function PenjualanBarang() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit, companies } = useCompany()
  const inventoryMethod = companies.find((c) => c.id === companyId)?.inventoryMethod
  const isSpecific = inventoryMethod === 'specific'
  const navigate = useNavigate()
  const cc = useCostCenterFilter(companyId)

  const [products, setProducts] = useState([])
  const [contacts, setContacts] = useState([])
  const [receiveAccounts, setReceiveAccounts] = useState([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [contactId, setContactId] = useState('')
  const [receiveAccountId, setReceiveAccountId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([newLine()])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)

  useEffect(() => {
    if (!companyId) return
    supabase.from('products').select('id, code, name, unit, sale_price').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
    supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name')
      .then(({ data }) => setContacts(data || []))
    supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).in('category', ['kas_bank', 'piutang']).order('code')
      .then(({ data }) => setReceiveAccounts(data || []))
  }, [companyId])

  // Ganti cabang → refresh stok tiap baris yang udah pilih produk
  useEffect(() => {
    if (!cc.costCenterId) return
    lines.forEach((l) => { if (l.product_id) refreshLineStock(l.id, l.product_id) })
  }, [cc.costCenterId])

  async function refreshLineStock(lineId, productId) {
    if (!cc.costCenterId) return
    const { data: stock } = await supabase.rpc('get_branch_stock', { p_product_id: productId, p_cost_center_id: cc.costCenterId })
    let layers = []
    if (isSpecific) {
      const { data } = await supabase.rpc('get_available_layers', { p_product_id: productId, p_cost_center_id: cc.costCenterId })
      layers = data || []
    }
    setLines((ls) => ls.map((l) => (l.id === lineId ? { ...l, stock: Number(stock) || 0, layers, layer_id: '' } : l)))
  }

  async function updateLine(id, patch) {
    setLines((ls) => ls.map((l) => {
      if (l.id !== id) return l
      const merged = { ...l, ...patch }
      if (patch.product_id && !l.sale_price) {
        const p = products.find((pp) => pp.id === patch.product_id)
        if (p) merged.sale_price = p.sale_price
      }
      return merged
    }))
    if (patch.product_id) await refreshLineStock(id, patch.product_id)
  }
  function addLine() { setLines((ls) => [...ls, newLine()]) }
  function removeLine(id) { setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls)) }

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.sale_price) || 0), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!cc.costCenterId) { setError(t('penjualanBarang.errBranchRequired')); return }
    if (!receiveAccountId) { setError(t('penjualanBarang.errReceiveAccount')); return }
    if (lines.some((l) => !l.product_id || !l.qty || l.qty <= 0)) { setError(t('pembelianBarang.errLines')); return }
    if (isSpecific && lines.some((l) => !l.layer_id)) { setError(t('penjualanBarang.errLayerRequired')); return }
    const overSold = lines.find((l) => l.stock !== null && Number(l.qty) > Number(l.stock))
    if (overSold) { setError(t('penjualanBarang.errInsufficientStock')); return }
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
    const { error } = await supabase.rpc('record_sale', {
      p_company_id: companyId,
      p_date: new Date(date).toISOString(),
      p_contact_id: contactId || null,
      p_note: note.trim(),
      p_receive_account_id: receiveAccountId,
      p_lines: lines.map((l) => ({
        product_id: l.product_id, qty: Number(l.qty), sale_price: Number(l.sale_price),
        ...(isSpecific ? { layer_id: l.layer_id } : {}),
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
        <div className="page-header"><h1>{t('penjualanBarang.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('penjualanBarang.title')}</h1></div>

      <form className="txn-form-panel" onSubmit={handleSubmit} style={{ maxWidth: 1100 }}>
        <div className="dimension-row">
          <div className="field">
            <label>{t('transaksi.dateTime')}</label>
            <DateTimeField value={date} onChange={setDate} required />
          </div>
          <div className="field">
            <label>{t('penjualanBarang.customer')}</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">{t('transaksi.select')}</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('penjualanBarang.branchRequired')}</label>
            <select value={cc.costCenterId} onChange={(e) => cc.setCostCenterId(e.target.value)} required>
              <option value="">{t('transaksi.select')}</option>
              {cc.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            {!cc.costCenters.length && <p className="hint" style={{ marginTop: 4 }}>{t('pembelianBarang.noBranchHint')}</p>}
          </div>
        </div>

        <div className="field">
          <label>{t('penjualanBarang.receiveAccount')}</label>
          <select value={receiveAccountId} onChange={(e) => setReceiveAccountId(e.target.value)} required>
            <option value="">{t('transaksi.selectAccount')}</option>
            {receiveAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
          </select>
        </div>

        {isSpecific && (
          <p className="hint">{t('penjualanBarang.specificHint')}</p>
        )}

        <div className="adj-box">
          <div className="adj-lines">
            {lines.map((line, idx) => {
              const over = line.stock !== null && Number(line.qty) > Number(line.stock)
              return (
                <div key={line.id}>
                  <div className="adj-line" style={{ gridTemplateColumns: isSpecific ? '22px 1.6fr 1.4fr 0.8fr 1fr 30px' : '22px 2fr 1fr 1fr 30px' }}>
                    <span className="adj-line-no">{idx + 1}</span>
                    <select value={line.product_id} onChange={(e) => updateLine(line.id, { product_id: e.target.value })} required disabled={!cc.costCenterId}>
                      <option value="">{t('pembelianBarang.selectProduct')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                    {isSpecific && (
                      <select value={line.layer_id} onChange={(e) => updateLine(line.id, { layer_id: e.target.value })} required disabled={!line.product_id}>
                        <option value="">{t('penjualanBarang.selectLayer')}</option>
                        {line.layers.map((ly) => (
                          <option key={ly.id} value={ly.id}>
                            {ly.purchase_date} — {Number(ly.qty_remaining).toLocaleString(i18n.language)} @ {Number(ly.unit_cost).toLocaleString(i18n.language)}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="adj-line-amount">
                      <label>{t('pembelianBarang.qty')}{line.stock !== null ? ` (${t('penjualanBarang.stockLabel')}: ${line.stock.toLocaleString(i18n.language)})` : ''}</label>
                      <input type="number" min="0.01" step="any" value={line.qty} onChange={(e) => updateLine(line.id, { qty: e.target.value })} />
                    </div>
                    <div className="adj-line-amount">
                      <label>{t('penjualanBarang.salePrice')}</label>
                      <CurrencyInput value={line.sale_price} onChange={(v) => updateLine(line.id, { sale_price: v })} />
                    </div>
                    <button type="button" className="btn-icon-danger" onClick={() => removeLine(line.id)} disabled={lines.length <= 1} title={t('transaksi.adjRemoveLine')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {over && <p className="error" style={{ margin: '2px 0 0 30px', fontSize: 11.5 }}>{t('penjualanBarang.errInsufficientStock')}</p>}
                </div>
              )
            })}
          </div>
          <button type="button" className="btn-secondary adj-add-line-btn" onClick={addLine} disabled={!cc.costCenterId}>
            <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('pembelianBarang.addLine')}
          </button>
          <div className="adj-balance-bar ok" style={{ justifyContent: 'flex-end' }}>
            <div><span>{t('pembelianBarang.total')}</span><strong>{total.toLocaleString(i18n.language)}</strong></div>
          </div>
        </div>

        <div className="field">
          <label>{t('transaksi.note')}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} required />
        </div>
        <ReceiptUpload file={receiptFile} setFile={setReceiptFile} />

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('transaksi.saving') : t('penjualanBarang.save')}
        </button>
      </form>
    </div>
  )
}
