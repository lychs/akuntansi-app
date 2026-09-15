import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRightLeft } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import { useCostCenterFilter } from '../../components/CostCenterFilter.jsx'

export default function TransferAntarCabang() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const cc = useCostCenterFilter(companyId)

  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch] = useState('')
  const [qty, setQty] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [stockAtSource, setStockAtSource] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!companyId) return
    supabase.from('products').select('id, code, name, unit').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
  }, [companyId])

  useEffect(() => {
    if (!productId || !fromBranch) { setStockAtSource(null); return }
    supabase.rpc('get_branch_stock', { p_product_id: productId, p_cost_center_id: fromBranch })
      .then(({ data }) => setStockAtSource(Number(data) || 0))
  }, [productId, fromBranch])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!productId || !fromBranch || !toBranch) { setError(t('transferAntarCabang.errFieldsRequired')); return }
    if (fromBranch === toBranch) { setError(t('transferAntarCabang.errSameBranch')); return }
    if (!qty || Number(qty) <= 0) { setError(t('transferAntarCabang.errQtyInvalid')); return }
    if (stockAtSource !== null && Number(qty) > stockAtSource) { setError(t('penjualanBarang.errInsufficientStock')); return }

    setSaving(true)
    const { error } = await supabase.rpc('transfer_stock_between_branches', {
      p_company_id: companyId,
      p_product_id: productId,
      p_from_cost_center_id: fromBranch,
      p_to_cost_center_id: toBranch,
      p_qty: Number(qty),
      p_date: new Date(date).toISOString(),
      p_note: note.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(t('transferAntarCabang.successMsg'))
    setProductId(''); setQty(''); setNote('')
  }

  if (!canEdit) {
    return (
      <div className="p-6">
        <div className="page-header"><h1>{t('transferAntarCabang.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('transferAntarCabang.title')}</h1></div>

      <div className="adj-box" style={{ marginBottom: 18 }}>
        <div className="adj-box-header">
          <ArrowRightLeft size={16} />
          <div>
            <div className="adj-box-title">{t('transferAntarCabang.boxTitle')}</div>
            <div className="adj-box-desc">{t('transferAntarCabang.boxDesc')}</div>
          </div>
        </div>
      </div>

      <form className="txn-form-panel" onSubmit={handleSubmit} style={{ maxWidth: 800 }}>
        <div className="field">
          <label>{t('transferAntarCabang.product')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">{t('pembelianBarang.selectProduct')}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </div>

        <div className="txn-flow-box">
          <div className="txn-flow-side debit">
            <span className="txn-flow-badge debit">{t('transferAntarCabang.from')}</span>
            <select value={fromBranch} onChange={(e) => setFromBranch(e.target.value)} required>
              <option value="">{t('transaksi.select')}</option>
              {cc.costCenters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            {stockAtSource !== null && (
              <p className="hint" style={{ margin: 0 }}>{t('penjualanBarang.stockLabel')}: {stockAtSource.toLocaleString(i18n.language)}</p>
            )}
          </div>
          <div className="txn-flow-arrow"><ArrowRightLeft size={18} /></div>
          <div className="txn-flow-side credit">
            <span className="txn-flow-badge credit">{t('transferAntarCabang.to')}</span>
            <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} required>
              <option value="">{t('transaksi.select')}</option>
              {cc.costCenters.filter((c) => c.id !== fromBranch).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
        </div>

        <div className="txn-form-row">
          <div className="field">
            <label>{t('transferAntarCabang.qty')}</label>
            <input type="number" min="0.01" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('saldoAwalPersediaan.date')}</label>
            <DateField value={date} onChange={setDate} required />
          </div>
        </div>

        <div className="field">
          <label>{t('transaksi.note')}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('transferAntarCabang.notePlaceholder')} />
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p style={{ color: 'var(--positive)', fontSize: 13 }}>{success}</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('transaksi.saving') : t('transferAntarCabang.save')}
        </button>
      </form>
    </div>
  )
}
