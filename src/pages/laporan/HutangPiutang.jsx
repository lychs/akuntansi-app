import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet, Pencil, X, Paperclip, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField, DateTimeField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ReceiptUpload, { uploadReceiptIfNeeded } from '../../components/ReceiptUpload.jsx'

export default function HutangPiutang() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies, canEdit } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const dim = useDimensionFilters(companyId)
  const [rows, setRows] = useState([])
  const [typeFilter, setTypeFilter] = useState('semua')
  const [error, setError] = useState(null)
  const [paymentAccounts, setPaymentAccounts] = useState([])

  const [payingId, setPayingId] = useState(null)
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payAmount, setPayAmount] = useState(0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paySaving, setPaySaving] = useState(false)
  const [payError, setPayError] = useState(null)

  const [contacts, setContacts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editContactId, setEditContactId] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editInvoiceNo, setEditInvoiceNo] = useState('')
  const [editAmount, setEditAmount] = useState(0)
  const [editLinesRaw, setEditLinesRaw] = useState([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const [editReceiptFile, setEditReceiptFile] = useState(null)
  const [editRemoveReceipt, setEditRemoveReceipt] = useState(false)
  const [editCurrentReceiptPath, setEditCurrentReceiptPath] = useState(null)

  useEffect(() => { load() }, [companyId, dim.depsKey])

  useEffect(() => {
    if (!companyId) return
    supabase.from('accounts').select('id, code, name').eq('company_id', companyId).eq('category', 'kas_bank').order('code')
      .then(({ data }) => setPaymentAccounts(data || []))
    supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name')
      .then(({ data }) => setContacts(data || []))
    supabase.from('accounts').select('id, category').eq('company_id', companyId)
      .then(({ data }) => setAccounts(data || []))
  }, [companyId])

  function accountCategory(accountId) {
    return accounts.find((a) => a.id === accountId)?.category
  }

  async function load() {
    let query = supabase.from('v_receivables_payables').select('*').eq('company_id', companyId)
    if (dim.costCenterId) query = query.eq('cost_center_id', dim.costCenterId)
    if (dim.departmentId) query = query.eq('department_id', dim.departmentId)
    if (dim.projectId) query = query.eq('project_id', dim.projectId)
    if (dim.warehouseId) query = query.eq('warehouse_id', dim.warehouseId)
    const { data, error } = await query.order('transaction_date', { ascending: false })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  function openPayForm(r) {
    setPayingId(r.id)
    setEditingId(null)
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayAmount(Number(r.sisa))
    setPayAccountId('')
    setPayNote('')
    setPayError(null)
  }

  const [editIsDagang, setEditIsDagang] = useState(false)

  async function handleViewReceipt(path) {
    const { data, error } = await supabase.storage.from('transaction-receipts').createSignedUrl(path, 60)
    if (error || !data) { alert(t('laporanTransaksi.errReceiptOpen')); return }
    window.open(data.signedUrl, '_blank')
  }

  async function openEdit(r) {
    setEditError(null)
    setPayingId(null)
    setEditReceiptFile(null)
    setEditRemoveReceipt(false)
    const { data: txn } = await supabase.from('transactions').select('type, receipt_path').eq('id', r.transaction_id).maybeSingle()
    const isDagang = txn?.type === 'pembelian_barang' || txn?.type === 'penjualan_barang'
    setEditIsDagang(isDagang)
    setEditCurrentReceiptPath(txn?.receipt_path || null)
    setEditDueDate(r.due_date || '')
    setEditInvoiceNo(r.invoice_no || '')
    setEditingId(r.id)
    if (isDagang) return // gak perlu fetch journal lines, cuma edit due_date/invoice_no

    const { data, error } = await supabase.rpc('get_transaction_detail', { p_transaction_id: r.transaction_id })
    if (error) { setError(error.message); return }
    setEditLinesRaw(data || [])
    setEditDate(new Date(r.transaction_date).toISOString().slice(0, 16))
    setEditNote(r.note || '')
    setEditContactId(r.contact_id || '')
    setEditAmount(Number(r.amount))
  }

  async function syncReceipt(transactionId) {
    if (editReceiptFile) {
      try {
        const newPath = await uploadReceiptIfNeeded(supabase, companyId, editReceiptFile)
        await supabase.rpc('set_transaction_receipt', { p_transaction_id: transactionId, p_receipt_path: newPath })
      } catch (upErr) {
        setEditSaving(false)
        setEditError(upErr.message || String(upErr))
        return false
      }
    } else if (editRemoveReceipt) {
      await supabase.rpc('set_transaction_receipt', { p_transaction_id: transactionId, p_receipt_path: null })
    }
    return true
  }

  async function handleSaveEdit(r) {
    setEditError(null)
    setEditSaving(true)

    if (editIsDagang) {
      const { error } = await supabase.rpc('update_receivable_payable_dagang_metadata', {
        p_id: r.id,
        p_due_date: editDueDate || null,
        p_invoice_no: editInvoiceNo.trim() || null,
      })
      if (error) { setEditSaving(false); setEditError(error.message); return }
      if (!(await syncReceipt(r.transaction_id))) return
      setEditSaving(false)
      setEditingId(null)
      load()
      return
    }

    if (!editContactId) { setEditSaving(false); setEditError(t('laporanTransaksi.errContactRequired')); return }
    if (!editAmount || Number(editAmount) <= 0) { setEditSaving(false); setEditError(t('hutangPiutang.errAmountInvalid')); return }

    // Baris piutang/hutang-nya disesuaikan ke nominal baru, baris lain (termasuk
    // pajak kalau ada) dibiarkan persis kayak sebelumnya.
    const hpCategory = r.type === 'piutang' ? 'piutang' : 'hutang'
    const linesPayload = editLinesRaw.map((l) => {
      if (accountCategory(l.account_id) === hpCategory) {
        return r.type === 'piutang'
          ? { account_id: l.account_id, debit: Number(editAmount), credit: 0 }
          : { account_id: l.account_id, debit: 0, credit: Number(editAmount) }
      }
      return { account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }
    })

    const { error } = await supabase.rpc('update_transaction_hutang_piutang', {
      p_transaction_id: r.transaction_id,
      p_date: new Date(editDate).toISOString(),
      p_note: editNote.trim(),
      p_contact_id: editContactId,
      p_due_date: editDueDate || null,
      p_invoice_no: editInvoiceNo.trim() || null,
      p_lines: linesPayload,
    })
    if (error) { setEditSaving(false); setEditError(error.message); return }
    if (!(await syncReceipt(r.transaction_id))) return
    setEditSaving(false)
    setEditingId(null)
    load()
  }

  async function handlePay(r) {
    setPayError(null)
    if (!payAccountId) { setPayError(t('hutangPiutang.errPaymentAccount')); return }
    if (!payAmount || Number(payAmount) <= 0) { setPayError(t('hutangPiutang.errAmountInvalid')); return }
    if (Number(payAmount) > Number(r.sisa)) { setPayError(t('hutangPiutang.errAmountExceeds', { sisa: Number(r.sisa).toLocaleString(i18n.language) })); return }

    setPaySaving(true)
    const { error } = await supabase.rpc('record_receivable_payment', {
      p_receivable_payable_id: r.id,
      p_payment_date: payDate,
      p_amount: Number(payAmount),
      p_payment_account_id: payAccountId,
      p_note: payNote.trim() || null,
    })
    setPaySaving(false)
    if (error) { setPayError(error.message); return }
    setPayingId(null)
    load()
  }

  const filtered = typeFilter === 'semua' ? rows : rows.filter((r) => r.type === typeFilter)
  const grouped = filtered.reduce((acc, r) => {
    const k = r.contact_name || t('hutangPiutang.noContact')
    if (!acc[k]) acc[k] = []
    acc[k].push(r)
    return acc
  }, {})

  function badgeClass(status) {
    if (status === 'Lunas') return 'badge lunas'
    if (status === 'Overdue') return 'badge overdue'
    return 'badge pending'
  }

  const exportRows = filtered.map((r) => ({
    contact: r.contact_name || tid('hutangPiutang.noContact'),
    type: r.type === 'piutang' ? `${tid('hutangPiutang.typePiutang')} / ${ten('hutangPiutang.typePiutang')}` : `${tid('hutangPiutang.typeHutang')} / ${ten('hutangPiutang.typeHutang')}`,
    invoice: r.invoice_no || '-',
    date: r.transaction_date,
    dueDate: r.due_date || '-',
    amount: Number(r.amount),
    paid: Number(r.paid_amount),
    remaining: Number(r.sisa),
    status: r.status,
  }))
  const exportConfig = {
    companyName,
    titleId: tid('hutangPiutang.title'), titleEn: ten('hutangPiutang.title'),
    columns: [
      { key: 'contact', headerId: 'Kontak', headerEn: 'Contact', align: 'left' },
      { key: 'type', headerId: tid('hutangPiutang.colType'), headerEn: ten('hutangPiutang.colType'), align: 'left' },
      { key: 'invoice', headerId: tid('hutangPiutang.colInvoice'), headerEn: ten('hutangPiutang.colInvoice'), align: 'left' },
      { key: 'date', headerId: tid('hutangPiutang.colDate'), headerEn: ten('hutangPiutang.colDate'), align: 'left' },
      { key: 'dueDate', headerId: tid('hutangPiutang.colDueDate'), headerEn: ten('hutangPiutang.colDueDate'), align: 'left' },
      { key: 'amount', headerId: tid('hutangPiutang.colAmount'), headerEn: ten('hutangPiutang.colAmount'), align: 'right' },
      { key: 'paid', headerId: tid('hutangPiutang.colPaid'), headerEn: ten('hutangPiutang.colPaid'), align: 'right' },
      { key: 'remaining', headerId: tid('hutangPiutang.colRemaining'), headerEn: ten('hutangPiutang.colRemaining'), align: 'right' },
      { key: 'status', headerId: tid('hutangPiutang.colStatus'), headerEn: ten('hutangPiutang.colStatus'), align: 'left' },
    ],
    rows: exportRows,
    fileBaseName: `hutang-piutang_${new Date().toISOString().slice(0, 10)}`,
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('hutangPiutang.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="semua">{t('hutangPiutang.allTypes')}</option>
            <option value="hutang">{t('hutangPiutang.typeHutang')}</option>
            <option value="piutang">{t('hutangPiutang.typePiutang')}</option>
          </select>
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}

        {Object.entries(grouped).map(([contact, items]) => (
          <div key={contact} className="section">
            <h3>{contact}</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('hutangPiutang.colType')}</th><th>{t('hutangPiutang.colInvoice')}</th><th>{t('hutangPiutang.colDate')}</th><th>{t('hutangPiutang.colDueDate')}</th>
                  <th className="num">{t('hutangPiutang.colAmount')}</th><th className="num">{t('hutangPiutang.colPaid')}</th><th className="num">{t('hutangPiutang.colRemaining')}</th><th>{t('hutangPiutang.colStatus')}</th>{canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const sisa = Number(r.sisa)
                  const isPaying = payingId === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <td style={{ textTransform: 'capitalize' }}>{r.type === 'piutang' ? t('hutangPiutang.typePiutang') : t('hutangPiutang.typeHutang')}</td>
                        <td>{r.invoice_no || '-'}</td>
                        <td>{r.transaction_date}</td>
                        <td>{r.due_date || '-'}</td>
                        <td className="num">{Number(r.amount).toLocaleString(i18n.language)}</td>
                        <td className="num">{Number(r.paid_amount).toLocaleString(i18n.language)}</td>
                        <td className="num">{sisa.toLocaleString(i18n.language)}</td>
                        <td><span className={badgeClass(r.status)}>{r.status}</span></td>
                        {canEdit && (
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-icon" onClick={() => (editingId === r.id ? setEditingId(null) : openEdit(r))} title={t('common.edit')}>
                              {editingId === r.id ? <X size={14} /> : <Pencil size={14} />}
                            </button>
                            {sisa > 0 && (
                              <button className="btn-secondary" style={{ padding: '5px 10px' }} onClick={() => (isPaying ? setPayingId(null) : openPayForm(r))}>
                                <Wallet size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                                {t('hutangPiutang.payButton')}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                      {editingId === r.id && (
                        <tr>
                          <td colSpan={9} style={{ background: 'var(--surface-alt)', padding: 0 }}>
                            {editIsDagang ? (
                              <>
                                <div className="inline-form" style={{ padding: 16, margin: 0 }}>
                                  <div className="field">
                                    <label>{t('hutangPiutang.colDueDate')}</label>
                                    <DateField value={editDueDate} onChange={setEditDueDate} />
                                  </div>
                                  <div className="field">
                                    <label>{t('hutangPiutang.colInvoice')}</label>
                                    <input value={editInvoiceNo} onChange={(e) => setEditInvoiceNo(e.target.value)} />
                                  </div>
                                  <div className="field" style={{ minWidth: 260 }}>
                                    <label>{t('receiptUpload.label')}</label>
                                    {editCurrentReceiptPath && !editRemoveReceipt && !editReceiptFile && (
                                      <div className="receipt-chip" style={{ marginBottom: 6 }}>
                                        <Paperclip size={14} />
                                        <span>{t('laporanTransaksi.viewReceipt')}</span>
                                        <button type="button" onClick={() => handleViewReceipt(editCurrentReceiptPath)} title={t('laporanTransaksi.viewReceipt')} style={{ marginLeft: 6 }}>
                                          <Paperclip size={13} />
                                        </button>
                                        <button type="button" onClick={() => setEditRemoveReceipt(true)} title={t('common.delete')}>
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    )}
                                    {editRemoveReceipt && (
                                      <p className="hint">
                                        {t('receiptUpload.willBeRemoved')}{' '}
                                        <button type="button" className="btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setEditRemoveReceipt(false)}>
                                          {t('common.cancel')}
                                        </button>
                                      </p>
                                    )}
                                    {!editRemoveReceipt && (
                                      <ReceiptUpload file={editReceiptFile} setFile={setEditReceiptFile} />
                                    )}
                                  </div>
                                  <button className="btn-primary" disabled={editSaving} onClick={() => handleSaveEdit(r)}>
                                    {editSaving ? t('transaksi.saving') : t('costCenter.save')}
                                  </button>
                                </div>
                                {editError && <p className="error" style={{ padding: '0 16px 14px' }}>{editError}</p>}
                                <p className="hint" style={{ padding: '0 16px 14px', margin: 0 }}>{t('hutangPiutang.editDagangHint')}</p>
                              </>
                            ) : (
                            <>
                            <div className="inline-form" style={{ padding: 16, margin: 0 }}>
                              <div className="field">
                                <label>{t('laporanTransaksi.colDate')}</label>
                                <DateTimeField value={editDate} onChange={setEditDate} required />
                              </div>
                              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                                <label>{t('transaksi.note')}</label>
                                <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                              </div>
                              <div className="field">
                                <label>{t('transaksi.contact')}</label>
                                <select value={editContactId} onChange={(e) => setEditContactId(e.target.value)} required>
                                  <option value="">{t('transaksi.select')}</option>
                                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                              <div className="field">
                                <label>{t('hutangPiutang.colDueDate')}</label>
                                <DateField value={editDueDate} onChange={setEditDueDate} />
                              </div>
                              <div className="field">
                                <label>{t('hutangPiutang.colInvoice')}</label>
                                <input value={editInvoiceNo} onChange={(e) => setEditInvoiceNo(e.target.value)} />
                              </div>
                              <div className="field">
                                <label>{t('hutangPiutang.colAmount')}</label>
                                <CurrencyInput value={editAmount} onChange={setEditAmount} />
                              </div>
                                  <div className="field" style={{ minWidth: 260 }}>
                                    <label>{t('receiptUpload.label')}</label>
                                    {editCurrentReceiptPath && !editRemoveReceipt && !editReceiptFile && (
                                      <div className="receipt-chip" style={{ marginBottom: 6 }}>
                                        <Paperclip size={14} />
                                        <span>{t('laporanTransaksi.viewReceipt')}</span>
                                        <button type="button" onClick={() => handleViewReceipt(editCurrentReceiptPath)} title={t('laporanTransaksi.viewReceipt')} style={{ marginLeft: 6 }}>
                                          <Paperclip size={13} />
                                        </button>
                                        <button type="button" onClick={() => setEditRemoveReceipt(true)} title={t('common.delete')}>
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    )}
                                    {editRemoveReceipt && (
                                      <p className="hint">
                                        {t('receiptUpload.willBeRemoved')}{' '}
                                        <button type="button" className="btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setEditRemoveReceipt(false)}>
                                          {t('common.cancel')}
                                        </button>
                                      </p>
                                    )}
                                    {!editRemoveReceipt && (
                                      <ReceiptUpload file={editReceiptFile} setFile={setEditReceiptFile} />
                                    )}
                                  </div>
                              <button className="btn-primary" disabled={editSaving} onClick={() => handleSaveEdit(r)}>
                                {editSaving ? t('transaksi.saving') : t('costCenter.save')}
                              </button>
                            </div>
                            {editError && <p className="error" style={{ padding: '0 16px 14px' }}>{editError}</p>}
                            <p className="hint" style={{ padding: '0 16px 14px', margin: 0 }}>{t('hutangPiutang.editHint')}</p>
                            </>
                            )}
                          </td>
                        </tr>
                      )}
                      {isPaying && (
                        <tr>
                          <td colSpan={9} style={{ background: 'var(--surface-alt)', padding: 0 }}>
                            <div className="inline-form" style={{ padding: 16, margin: 0 }}>
                              <div className="field">
                                <label>{t('hutangPiutang.payDate')}</label>
                                <DateField value={payDate} onChange={setPayDate} required />
                              </div>
                              <div className="field">
                                <label>{t('hutangPiutang.payAmount', { sisa: sisa.toLocaleString(i18n.language) })}</label>
                                <CurrencyInput value={payAmount} onChange={setPayAmount} />
                              </div>
                              <div className="field">
                                <label>{r.type === 'piutang' ? t('hutangPiutang.payAccountIn') : t('hutangPiutang.payAccountOut')}</label>
                                <select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} required>
                                  <option value="">{t('transaksi.selectAccount')}</option>
                                  {paymentAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                                </select>
                              </div>
                              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                                <label>{t('transaksi.note')}</label>
                                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={t('hutangPiutang.payNotePlaceholder')} />
                              </div>
                              <button className="btn-primary" disabled={paySaving} onClick={() => handlePay(r)}>
                                {paySaving ? t('transaksi.saving') : t('hutangPiutang.confirmPayButton')}
                              </button>
                            </div>
                            {payError && <p className="error" style={{ padding: '0 16px 14px' }}>{payError}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
        {!filtered.length && <p className="hint">{t('hutangPiutang.noData')}</p>}
      </div>
    </div>
  )
}
