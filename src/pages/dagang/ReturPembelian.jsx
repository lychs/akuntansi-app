import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'

export default function ReturPembelian() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const cc = useCostCenterFilter(companyId)

  const [products, setProducts] = useState([])
  const [contacts, setContacts] = useState([])
  const [refundAccounts, setRefundAccounts] = useState([])
  const [productId, setProductId] = useState('')
  const [contactId, setContactId] = useState('')
  const [refundAccountId, setRefundAccountId] = useState('')
  const [qty, setQty] = useState('')
  const [stock, setStock] = useState(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!companyId) return
    supabase.from('products').select('id, code, name, unit').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
    supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name')
      .then(({ data }) => setContacts(data || []))
    supabase.from('accounts').select('id, code, name').eq('company_id', companyId).in('category', ['kas_bank', 'hutang']).order('code')
      .then(({ data }) => setRefundAccounts(data || []))
  }, [companyId])

  useEffect(() => {
    if (!productId || !cc.costCenterId) { setStock(null); return }
    supabase.rpc('get_branch_stock', { p_product_id: productId, p_cost_center_id: cc.costCenterId })
      .then(({ data }) => setStock(Number(data) || 0))
  }, [productId, cc.costCenterId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!productId || !cc.costCenterId || !refundAccountId) { setError(t('returPembelian.errFieldsRequired')); return }
    if (!qty || Number(qty) <= 0) { setError(t('transferAntarCabang.errQtyInvalid')); return }
    if (stock !== null && Number(qty) > stock) { setError(t('penjualanBarang.errInsufficientStock')); return }
    if (!note.trim()) { setError(t('transaksi.errNote')); return }

    setSaving(true)
    const { error } = await supabase.rpc('record_purchase_return', {
      p_company_id: companyId,
      p_date: new Date(date).toISOString(),
      p_contact_id: contactId || null,
      p_product_id: productId,
      p_cost_center_id: cc.costCenterId,
      p_qty: Number(qty),
      p_refund_account_id: refundAccountId,
      p_note: note.trim(),
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(t('returPembelian.successMsg'))
    setQty(''); setNote('')
  }

  if (!canEdit) {
    return (
      <div className="p-6">
        <div className="page-header"><h1>{t('returPembelian.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('returPembelian.title')}</h1></div>

      <div className="adj-box" style={{ marginBottom: 18 }}>
        <div className="adj-box-header">
          <Undo2 size={16} />
          <div>
            <div className="adj-box-title">{t('returPembelian.boxTitle')}</div>
            <div className="adj-box-desc">{t('returPembelian.boxDesc')}</div>
          </div>
        </div>
      </div>

      <form className="txn-form-panel" onSubmit={handleSubmit} style={{ maxWidth: 900 }}>
        <div className="dimension-row">
          <div className="field">
            <label>{t('pembelianBarang.branchRequired')}</label>
            <select value={cc.costCenterId} onChange={(e) => cc.setCostCenterId(e.target.value)} required>
              <option value="">{t('transaksi.select')}</option>
              {cc.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('returPembelian.product')}</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">{t('pembelianBarang.selectProduct')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('pembelianBarang.supplier')}</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">{t('transaksi.select')}</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="txn-form-row">
          <div className="field">
            <label>{t('transferAntarCabang.qty')}{stock !== null ? ` (${t('penjualanBarang.stockLabel')}: ${stock.toLocaleString(i18n.language)})` : ''}</label>
            <input type="number" min="0.01" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('returPembelian.refundAccount')}</label>
            <select value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {refundAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
        </div>

        <div className="txn-form-row">
          <div className="field">
            <label>{t('saldoAwalPersediaan.date')}</label>
            <DateField value={date} onChange={setDate} required />
          </div>
          <div className="field">
            <label>{t('transaksi.note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} required />
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p style={{ color: 'var(--positive)', fontSize: 13 }}>{success}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('transaksi.saving') : t('returPembelian.save')}
        </button>
      </form>
    </div>
  )
}
