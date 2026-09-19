import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, History, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { fmt } from '../../lib/reportHelpers.js'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function TutupBuku() {
  const { t, i18n } = useTranslation()
  const { activeRole } = useCompany()
  const isAdmin = activeRole === 'admin'
  const companyId = localStorage.getItem('activeCompanyId')
  const [history, setHistory] = useState([])
  const [closingDate, setClosingDate] = useState('')
  const [note, setNote] = useState(t('tutupBuku.title'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('fiscal_closings')
      .select('*')
      .eq('company_id', companyId)
      .order('closing_date', { ascending: false })
    if (error) { setError(error.message); return }
    setHistory(data || [])
  }

  const lastClosing = history[0]?.closing_date

  async function handleClose(e) {
    e.preventDefault()
    if (!confirming) { setConfirming(true); return }
    setError(null)
    setSuccess(null)
    setSaving(true)
    const { error } = await supabase.rpc('close_fiscal_year', {
      p_company_id: companyId,
      p_closing_date: closingDate,
      p_note: note,
    })
    setSaving(false)
    setConfirming(false)
    if (error) { setError(error.message); return }
    setSuccess(t('tutupBuku.successMsg'))
    setClosingDate('')
    load()
  }

  const sinceText = lastClosing ? t('tutupBuku.explainerWithLast', { date: lastClosing }) : t('tutupBuku.explainerNoLast')
  const explainerHtml = t('tutupBuku.explainer', { since: sinceText })

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('tutupBuku.title')}</h1></div>

      <div className="tutupbuku-hero">
        <div className="tutupbuku-hero-icon"><Lock size={26} /></div>
        <div>
          <div className="tutupbuku-hero-title">{t('tutupBuku.heroTitle')}</div>
          <div className="tutupbuku-hero-stat">
            {lastClosing
              ? <>{t('tutupBuku.lastClosingLabel')} <strong>{new Date(lastClosing).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</strong></>
              : t('tutupBuku.neverClosedLabel')}
          </div>
        </div>
      </div>

      {!isAdmin && <ViewerNotice text={t('tutupBuku.viewerNotice')} />}

      {isAdmin && (
        <div className="settings-card" style={{ maxWidth: '100%' }}>
          <h3><ShieldAlert size={16} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--brand)' }} />{t('tutupBuku.formTitle')}</h3>
          <p className="hint" style={{ marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: explainerHtml }} />

          <form onSubmit={handleClose} className="inline-form">
            <div className="field">
              <label>{t('tutupBuku.closeUntilDate')}</label>
              <DateField
                value={closingDate}
                min={lastClosing || undefined}
                onChange={(v) => { setClosingDate(v); setConfirming(false) }}
                required
              />
            </div>
            <div className="field">
              <label>{t('tutupBuku.note')}</label>
              <input value={note} onChange={(e) => { setNote(e.target.value); setConfirming(false) }} />
            </div>

            {error && <p className="error" style={{ flexBasis: '100%' }}>{error}</p>}
            {success && (
              <p style={{ flexBasis: '100%', color: 'var(--positive)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} /> {success}
              </p>
            )}

            {confirming && (
              <p className="error" style={{ flexBasis: '100%' }}>
                {t('tutupBuku.confirmMsg')}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={saving || !closingDate} style={{ background: confirming ? 'var(--negative)' : undefined }}>
              {saving ? t('tutupBuku.processing') : confirming ? t('tutupBuku.confirmButton') : t('tutupBuku.closeButton')}
            </button>
          </form>
        </div>
      )}

      <div className="settings-section" style={{ marginTop: 24 }}>
        <div className="section-head">
          <h3><History size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('tutupBuku.historyTitle')}</h3>
        </div>
        <table className="tbl">
          <thead><tr><th>{t('tutupBuku.colClosingDate')}</th><th>{t('tutupBuku.colNote')}</th><th className="num">{t('tutupBuku.colNetIncome')}</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.closing_date}</td>
                <td>{h.note}</td>
                <td className="num" style={{ color: h.net_income >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                  {fmt(h.net_income)}
                </td>
              </tr>
            ))}
            {!history.length && <tr><td colSpan={3} className="empty">{t('tutupBuku.noHistory')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
