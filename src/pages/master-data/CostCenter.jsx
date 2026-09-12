import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
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
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
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
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>{c.name}</td>
              <td>{c.description}</td>
              {canEdit && (
                <td>
                  <button className="btn-icon-danger" onClick={() => handleDelete(c)} title={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={4} className="empty">{t('costCenter.noItems')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
