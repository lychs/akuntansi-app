import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function Kontak() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [contacts, setContacts] = useState([])
  const [q, setQ] = useState('')
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const fromUrl = searchParams.get('q')
    if (fromUrl) setQ(fromUrl)
  }, [searchParams])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, email, phone, address')
      .eq('company_id', companyId)
      .order('name')
    if (error) setError(error.message)
    else setContacts(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.from('contacts').insert({ company_id: companyId, ...form })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ name: '', email: '', phone: '', address: '' })
    setShowForm(false)
    load()
  }

  async function handleDelete(c) {
    if (!confirm(t('common.confirmDelete', { name: c.name }))) return
    setError(null)
    const { error } = await supabase.from('contacts').delete().eq('id', c.id)
    if (error) { setError(error.message); return }
    load()
  }

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('kontak.title')}</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder={t('kontak.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
            {canEdit && (
              <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? t('kontak.closeForm') : t('kontak.addContact')}
              </button>
            )}
          </div>
        </div>
        {!canEdit && <ViewerNotice />}

        {canEdit && showForm && (
          <form className="section inline-form" onSubmit={handleAdd}>
            <div className="field">
              <label>{t('kontak.name')}</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>{t('kontak.email')}</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('kontak.phone')}</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('kontak.address')}</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <button className="btn-primary" disabled={saving}>{saving ? t('kontak.saving') : t('kontak.save')}</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}

        <table className="tbl">
          <thead>
            <tr><th>{t('kontak.colName')}</th><th>{t('kontak.colEmail')}</th><th>{t('kontak.colPhone')}</th><th>{t('kontak.colAddress')}</th>{canEdit && <th></th>}</tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.phone}</td>
                <td>{c.address}</td>
                {canEdit && (
                  <td>
                    <button className="btn-icon-danger" onClick={() => handleDelete(c)} title={t('common.delete')}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="empty">{t('kontak.noContacts')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
