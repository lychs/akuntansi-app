import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, PlayCircle, Repeat, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { DateField } from '../components/DateField.jsx'
import { useCompany } from '../lib/CompanyContext.jsx'
import ViewerNotice from '../components/ViewerNotice.jsx'

const SIMPLE_TYPES = ['general', 'penyesuaian', 'pemasukan', 'pengeluaran', 'tanam_modal', 'tarik_modal', 'transfer']
let lineIdCounter = 0
function newLine() { lineIdCounter += 1; return { id: lineIdCounter, account_id: '', debit: '', credit: '' } }

export default function TransaksiBerulang() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('general')
  const [dayMode, setDayMode] = useState('date') // 'date' | 'lastday'
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [lines, setLines] = useState([newLine(), newLine()])
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('id, name, type, lines, day_of_month, use_last_day, start_date, end_date, next_run_date, last_run_date, is_active, is_system_generated')
      .eq('company_id', companyId)
      .order('next_run_date')
    if (error) { setError(error.message); return }
    setItems(data || [])
    supabase.from('accounts').select('id, code, name').eq('company_id', companyId).order('code').then(({ data }) => setAccounts(data || []))
  }

  function accountLabel(id) {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.name} (${a.code})` : '-'
  }

  function updateLine(id, patch) { setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))) }
  function addLine() { setLines((ls) => [...ls, newLine()]) }
  function removeLine(id) { setLines((ls) => (ls.length > 2 ? ls.filter((l) => l.id !== id) : ls)) }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const balanced = lines.length > 0 && totalDebit === totalCredit && totalDebit > 0

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError(t('recurring.errNameRequired')); return }
    if (!balanced) { setError(t('laporanTransaksi.errNotBalanced')); return }
    if (lines.some((l) => !l.account_id)) { setError(t('laporanTransaksi.errAccountRequired')); return }

    setSaving(true)
    const { error } = await supabase.from('recurring_transactions').insert({
      company_id: companyId,
      name: name.trim(),
      type,
      lines: lines.map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      day_of_month: dayMode === 'lastday' ? 1 : Number(dayOfMonth),
      use_last_day: dayMode === 'lastday',
      start_date: startDate,
      end_date: endDate || null,
      next_run_date: startDate,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setName(''); setLines([newLine(), newLine()]); setShowForm(false)
    load()
  }

  async function handleRunNow(item) {
    setError(null)
    const { error } = await supabase.rpc('run_recurring_transaction', { p_recurring_id: item.id })
    if (error) { setError(error.message); return }
    load()
  }

  async function handleRunAllDue() {
    setProcessing(true)
    setError(null)
    const { error } = await supabase.rpc('run_all_due_recurring', { p_company_id: companyId })
    setProcessing(false)
    if (error) { setError(error.message); return }
    load()
  }

  async function handleToggleActive(item) {
    const { error } = await supabase.from('recurring_transactions').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) { setError(error.message); return }
    load()
  }

  async function handleDelete(item) {
    if (item.is_system_generated) { alert(t('recurring.errCannotDeleteSystem')); return }
    if (!confirm(t('common.confirmDelete', { name: item.name }))) return
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', item.id)
    if (error) { setError(error.message); return }
    load()
  }

  const dueCount = items.filter((i) => i.is_active && i.next_run_date <= new Date().toISOString().slice(0, 10)).length

  return (
    <div className="p-6">
      <div className="page-header">
        <h1>{t('recurring.title')}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          {dueCount > 0 && canEdit && (
            <button className="btn-primary" onClick={handleRunAllDue} disabled={processing}>
              <PlayCircle size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              {processing ? t('transaksi.saving') : t('recurring.runAllDue', { count: dueCount })}
            </button>
          )}
          {canEdit && (
            <button className="btn-secondary" onClick={() => setShowForm(!showForm)}>
              {showForm ? t('costCenter.closeForm') : t('recurring.addNew')}
            </button>
          )}
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>{t('recurring.pageHint')}</p>
      {!canEdit && <ViewerNotice />}
      {error && <p className="error">{error}</p>}

      {canEdit && showForm && (
        <form className="txn-form-panel" onSubmit={handleCreate} style={{ maxWidth: 1000, marginBottom: 24 }}>
          <div className="txn-form-row">
            <div className="field">
              <label>{t('recurring.name')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('recurring.namePlaceholder')} />
            </div>
            <div className="field">
              <label>{t('laporanTransaksi.colType')}</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {SIMPLE_TYPES.map((tt) => <option key={tt} value={tt}>{t(`laporanTransaksi.type${tt.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="dimension-row">
            <div className="field">
              <label>{t('recurring.dayMode')}</label>
              <select value={dayMode} onChange={(e) => setDayMode(e.target.value)}>
                <option value="date">{t('recurring.dayModeDate')}</option>
                <option value="lastday">{t('recurring.dayModeLastDay')}</option>
              </select>
            </div>
            {dayMode === 'date' && (
              <div className="field">
                <label>{t('recurring.dayOfMonth')}</label>
                <input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>{t('recurring.startDate')}</label>
              <DateField value={startDate} onChange={setStartDate} required />
            </div>
            <div className="field">
              <label>{t('recurring.endDate')}</label>
              <DateField value={endDate} onChange={setEndDate} />
            </div>
          </div>

          <div className="adj-lines">
            {lines.map((line, idx) => (
              <div key={line.id} className="adj-line" style={{ gridTemplateColumns: '22px 2fr 1fr 1fr 30px' }}>
                <span className="adj-line-no">{idx + 1}</span>
                <select value={line.account_id} onChange={(e) => updateLine(line.id, { account_id: e.target.value })}>
                  <option value="">{t('transaksi.selectAccount')}</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                </select>
                <div className="adj-line-amount">
                  <label>{t('jurnal.colDebit')}</label>
                  <input type="number" min="0" step="any" value={line.debit} onChange={(e) => updateLine(line.id, { debit: e.target.value, credit: '' })} />
                </div>
                <div className="adj-line-amount">
                  <label>{t('jurnal.colCredit')}</label>
                  <input type="number" min="0" step="any" value={line.credit} onChange={(e) => updateLine(line.id, { credit: e.target.value, debit: '' })} />
                </div>
                <button type="button" className="btn-icon-danger" onClick={() => removeLine(line.id)} disabled={lines.length <= 2}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary adj-add-line-btn" onClick={addLine}>
            <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('transaksi.adjAddLine')}
          </button>
          <div className={`adj-balance-bar ${balanced ? 'ok' : 'warn'}`}>
            <div><span>{t('jurnal.colDebit')}</span><strong>{totalDebit.toLocaleString(i18n.language)}</strong></div>
            <div><span>{t('jurnal.colCredit')}</span><strong>{totalCredit.toLocaleString(i18n.language)}</strong></div>
          </div>

          <button className="btn-primary" style={{ marginTop: 14 }} disabled={saving}>{saving ? t('transaksi.saving') : t('recurring.save')}</button>
        </form>
      )}

      <table className="tbl">
        <thead>
          <tr>
            <th>{t('recurring.colName')}</th><th>{t('recurring.colNextRun')}</th><th className="num">{t('recurring.colAmount')}</th>
            <th>{t('recurring.colStatus')}</th>{canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const amount = (it.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0)
            const isDue = it.is_active && it.next_run_date <= new Date().toISOString().slice(0, 10)
            return (
              <tr key={it.id}>
                <td>
                  {it.is_system_generated && <Repeat size={12} style={{ verticalAlign: -1, marginRight: 5, color: 'var(--brand)' }} title={t('recurring.systemGenerated')} />}
                  {it.name}
                </td>
                <td>{it.next_run_date}</td>
                <td className="num">{amount.toLocaleString(i18n.language)}</td>
                <td>
                  {!it.is_active ? <span className="badge pending">{t('recurring.statusInactive')}</span>
                    : isDue ? <span className="badge overdue">{t('recurring.statusDue')}</span>
                    : <span className="badge lunas">{t('recurring.statusScheduled')}</span>}
                </td>
                {canEdit && (
                  <td style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {it.is_active && (
                      <button className="btn-icon-danger" style={{ color: 'var(--brand)' }} onClick={() => handleRunNow(it)} title={t('recurring.runNow')}>
                        <PlayCircle size={14} />
                      </button>
                    )}
                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11.5 }} onClick={() => handleToggleActive(it)}>
                      {it.is_active ? t('recurring.pause') : t('recurring.resume')}
                    </button>
                    {!it.is_system_generated && (
                      <button className="btn-icon-danger" onClick={() => handleDelete(it)} title={t('common.delete')}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
          {!items.length && <tr><td colSpan={5} className="empty">{t('recurring.noItems')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
