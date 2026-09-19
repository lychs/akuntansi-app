import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function CostCenter() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '' })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ code: '', name: '', description: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('cost_centers')
      .select('id, code, name, description, is_active')
      .eq('company_id', companyId)
      .order('code')
    if (error) setError(error.message)
    else setItems(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.from('cost_centers').insert({ company_id: companyId, ...form })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ code: '', name: '', description: '' })
    setShowForm(false)
    load()
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({ code: item.code, name: item.name, description: item.description || '' })
    setShowForm(false)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.from('cost_centers').update(editForm).eq('id', editingId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setEditingId(null)
    load()
  }

  async function handleDelete(c) {
    if (!confirm(t('common.confirmDelete', { name: c.name }))) return
    setError(null)
    const { error } = await supabase.from('cost_centers').delete().eq('id', c.id)
    if (error) { setError(error.message); return }
    load()
  }

  const filtered = items.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="p-6">
      <div className="page-header">
        <h1>{t('costCenter.title')}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <input placeholder={t('costCenter.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          {canEdit && (
            <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
              {showForm ? t('costCenter.closeForm') : t('costCenter.addItem')}
            </button>
          )}
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('costCenter.pageHint')}</p>
      {!canEdit && <ViewerNotice />}

      {canEdit && showForm && (
        <form className="section inline-form" onSubmit={handleAdd}>
          <div className="field">
            <label>{t('costCenter.code')}</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="field">
            <label>{t('costCenter.name')}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>{t('costCenter.description')}</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? t('costCenter.saving') : t('costCenter.save')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <table className="tbl">
        <thead>
          <tr><th>{t('costCenter.colCode')}</th><th>{t('costCenter.colName')}</th><th>{t('costCenter.colDescription')}</th>{canEdit && <th></th>}</tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            editingId === c.id ? (
              <tr key={c.id}>
                <td colSpan={4} style={{ padding: 0 }}>
                  <form className="inline-form" style={{ padding: 14, margin: 0 }} onSubmit={handleSaveEdit}>
                    <div className="field">
                      <label>{t('costCenter.code')}</label>
                      <input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label>{t('costCenter.name')}</label>
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label>{t('costCenter.description')}</label>
                      <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    </div>
                    <button className="btn-primary" disabled={saving}>{saving ? t('costCenter.saving') : t('costCenter.save')}</button>
                    <button type="button" className="btn-icon" onClick={() => setEditingId(null)}><X size={14} /></button>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.description}</td>
                {canEdit && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-icon" onClick={() => startEdit(c)} title={t('common.edit')}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon-danger" onClick={() => handleDelete(c)} title={t('common.delete')}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            )
          ))}
          {!filtered.length && <tr><td colSpan={4} className="empty">{t('costCenter.noItems')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
