import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'

export default function ReturPenjualan() {
  const { t } = useTranslation()
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
  const [salePrice, setSalePrice] = useState(0)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!companyId) return
    supabase.from('products').select('id, code, name, unit, sale_price').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
    supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name')
      .then(({ data }) => setContacts(data || []))
    supabase.from('accounts').select('id, code, name').eq('company_id', companyId).in('category', ['kas_bank', 'piutang']).order('code')
      .then(({ data }) => setRefundAccounts(data || []))
  }, [companyId])

  function handleProductChange(id) {
    setProductId(id)
    const p = products.find((pp) => pp.id === id)
    if (p) setSalePrice(p.sale_price)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!productId || !cc.costCenterId || !refundAccountId) { setError(t('returPembelian.errFieldsRequired')); return }
    if (!qty || Number(qty) <= 0) { setError(t('transferAntarCabang.errQtyInvalid')); return }
    if (!note.trim()) { setError(t('transaksi.errNote')); return }

    setSaving(true)
    const { error } = await supabase.rpc('record_sales_return', {
      p_company_id: companyId,
      p_date: new Date(date).toISOString(),
      p_contact_id: contactId || null,
      p_product_id: productId,
      p_cost_center_id: cc.costCenterId,
      p_qty: Number(qty),
      p_sale_price: Number(salePrice),
      p_refund_account_id: refundAccountId,
      p_note: note.trim(),
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(t('returPenjualan.successMsg'))
    setQty(''); setNote('')
  }

  if (!canEdit) {
    return (
      <div className="p-6">
        <div className="page-header"><h1>{t('returPenjualan.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('returPenjualan.title')}</h1></div>

      <div className="adj-box" style={{ marginBottom: 18 }}>
        <div className="adj-box-header">
          <Undo2 size={16} />
          <div>
            <div className="adj-box-title">{t('returPenjualan.boxTitle')}</div>
            <div className="adj-box-desc">{t('returPenjualan.boxDesc')}</div>
          </div>
        </div>
      </div>

      <form className="txn-form-panel" onSubmit={handleSubmit} style={{ maxWidth: 900 }}>
        <div className="dimension-row">
          <div className="field">
            <label>{t('penjualanBarang.branchRequired')}</label>
            <select value={cc.costCenterId} onChange={(e) => cc.setCostCenterId(e.target.value)} required>
              <option value="">{t('transaksi.select')}</option>
              {cc.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('returPembelian.product')}</label>
            <select value={productId} onChange={(e) => handleProductChange(e.target.value)} required>
              <option value="">{t('pembelianBarang.selectProduct')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('penjualanBarang.customer')}</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">{t('transaksi.select')}</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="txn-form-row">
          <div className="field">
            <label>{t('transferAntarCabang.qty')}</label>
            <input type="number" min="0.01" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('penjualanBarang.salePrice')}</label>
            <CurrencyInput value={salePrice} onChange={setSalePrice} required />
          </div>
        </div>

        <div className="txn-form-row">
          <div className="field">
            <label>{t('returPenjualan.refundAccount')}</label>
            <select value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)} required>
              <option value="">{t('transaksi.selectAccount')}</option>
              {refundAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('saldoAwalPersediaan.date')}</label>
            <DateField value={date} onChange={setDate} required />
          </div>
        </div>

        <div className="field">
          <label>{t('transaksi.note')}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} required />
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p style={{ color: 'var(--positive)', fontSize: 13 }}>{success}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('transaksi.saving') : t('returPenjualan.save')}
        </button>
      </form>
    </div>
  )
}
