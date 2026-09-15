import { useEffect, useState, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function JurnalPembalik() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [q, setQ] = useState('')
  const [transactions, setTransactions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [reversalDate, setReversalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, date, type, note, journal_entries ( debit, credit )')
      .eq('company_id', companyId)
      .order('date', { ascending: false })
      .limit(100)
    if (error) { setError(error.message); return }
    setTransactions(data || [])
  }

  function openFor(t2) {
    setActiveId(t2.id)
    setNote('')
    setSuccess(null)
    setError(null)
  }

  async function handleCreate(txnId) {
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('create_reversing_entry', {
      p_transaction_id: txnId,
      p_reversal_date: new Date(reversalDate).toISOString(),
      p_note: note.trim() || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(t('jurnalPembalik.successMsg'))
    setActiveId(null)
  }

  const filtered = transactions.filter((t2) => t2.note.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('jurnalPembalik.title')}</h1></div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('jurnalPembalik.pageHint')}</p>

      {!canEdit ? (
        <ViewerNotice />
      ) : (
        <>
          <div className="filters" style={{ marginBottom: 16 }}>
            <input placeholder={t('jurnalPembalik.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
          </div>
          {error && <p className="error">{error}</p>}
          {success && <p style={{ color: 'var(--positive)', fontSize: 13, marginBottom: 14 }}>{success}</p>}

          <table className="tbl">
            <thead>
              <tr><th>{t('jurnalPembalik.colDate')}</th><th>{t('jurnalPembalik.colNote')}</th><th className="num">{t('jurnalPembalik.colAmount')}</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((t2) => {
                const total = (t2.journal_entries || []).reduce((s, l) => s + Number(l.debit), 0)
                const isActive = activeId === t2.id
                return (
                  <Fragment key={t2.id}>
                    <tr>
                      <td>{new Date(t2.date).toLocaleString(i18n.language)}</td>
                      <td>{t2.note}</td>
                      <td className="num">{total.toLocaleString(i18n.language)}</td>
                      <td>
                        <button className="btn-secondary" onClick={() => (isActive ? setActiveId(null) : openFor(t2))} style={{ padding: '5px 10px' }}>
                          <RefreshCw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                          {t('jurnalPembalik.createButton')}
                        </button>
                      </td>
                    </tr>
                    {isActive && (
                      <tr>
                        <td colSpan={4} style={{ background: 'var(--surface-alt)', padding: 0 }}>
                          <div className="inline-form" style={{ padding: 16, margin: 0 }}>
                            <div className="field">
                              <label>{t('jurnalPembalik.reversalDate')}</label>
                              <DateField value={reversalDate} onChange={setReversalDate} required />
                            </div>
                            <div className="field" style={{ flex: 1, minWidth: 220 }}>
                              <label>{t('transaksi.note')}</label>
                              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('jurnalPembalik.notePlaceholder', { note: t2.note })} />
                            </div>
                            <button className="btn-primary" disabled={saving} onClick={() => handleCreate(t2.id)}>
                              {saving ? t('transaksi.saving') : t('jurnalPembalik.confirmButton')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!filtered.length && <tr><td colSpan={4} className="empty">{t('jurnalPembalik.noData')}</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
