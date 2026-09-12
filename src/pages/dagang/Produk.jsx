import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function Produk() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', unit: 'pcs', sale_price: 0 })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [branchStock, setBranchStock] = useState([])

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, unit, sale_price, qty_on_hand, avg_unit_cost')
      .eq('company_id', companyId)
      .order('code')
    if (error) setError(error.message)
    else setProducts(data || [])
  }

  async function toggleExpand(p) {
    if (expandedId === p.id) { setExpandedId(null); return }
    setExpandedId(p.id)
    const { data } = await supabase
      .from('product_branch_stock')
      .select('qty_on_hand, avg_unit_cost, cost_centers ( id, code, name )')
      .eq('product_id', p.id)
      .gt('qty_on_hand', 0)
    setBranchStock(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.rpc('create_product', {
      p_company_id: companyId,
      p_code: form.code,
      p_name: form.name,
      p_unit: form.unit,
      p_sale_price: form.sale_price,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ code: '', name: '', unit: 'pcs', sale_price: 0 })
    setShowForm(false)
    load()
  }

  async function handleDelete(p) {
    if (!confirm(t('common.confirmDelete', { name: p.name }))) return
    setError(null)
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) { setError(error.message); return }
    load()
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="p-6">
      <div className="page-header">
        <h1>{t('produk.title')}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <input placeholder={t('produk.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? t('produk.closeForm') : t('produk.addProduct')}
            </button>
          )}
        </div>
      </div>
      {!canEdit && <ViewerNotice />}

      {canEdit && showForm && (
        <form className="section inline-form" onSubmit={handleAdd}>
          <div className="field">
            <label>{t('produk.code')}</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="field">
            <label>{t('produk.name')}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>{t('produk.unit')}</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" />
          </div>
          <div className="field">
            <label>{t('produk.salePrice')}</label>
            <CurrencyInput value={form.sale_price} onChange={(v) => setForm({ ...form, sale_price: v })} required />
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? t('produk.saving') : t('produk.save')}</button>
          <p className="hint" style={{ flexBasis: '100%', marginTop: 0 }}>{t('produk.initialStockHint')}</p>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <table className="tbl">
        <thead>
          <tr>
            <th></th><th>{t('produk.colCode')}</th><th>{t('produk.colName')}</th><th>{t('produk.colUnit')}</th>
            <th className="num">{t('produk.colSalePrice')}</th><th className="num">{t('produk.colQtyOnHand')}</th>
            <th className="num">{t('produk.colAvgCost')}</th>{canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <Fragment key={p.id}>
              <tr>
                <td style={{ width: 28 }}>
                  <button className="btn-icon-danger" style={{ color: 'var(--ink-muted)' }} onClick={() => toggleExpand(p)} title={t('produk.viewByBranch')}>
                    {expandedId === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </td>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.unit}</td>
                <td className="num">{Number(p.sale_price).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(p.qty_on_hand).toLocaleString(i18n.language)}</td>
                <td className="num">{Number(p.avg_unit_cost).toLocaleString(i18n.language)}</td>
                {canEdit && (
                  <td>
                    <button className="btn-icon-danger" onClick={() => handleDelete(p)} title={t('common.delete')}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
              {expandedId === p.id && (
                <tr>
                  <td colSpan={8} style={{ background: 'var(--surface-alt)', padding: 14 }}>
                    <div className="hint" style={{ fontWeight: 700, marginBottom: 8 }}>{t('produk.stockByBranch')}</div>
                    {branchStock.length ? (
                      <table className="tbl compact" style={{ maxWidth: 480 }}>
                        <thead><tr><th>{t('costCenter.colName')}</th><th className="num">{t('produk.colQtyOnHand')}</th><th className="num">{t('produk.colAvgCost')}</th></tr></thead>
                        <tbody>
                          {branchStock.map((bs, i) => (
                            <tr key={i}>
                              <td>{bs.cost_centers?.name} ({bs.cost_centers?.code})</td>
                              <td className="num">{Number(bs.qty_on_hand).toLocaleString(i18n.language)}</td>
                              <td className="num">{Number(bs.avg_unit_cost).toLocaleString(i18n.language)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="hint">{t('produk.noBranchStock')}</p>}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {!filtered.length && <tr><td colSpan={8} className="empty">{t('produk.noProducts')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
