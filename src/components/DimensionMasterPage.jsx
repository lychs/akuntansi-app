import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import ViewerNotice from './ViewerNotice.jsx'

// Halaman master data generik dipakai berulang buat Department / Project /
// Warehouse (strukturnya identik: kode, nama, deskripsi) — biar gak nulis 3x
// kode yang sama persis.
export default function DimensionMasterPage({ table, i18nKey }) {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId, table])

  async function load() {
    const { data, error } = await supabase.from(table).select('id, code, name, description').eq('company_id', companyId).order('code')
    if (error) setError(error.message)
    else setItems(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.from(table).insert({ company_id: companyId, ...form })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ code: '', name: '', description: '' })
    setShowForm(false)
    load()
  }

  async function handleDelete(item) {
    if (!confirm(t('common.confirmDelete', { name: item.name }))) return
    setError(null)
    const { error } = await supabase.from(table).delete().eq('id', item.id)
    if (error) { setError(error.message); return }
    load()
  }

  const filtered = items.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="p-6">
      <div className="page-header">
        <h1>{t(`${i18nKey}.title`)}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <input placeholder={t(`${i18nKey}.searchPlaceholder`)} value={q} onChange={(e) => setQ(e.target.value)} />
          {canEdit && (
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? t(`${i18nKey}.closeForm`) : t(`${i18nKey}.addItem`)}
            </button>
          )}
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>{t(`${i18nKey}.pageHint`)}</p>
      {!canEdit && <ViewerNotice />}

      {canEdit && showForm && (
        <form className="section inline-form" onSubmit={handleAdd}>
          <div className="field">
            <label>{t(`${i18nKey}.code`)}</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="field">
            <label>{t(`${i18nKey}.name`)}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>{t(`${i18nKey}.description`)}</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? t(`${i18nKey}.saving`) : t(`${i18nKey}.save`)}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <table className="tbl">
        <thead>
          <tr><th>{t(`${i18nKey}.colCode`)}</th><th>{t(`${i18nKey}.colName`)}</th><th>{t(`${i18nKey}.colDescription`)}</th>{canEdit && <th></th>}</tr>
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
          {!filtered.length && <tr><td colSpan={4} className="empty">{t(`${i18nKey}.noItems`)}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
