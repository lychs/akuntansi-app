import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'

export default function KelolaAkses() {
  const { t } = useTranslation()
  const { activeCompanyId } = useCompany()
  const { session } = useAuth()
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const ROLE_LABEL = { admin: t('kelolaAkses.roleOwner'), staff: t('kelolaAkses.roleEditor'), viewer: t('kelolaAkses.roleViewer') }
  const ROLE_OPTIONS = [
    { value: 'admin', label: t('kelolaAkses.roleOwnerDesc') },
    { value: 'staff', label: t('kelolaAkses.roleEditorDesc') },
    { value: 'viewer', label: t('kelolaAkses.roleViewerDesc') },
  ]

  useEffect(() => { if (activeCompanyId) load() }, [activeCompanyId])

  async function load() {
    const { data: memberData, error: e1 } = await supabase
      .from('company_users')
      .select('id, user_id, email, role')
      .eq('company_id', activeCompanyId)
      .order('created_at')
    if (e1) { setError(e1.message); return }
    setMembers(memberData || [])
    setIsAdmin((memberData || []).some((m) => m.user_id === session.user.id && m.role === 'admin'))

    const { data: invData } = await supabase
      .from('company_invitations')
      .select('id, email, role, created_at')
      .eq('company_id', activeCompanyId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
    setInvitations(invData || [])
  }

  async function handleInvite(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)
    const { error } = await supabase.rpc('invite_to_company', {
      p_company_id: activeCompanyId, p_email: email.trim(), p_role: role,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(t('kelolaAkses.inviteSuccess', { email }))
    setEmail('')
    load()
  }

  async function handleRoleChange(memberId, newRole) {
    setError(null)
    const { error } = await supabase.from('company_users').update({ role: newRole }).eq('id', memberId).select()
    if (error) { setError(error.message); return }
    load()
  }

  async function handleRemove(memberId) {
    if (!confirm(t('kelolaAkses.confirmRemove'))) return
    setError(null)
    const { error } = await supabase.from('company_users').delete().eq('id', memberId)
    if (error) { setError(error.message); return }
    load()
  }

  async function handleCancelInvite(invId) {
    await supabase.from('company_invitations').delete().eq('id', invId)
    load()
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('kelolaAkses.title')}</h1></div>

      {!isAdmin && (
        <p className="hint" style={{ marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: t('kelolaAkses.nonAdminHint') }} />
      )}

      {isAdmin && (
        <form className="section inline-form" onSubmit={handleInvite}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>{t('kelolaAkses.invitedEmail')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('kelolaAkses.invitedEmailPlaceholder')} required />
          </div>
          <div className="field">
            <label>{t('kelolaAkses.role')}</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{ROLE_LABEL[r.value]}</option>)}
            </select>
          </div>
          <button className="btn-primary" disabled={saving}>
            <UserPlus size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
            {saving ? t('common.sending') : t('kelolaAkses.sendInvite')}
          </button>
          <p className="hint" style={{ flexBasis: '100%', marginTop: 4 }}>
            {ROLE_OPTIONS.find((r) => r.value === role)?.label}
          </p>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {success && <p style={{ color: 'var(--positive)', fontSize: 13, marginBottom: 14 }}>{success}</p>}

      <h2 className="section-title">{t('kelolaAkses.members')}</h2>
      <table className="tbl">
        <thead><tr><th>{t('common.email')}</th><th>{t('kelolaAkses.role').replace(' *','')}</th>{isAdmin && <th></th>}</tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.email || <span className="hint">{t('kelolaAkses.emailNotRecorded')}</span>}</td>
              <td>
                {isAdmin ? (
                  <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)}>
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{ROLE_LABEL[r.value]}</option>)}
                  </select>
                ) : ROLE_LABEL[m.role]}
              </td>
              {isAdmin && (
                <td>
                  {m.user_id !== session.user.id && (
                    <button className="btn-secondary" onClick={() => handleRemove(m.id)} style={{ padding: '4px 8px' }}>
                      <X size={13} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && invitations.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 24 }}>{t('kelolaAkses.pendingInvites')}</h2>
          <table className="tbl">
            <thead><tr><th>{t('common.email')}</th><th>{t('kelolaAkses.role').replace(' *','')}</th><th>{t('kelolaAkses.sentAt')}</th><th></th></tr></thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>{ROLE_LABEL[inv.role]}</td>
                  <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => handleCancelInvite(inv.id)} style={{ padding: '4px 8px' }}>
                      {t('kelolaAkses.cancelInvite')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="hint" style={{ marginTop: 20 }} dangerouslySetInnerHTML={{ __html: t('kelolaAkses.footerNote') }} />
    </div>
  )
}
