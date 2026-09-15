import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

export default function SaldoAwalHutangPiutang() {
  const { t, i18n } = useTranslation()
  const { canEdit } = useCompany()
  const companyId = localStorage.getItem('activeCompanyId')
  const [contacts, setContacts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({
    contact_id: '', type: 'piutang', account_id: '', amount: 0,
    date: new Date().toISOString().slice(0, 10), due_date: '', invoice_no: '', note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [companyId])

  async function load() {
    const { data: c } = await supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name')
    setContacts(c || [])
    const { data: a } = await supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).in('category', ['piutang', 'hutang']).order('code')
    setAccounts(a || [])
    await loadRows()
  }

  async function loadRows() {
    const { data, error } = await supabase
      .from('receivables_payables')
      .select('*, contacts ( name ), transactions!inner ( type )')
      .eq('company_id', companyId)
      .eq('transactions.type', 'saldo_awal')
      .order('transaction_date', { ascending: false })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  const accountsForType = accounts.filter((a) => a.category === form.type)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.rpc('set_opening_ar_ap', {
      p_company_id: companyId,
      p_contact_id: form.contact_id,
      p_type: form.type,
      p_account_id: form.account_id,
      p_amount: form.amount,
      p_date: form.date,
      p_due_date: form.due_date || null,
      p_note: form.note || null,
      p_invoice_no: form.invoice_no || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ contact_id: '', type: 'piutang', account_id: '', amount: 0, date: new Date().toISOString().slice(0, 10), due_date: '', invoice_no: '', note: '' })
    loadRows()
  }

  async function handleDelete(r) {
    if (!confirm(t('common.confirmDelete', { name: r.contacts?.name || r.invoice_no || '' }))) return
    setError(null)
    // Baris "receivables_payables" gak boleh dihapus duluan sebelum transaksi asalnya
    // dilepas dulu (FK dari receivables_payables -> transactions gak cascade), jadi
    // urutannya: hapus receivables_payables dulu, baru transaksinya.
    const { error: e1 } = await supabase.from('receivables_payables').delete().eq('id', r.id)
    if (e1) { setError(e1.message); return }
    const { error: e2 } = await supabase.from('transactions').delete().eq('id', r.transaction_id)
    if (e2) { setError(e2.message); return }
    loadRows()
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('saldoAwalHp.title')}</h1></div>

      {!canEdit && <ViewerNotice />}

      {canEdit && (
      <form className="section inline-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>{t('saldoAwalHp.contact')}</label>
          <select value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })} required>
            <option value="">{t('saldoAwalHp.selectContact')}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t('saldoAwalHp.type')}</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, account_id: '' })}>
            <option value="piutang">{t('saldoAwalHp.typePiutang')}</option>
            <option value="hutang">{t('saldoAwalHp.typeHutang')}</option>
          </select>
        </div>
        <div className="field">
          <label>{form.type === 'piutang' ? t('saldoAwalHp.accountReceivable') : t('saldoAwalHp.accountPayable')}</label>
          <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
            <option value="">{t('saldoAwalHp.selectAccount')}</option>
            {accountsForType.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t('saldoAwalHp.amount')}</label>
          <CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
        </div>
        <div className="field">
          <label>{t('saldoAwalHp.date')}</label>
          <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
        </div>
        <div className="field">
          <label>{t('saldoAwalHp.dueDate')}</label>
          <DateField value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
        </div>
        <div className="field">
          <label>{t('saldoAwalHp.invoiceNo')}</label>
          <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('saldoAwalHp.note')}</label>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t('saldoAwalHp.notePlaceholder')} />
        </div>
        <button className="btn-primary" disabled={saving}>{saving ? t('saldoAwalHp.saving') : t('saldoAwalHp.save')}</button>
        {error && <p className="error" style={{ flexBasis: '100%' }}>{error}</p>}
      </form>
      )}

      <table className="tbl">
        <thead>
          <tr><th>{t('saldoAwalHp.colContact')}</th><th>{t('saldoAwalHp.colType')}</th><th>{t('saldoAwalHp.colInvoice')}</th><th>{t('saldoAwalHp.colDate')}</th><th>{t('saldoAwalHp.colDueDate')}</th><th className="num">{t('saldoAwalHp.colAmount')}</th>{canEdit && <th></th>}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.contacts?.name}</td>
              <td style={{ textTransform: 'capitalize' }}>{r.type === 'piutang' ? t('saldoAwalHp.typePiutang') : t('saldoAwalHp.typeHutang')}</td>
              <td>{r.invoice_no || '-'}</td>
              <td>{r.transaction_date}</td>
              <td>{r.due_date || '-'}</td>
              <td className="num">{Number(r.amount).toLocaleString(i18n.language)}</td>
              {canEdit && (
                <td>
                  <button className="btn-icon-danger" onClick={() => handleDelete(r)} title={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="empty">{t('saldoAwalHp.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
