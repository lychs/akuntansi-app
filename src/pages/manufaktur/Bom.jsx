import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ListTree } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function Bom() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()

  const [boms, setBoms] = useState([])
  const [finishedGoods, setFinishedGoods] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [productId, setProductId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [items, setItems] = useState([{ id: crypto.randomUUID(), component_product_id: '', qty_per_unit: '', waste_percentage: 0 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data: bomData } = await supabase
      .from('manufacturing_boms')
      .select('id, version, status, effective_date, note, product_id, products!manufacturing_boms_product_id_fkey(name, code)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    setBoms(bomData || [])
    const { data: products } = await supabase.from('products').select('id, code, name, item_type').eq('company_id', companyId).order('name')
    setFinishedGoods((products || []).filter((p) => p.item_type === 'finished_goods'))
    setRawMaterials((products || []).filter((p) => p.item_type !== 'finished_goods'))
  }

  function addItem() {
    setItems([...items, { id: crypto.randomUUID(), component_product_id: '', qty_per_unit: '', waste_percentage: 0 }])
  }
  function removeItem(id) {
    setItems(items.filter((i) => i.id !== id))
  }
  function updateItem(id, patch) {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    if (!productId) { setError(t('bom.errProductRequired')); return }
    const validItems = items.filter((i) => i.component_product_id && Number(i.qty_per_unit) > 0)
    if (!validItems.length) { setError(t('bom.errItemsRequired')); return }

    setSaving(true)
    // Versi BOM = max versi existing utk produk ini + 1 (BOM lama TIDAK diubah/dihapus)
    const { data: existing } = await supabase.from('manufacturing_boms').select('version').eq('company_id', companyId).eq('product_id', productId).order('version', { ascending: false }).limit(1)
    const nextVersion = existing?.length ? existing[0].version + 1 : 1

    const { data: bom, error: e1 } = await supabase.from('manufacturing_boms')
      .insert({ company_id: companyId, product_id: productId, version: nextVersion, effective_date: effectiveDate, note: note || null })
      .select('id').single()
    if (e1) { setSaving(false); setError(e1.message); return }

    const { error: e2 } = await supabase.from('manufacturing_bom_items').insert(
      validItems.map((i) => ({ bom_id: bom.id, component_product_id: i.component_product_id, qty_per_unit: Number(i.qty_per_unit), waste_percentage: Number(i.waste_percentage) || 0 }))
    )
    setSaving(false)
    if (e2) { setError(e2.message); return }

    setProductId(''); setNote(''); setItems([{ id: crypto.randomUUID(), component_product_id: '', qty_per_unit: '', waste_percentage: 0 }])
    setShowForm(false)
    load()
  }

  async function handleDeactivate(bomId) {
    if (!confirm(t('bom.confirmDeactivate'))) return
    await supabase.from('manufacturing_boms').update({ status: 'inactive' }).eq('id', bomId)
    load()
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1><ListTree size={20} style={{ verticalAlign: -3, marginRight: 8 }} />{t('bom.title')}</h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={15} style={{ verticalAlign: -2, marginRight: 4 }} />{showForm ? t('costCenter.closeForm') : t('bom.addBom')}
          </button>
        )}
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('bom.pageHint')}</p>
      {!canEdit && <ViewerNotice />}

      {canEdit && showForm && (
        <form className="section inline-form" style={{ flexDirection: 'column', alignItems: 'stretch' }} onSubmit={handleSave}>
          <div className="txn-form-row">
            <div className="field">
              <label>{t('bom.finishedProduct')}</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">{t('transaksi.select')}</option>
                {finishedGoods.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('bom.effectiveDate')}</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('transaksi.note')}</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <h4 style={{ margin: '16px 0 8px' }}>{t('bom.components')}</h4>
          {items.map((item) => (
            <div className="txn-form-row" key={item.id} style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 2 }}>
                <label>{t('bom.component')}</label>
                <select value={item.component_product_id} onChange={(e) => updateItem(item.id, { component_product_id: e.target.value })}>
                  <option value="">{t('transaksi.select')}</option>
                  {rawMaterials.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t('bom.qtyPerUnit')}</label>
                <input type="number" step="any" min="0" value={item.qty_per_unit} onChange={(e) => updateItem(item.id, { qty_per_unit: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('bom.wastePercent')}</label>
                <input type="number" step="any" min="0" max="99" value={item.waste_percentage} onChange={(e) => updateItem(item.id, { waste_percentage: e.target.value })} />
              </div>
              <button type="button" className="btn-icon-danger" onClick={() => removeItem(item.id)} title={t('common.delete')}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn-secondary" style={{ width: 'fit-content', marginTop: 8 }} onClick={addItem}>
            <Plus size={13} style={{ verticalAlign: -2 }} /> {t('bom.addComponent')}
          </button>

          {error && <p className="error">{error}</p>}
          <button className="btn-primary" style={{ width: 'fit-content', marginTop: 16 }} disabled={saving}>
            {saving ? t('transaksi.saving') : t('costCenter.save')}
          </button>
        </form>
      )}

      <table className="tbl">
        <thead>
          <tr><th>{t('bom.colProduct')}</th><th>{t('bom.colVersion')}</th><th>{t('bom.colEffectiveDate')}</th><th>{t('bom.colStatus')}</th>{canEdit && <th></th>}</tr>
        </thead>
        <tbody>
          {boms.map((b) => (
            <tr key={b.id}>
              <td>{b.products?.name} ({b.products?.code})</td>
              <td>v{b.version}</td>
              <td>{b.effective_date}</td>
              <td><span className={`badge ${b.status === 'active' ? 'lunas' : 'pending'}`}>{b.status === 'active' ? t('bom.statusActive') : t('bom.statusInactive')}</span></td>
              {canEdit && (
                <td>
                  {b.status === 'active' && (
                    <button className="btn-icon-danger" onClick={() => handleDeactivate(b.id)} title={t('bom.deactivate')}><Trash2 size={14} /></button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {!boms.length && <tr><td colSpan={5} className="empty">{t('bom.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
