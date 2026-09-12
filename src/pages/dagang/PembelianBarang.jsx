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
function newLine() { lineIdCounter += 1; return { id: lineIdCounter, product_id: '', qty: 1, unit_cost: 0 } }

export default function PembelianBarang() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [contacts, setContacts] = useState([])
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const cc = useCostCenterFilter(companyId)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [contactId, setContactId] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([newLine()])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)

  useEffect(() => {
    if (!companyId) return
    supabase.from('products').select('id, code, name, unit').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
    supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name')
      .then(({ data }) => setContacts(data || []))
    // Akun pembayaran: kas/bank (bayar langsung) atau hutang (belum bayar)
    supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).in('category', ['kas_bank', 'hutang']).order('code')
      .then(({ data }) => setPaymentAccounts(data || []))
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
    if (!paymentAccountId) { setError(t('pembelianBarang.errPaymentAccount')); return }
    if (!cc.costCenterId) { setError(t('pembelianBarang.errBranchRequired')); return }
    if (lines.some((l) => !l.product_id || !l.qty || l.qty <= 0)) { setError(t('pembelianBarang.errLines')); return }
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
    const { error } = await supabase.rpc('record_purchase', {
      p_company_id: companyId,
      p_date: new Date(date).toISOString(),
      p_contact_id: contactId || null,
      p_note: note.trim(),
      p_payment_account_id: paymentAccountId,
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
        <div className="page-header"><h1>{t('pembelianBarang.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('pembelianBarang.title')}</h1></div>

      <form className="txn-form-panel" onSubmit={handleSubmit} style={{ maxWidth: 1100 }}>
        <div className="dimension-row">
          <div className="field">
            <label>{t('transaksi.dateTime')}</label>
            <DateTimeField value={date} onChange={setDate} required />
          </div>
          <div className="field">
            <label>{t('pembelianBarang.supplier')}</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">{t('transaksi.select')}</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('pembelianBarang.branchRequired')}</label>
            <select value={cc.costCenterId} onChange={(e) => cc.setCostCenterId(e.target.value)} required>
              <option value="">{t('transaksi.select')}</option>
              {cc.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            {!cc.costCenters.length && <p className="hint" style={{ marginTop: 4 }}>{t('pembelianBarang.noBranchHint')}</p>}
          </div>
        </div>

        <div className="field">
          <label>{t('pembelianBarang.paymentAccount')}</label>
          <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} required>
            <option value="">{t('transaksi.selectAccount')}</option>
            {paymentAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
          </select>
        </div>

        <div className="adj-box">
          <div className="adj-lines">
            {lines.map((line, idx) => (
              <div className="adj-line" key={line.id} style={{ gridTemplateColumns: '22px 2fr 1fr 1fr 30px' }}>
                <span className="adj-line-no">{idx + 1}</span>
                <select value={line.product_id} onChange={(e) => updateLine(line.id, { product_id: e.target.value })} required>
                  <option value="">{t('pembelianBarang.selectProduct')}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
                <div className="adj-line-amount">
                  <label>{t('pembelianBarang.qty')}</label>
                  <input type="number" min="0.01" step="any" value={line.qty} onChange={(e) => updateLine(line.id, { qty: e.target.value })} />
                </div>
                <div className="adj-line-amount">
                  <label>{t('pembelianBarang.unitCost')}</label>
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
          {saving ? t('transaksi.saving') : t('pembelianBarang.save')}
        </button>
      </form>
    </div>
  )
}
