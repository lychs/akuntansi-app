import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, Paperclip, Pencil, Trash2, Plus, Percent, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import PeriodFilter, { usePeriod } from '../../components/PeriodFilter.jsx'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import { DateTimeField, DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import { DOC_TYPE_BY_TRANSACTION_TYPE, generateTransactionDocument } from '../../lib/documentPrint.js'
import { TAX_PRESETS } from '../../lib/taxPresets.js'
import ReceiptUpload, { uploadReceiptIfNeeded } from '../../components/ReceiptUpload.jsx'

const SIMPLE_TYPES = ['general', 'penyesuaian', 'pemasukan', 'pengeluaran', 'tanam_modal', 'tarik_modal', 'transfer']
const HP_TYPES = ['piutang', 'hutang']
const DAGANG_DELETE_TYPES = ['pembelian_barang', 'penjualan_barang', 'retur_pembelian', 'retur_penjualan', 'saldo_awal']
const PAYMENT_DELETE_TYPES = ['pemasukan_sebagai_piutang', 'pengeluaran_sebagai_hutang']
let lineIdCounter = 0
function newLine() { lineIdCounter += 1; return { id: lineIdCounter, account_id: '', debit: '', credit: '' } }

export default function LaporanTransaksi() {
  const { t, i18n } = useTranslation()
  const tid = i18n.getFixedT('id')
  const ten = i18n.getFixedT('en')
  const TYPE_LABEL = {
    general: t('laporanTransaksi.typeGeneral'), pemasukan: t('laporanTransaksi.typePemasukan'), pengeluaran: t('laporanTransaksi.typePengeluaran'),
    hutang: t('laporanTransaksi.typeHutang'), piutang: t('laporanTransaksi.typePiutang'), tanam_modal: t('laporanTransaksi.typeTanamModal'),
    tarik_modal: t('laporanTransaksi.typeTarikModal'), transfer: t('laporanTransaksi.typeTransfer'),
    pemasukan_sebagai_piutang: t('laporanTransaksi.typePelunasanPiutang'), pengeluaran_sebagai_hutang: t('laporanTransaksi.typePelunasanHutang'),
  }
  const companyId = localStorage.getItem('activeCompanyId')
  const { companies, canEdit, activePlan } = useCompany()
  const companyName = companies.find((c) => c.id === companyId)?.name || ''
  const period = usePeriod()
  const dim = useDimensionFilters(companyId)
  const [rows, setRows] = useState([])
  const [accounts, setAccounts] = useState([])
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editType, setEditType] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editContactId, setEditContactId] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editInvoiceNo, setEditInvoiceNo] = useState('')
  const [editLines, setEditLines] = useState([])
  const [editError, setEditError] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editReceiptFile, setEditReceiptFile] = useState(null)
  const [editRemoveReceipt, setEditRemoveReceipt] = useState(false)
  const [editCurrentReceiptPath, setEditCurrentReceiptPath] = useState(null)

  const [showTaxPanel, setShowTaxPanel] = useState(false)
  const [taxType, setTaxType] = useState('ppn')
  const [taxAccountId, setTaxAccountId] = useState('')
  const [taxPct, setTaxPct] = useState(11)
  const [taxDirection, setTaxDirection] = useState('add')

  useEffect(() => { load() }, [companyId, period.start, period.end, dim.depsKey])
  useEffect(() => {
    if (!companyId) return
    supabase.from('accounts').select('id, code, name, category').eq('company_id', companyId).order('code').then(({ data }) => setAccounts(data || []))
    supabase.from('contacts').select('id, name').eq('company_id', companyId).order('name').then(({ data }) => setContacts(data || []))
  }, [companyId])

  async function load() {
    const { data, error } = await supabase.rpc('get_transaction_report', {
      p_company_id: companyId,
      p_start: period.start,
      p_end: period.end + 'T23:59:59',
      ...dim.rpcParams,
    })
    if (error) { setError(error.message); return }
    setRows(data || [])
  }

  const typeKeyMap = {
    general: 'typeGeneral', pemasukan: 'typePemasukan', pengeluaran: 'typePengeluaran',
    hutang: 'typeHutang', piutang: 'typePiutang', tanam_modal: 'typeTanamModal', tarik_modal: 'typeTarikModal',
    transfer: 'typeTransfer', pemasukan_sebagai_piutang: 'typePelunasanPiutang', pengeluaran_sebagai_hutang: 'typePelunasanHutang',
  }
  const exportColumns = [
    { key: 'date', headerId: tid('laporanTransaksi.colDate'), headerEn: ten('laporanTransaksi.colDate'), align: 'left' },
    { key: 'type', headerId: tid('laporanTransaksi.colType'), headerEn: ten('laporanTransaksi.colType'), align: 'left' },
    { key: 'note', headerId: tid('laporanTransaksi.colNote'), headerEn: ten('laporanTransaksi.colNote'), align: 'left' },
    { key: 'contact', headerId: tid('laporanTransaksi.colContact'), headerEn: ten('laporanTransaksi.colContact'), align: 'left' },
    { key: 'amount', headerId: tid('laporanTransaksi.colAmount'), headerEn: ten('laporanTransaksi.colAmount'), align: 'right' },
  ]
  const exportRows = rows.map((t2) => {
    const tk = typeKeyMap[t2.type]
    return {
      date: new Date(t2.date).toLocaleString('id-ID'),
      type: tk ? `${tid(`laporanTransaksi.${tk}`)} / ${ten(`laporanTransaksi.${tk}`)}` : t2.type,
      note: t2.note,
      contact: t2.contact_name || '-',
      amount: Number(t2.total_amount),
    }
  })
  const exportConfig = {
    companyName,
    titleId: tid('laporanTransaksi.title'), titleEn: ten('laporanTransaksi.title'),
    periodTextId: `${tid('common.periodLabel')}: ${period.start} – ${period.end}`,
    periodTextEn: `${ten('common.periodLabel')}: ${period.start} – ${period.end}`,
    columns: exportColumns,
    rows: exportRows,
    fileBaseName: `laporan-transaksi_${period.start}_${period.end}`,
  }

  async function handlePrint(t2) {
    if (activePlan === 'free') {
      alert(t('laporanTransaksi.printLockedFree'))
      return
    }
    let lineItems = []
    if (['pembelian_barang', 'penjualan_barang', 'retur_pembelian', 'retur_penjualan'].includes(t2.type)) {
      const { data } = await supabase.rpc('get_transaction_line_items', { p_transaction_id: t2.id })
      lineItems = (data || []).map((r) => ({
        name: r.product_name, qty: Number(r.qty), unit: r.unit,
        unitPrice: Number(r.unit_cost), subtotal: Number(r.total_cost),
      }))
    }
    generateTransactionDocument(t2, companyName, lineItems)
  }

  async function handleViewReceipt(path) {
    const { data, error } = await supabase.storage.from('transaction-receipts').createSignedUrl(path, 60)
    if (error || !data) { alert(t('laporanTransaksi.errReceiptOpen')); return }
    window.open(data.signedUrl, '_blank')
  }

  async function openEdit(t2) {
    setEditError(null)
    setShowTaxPanel(false)
    setEditReceiptFile(null)
    setEditRemoveReceipt(false)
    setEditCurrentReceiptPath(t2.receipt_path || null)
    const { data, error } = await supabase.rpc('get_transaction_detail', { p_transaction_id: t2.id })
    if (error) { setError(error.message); return }
    setEditType(t2.type)
    setEditDate(new Date(t2.date).toISOString().slice(0, 16))
    setEditNote(t2.note || '')
    setEditContactId(t2.contact_id || '')
    setEditLines((data || []).map((r) => {
      lineIdCounter += 1
      return { id: lineIdCounter, account_id: r.account_id, debit: Number(r.debit) || '', credit: Number(r.credit) || '' }
    }))

    if (HP_TYPES.includes(t2.type)) {
      const { data: rp } = await supabase.from('receivables_payables').select('due_date, invoice_no').eq('transaction_id', t2.id).maybeSingle()
      setEditDueDate(rp?.due_date || '')
      setEditInvoiceNo(rp?.invoice_no || '')
    }
    setEditingId(t2.id)
  }

  function updateEditLine(id, patch) {
    setEditLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function addEditLine() { setEditLines((ls) => [...ls, newLine()]) }
  function removeEditLine(id) { setEditLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls)) }

  const editTotalDebit = editLines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const editTotalCredit = editLines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const editBalanced = editLines.length > 0 && editTotalDebit === editTotalCredit && editTotalDebit > 0

  function accountCategory(accountId) {
    return accounts.find((a) => a.id === accountId)?.category
  }

  function handleTaxTypeChange(key) {
    setTaxType(key)
    const preset = TAX_PRESETS.find((p) => p.key === key)
    if (preset && key !== 'custom') {
      setTaxPct(preset.pct)
      setTaxDirection(preset.direction)
    }
  }

  // Nambah baris pajak (akun ke-3) ke jurnal Piutang/Hutang yang lagi diedit —
  // sesuai kebiasaan riil: piutang/hutang bisa nambah (kena PPN) atau berkurang
  // (dipotong PPh) tergantung arah pajaknya, dan nominalnya otomatis disesuaikan.
  function handleApplyTax() {
    setEditError(null)
    if (!taxAccountId) { setEditError(t('laporanTransaksi.errTaxAccountRequired')); return }
    const hpCategory = editType === 'piutang' ? 'piutang' : 'hutang'
    const hpLine = editLines.find((l) => accountCategory(l.account_id) === hpCategory)
    if (!hpLine) { setEditError(t('laporanTransaksi.errNoHpLine', { cat: hpCategory })); return }

    const baseAmount = editType === 'piutang' ? Number(hpLine.debit) || 0 : Number(hpLine.credit) || 0
    const taxAmount = Math.round(baseAmount * (Number(taxPct) / 100))
    if (taxAmount <= 0) { setEditError(t('laporanTransaksi.errTaxAmountInvalid')); return }

    const newHpAmount = taxDirection === 'add' ? baseAmount + taxAmount : baseAmount - taxAmount
    if (newHpAmount <= 0) { setEditError(t('laporanTransaksi.errTaxAmountInvalid')); return }

    updateEditLine(hpLine.id, editType === 'piutang' ? { debit: newHpAmount } : { credit: newHpAmount })

    // add + piutang -> kredit akun pajak; withhold + piutang -> debit akun pajak (prepaid)
    // add + hutang -> debit akun pajak (recoverable); withhold + hutang -> kredit akun pajak (payable)
    const taxLine = newLine()
    if (editType === 'piutang') {
      if (taxDirection === 'add') taxLine.credit = taxAmount
      else taxLine.debit = taxAmount
    } else {
      if (taxDirection === 'add') taxLine.debit = taxAmount
      else taxLine.credit = taxAmount
    }
    taxLine.account_id = taxAccountId
    setEditLines((ls) => [...ls, taxLine])
    setShowTaxPanel(false)
    setTaxAccountId('')
  }

  async function handleSaveEdit(t2) {
    setEditError(null)
    if (!editBalanced) { setEditError(t('laporanTransaksi.errNotBalanced')); return }
    if (editLines.some((l) => !l.account_id)) { setEditError(t('laporanTransaksi.errAccountRequired')); return }

    setEditSaving(true)
    const linesPayload = editLines.map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))

    let error
    if (HP_TYPES.includes(editType)) {
      if (!editContactId) { setEditSaving(false); setEditError(t('laporanTransaksi.errContactRequired')); return }
      ;({ error } = await supabase.rpc('update_transaction_hutang_piutang', {
        p_transaction_id: t2.id,
        p_date: new Date(editDate).toISOString(),
        p_note: editNote.trim(),
        p_contact_id: editContactId,
        p_due_date: editDueDate || null,
        p_invoice_no: editInvoiceNo.trim() || null,
        p_lines: linesPayload,
      }))
    } else {
      ;({ error } = await supabase.rpc('update_transaction_simple', {
        p_transaction_id: t2.id,
        p_date: new Date(editDate).toISOString(),
        p_note: editNote.trim(),
        p_contact_id: null,
        p_lines: linesPayload,
      }))
    }
    if (error) { setEditSaving(false); setEditError(error.message); return }

    if (editReceiptFile) {
      try {
        const newPath = await uploadReceiptIfNeeded(supabase, companyId, editReceiptFile)
        await supabase.rpc('set_transaction_receipt', { p_transaction_id: t2.id, p_receipt_path: newPath })
      } catch (upErr) {
        setEditSaving(false)
        setEditError(upErr.message || String(upErr))
        return
      }
    } else if (editRemoveReceipt) {
      await supabase.rpc('set_transaction_receipt', { p_transaction_id: t2.id, p_receipt_path: null })
    }

    setEditSaving(false)
    setEditingId(null)
    load()
  }

  async function handleDelete(t2) {
    if (!confirm(t('laporanTransaksi.confirmDelete'))) return
    // "penyesuaian" dipakai BARENGAN oleh Penyesuaian biasa (Jasa) DAN Stock
    // Opname (Dagang) — makanya dua-duanya diarahkan ke fungsi yang aman buat
    // stok. Fungsi itu otomatis gak ngapa-ngapain kalau ternyata transaksinya
    // gak punya pergerakan stok (aman buat Penyesuaian biasa juga).
    const isDagang = DAGANG_DELETE_TYPES.includes(t2.type) || t2.type === 'penyesuaian'
    const isPayment = PAYMENT_DELETE_TYPES.includes(t2.type)
    const rpcName = HP_TYPES.includes(t2.type)
      ? 'delete_transaction_hutang_piutang'
      : isPayment ? 'delete_receivable_payment'
      : isDagang ? 'delete_transaction_dagang' : 'delete_transaction_simple'
    const { error } = await supabase.rpc(rpcName, { p_transaction_id: t2.id })
    if (error) { setError(error.message); return }
    load()
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('laporanTransaksi.title')}</h1>
          <ExportMenu config={exportConfig} />
        </div>
        <div className="filters">
          <PeriodFilter {...period} />
          <DimensionFilters {...dim} />
        </div>
        {error && <p className="error">{error}</p>}
        <table className="tbl">
          <thead>
            <tr><th>{t('laporanTransaksi.colDate')}</th><th>{t('laporanTransaksi.colType')}</th><th>{t('laporanTransaksi.colNote')}</th><th>{t('laporanTransaksi.colContact')}</th><th className="num">{t('laporanTransaksi.colAmount')}</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((t2) => {
              const isEditableType = SIMPLE_TYPES.includes(t2.type) || HP_TYPES.includes(t2.type)
              const isDeleteOnlyDagangType = DAGANG_DELETE_TYPES.includes(t2.type) || PAYMENT_DELETE_TYPES.includes(t2.type)
              const isEditing = editingId === t2.id
              const isHp = HP_TYPES.includes(editType)
              return (
                <Fragment key={t2.id}>
                  <tr>
                    <td>{new Date(t2.date).toLocaleString(i18n.language)}</td>
                    <td>{TYPE_LABEL[t2.type] || t2.type}</td>
                    <td>{t2.note}</td>
                    <td>{t2.contact_name || '-'}</td>
                    <td className="num">{Number(t2.total_amount).toLocaleString(i18n.language)}</td>
                    <td style={{ paddingTop: 11 }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {t2.receipt_path && (
                          <button className="btn-icon-danger" style={{ color: 'var(--brand)' }} onClick={() => handleViewReceipt(t2.receipt_path)} title={t('laporanTransaksi.viewReceipt')}>
                            <Paperclip size={14} />
                          </button>
                        )}
                        {DOC_TYPE_BY_TRANSACTION_TYPE[t2.type] && (
                          <button className="btn-icon-danger" style={{ color: activePlan === 'free' ? 'var(--ink-muted)' : 'var(--brand)' }} onClick={() => handlePrint(t2)} title={activePlan === 'free' ? t('laporanTransaksi.printLockedFree') : t('laporanTransaksi.printDocument')}>
                            {activePlan === 'free' ? <Lock size={14} /> : <Printer size={14} />}
                          </button>
                        )}
                        {canEdit && isEditableType && (
                          <>
                            <button className="btn-icon-danger" style={{ color: 'var(--brand)' }} onClick={() => (isEditing ? setEditingId(null) : openEdit(t2))} title={t('common.edit')}>
                              <Pencil size={14} />
                            </button>
                            <button className="btn-icon-danger" onClick={() => handleDelete(t2)} title={t('common.delete')}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {canEdit && isDeleteOnlyDagangType && (
                          <button className="btn-icon-danger" onClick={() => handleDelete(t2)} title={t('laporanTransaksi.deleteOnlySpecialTitle')}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--surface-alt)', padding: 16 }}>
                        <div className="txn-form-row" style={{ marginBottom: 12 }}>
                          <div className="field">
                            <label>{t('transaksi.dateTime')}</label>
                            <DateTimeField value={editDate} onChange={setEditDate} required />
                          </div>
                          <div className="field">
                            <label>{t('transaksi.note')}</label>
                            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                          </div>
                        </div>

                        {isHp && (
                          <div className="dimension-row" style={{ marginBottom: 12 }}>
                            <div className="field">
                              <label>{t('penjualanBarang.customer')}</label>
                              <select value={editContactId} onChange={(e) => setEditContactId(e.target.value)} required>
                                <option value="">{t('transaksi.select')}</option>
                                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div className="field">
                              <label>{t('transaksi.dueDateLabel')}</label>
                              <DateField value={editDueDate} onChange={setEditDueDate} />
                            </div>
                            <div className="field">
                              <label>{t('transaksi.invoiceNo')}</label>
                              <input value={editInvoiceNo} onChange={(e) => setEditInvoiceNo(e.target.value)} />
                            </div>
                          </div>
                        )}

                        <div className="adj-lines">
                          {editLines.map((line, idx) => (
                            <div key={line.id} className="adj-line" style={{ gridTemplateColumns: '22px 2fr 1fr 1fr 30px' }}>
                              <span className="adj-line-no">{idx + 1}</span>
                              <select value={line.account_id} onChange={(e) => updateEditLine(line.id, { account_id: e.target.value })}>
                                <option value="">{t('transaksi.selectAccount')}</option>
                                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                              </select>
                              <div className="adj-line-amount">
                                <label>{t('jurnal.colDebit')}</label>
                                <input type="number" min="0" step="any" value={line.debit} onChange={(e) => updateEditLine(line.id, { debit: e.target.value, credit: '' })} />
                              </div>
                              <div className="adj-line-amount">
                                <label>{t('jurnal.colCredit')}</label>
                                <input type="number" min="0" step="any" value={line.credit} onChange={(e) => updateEditLine(line.id, { credit: e.target.value, debit: '' })} />
                              </div>
                              <button type="button" className="btn-icon-danger" onClick={() => removeEditLine(line.id)} disabled={editLines.length <= 1}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn-secondary adj-add-line-btn" onClick={addEditLine}>
                            <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('transaksi.adjAddLine')}
                          </button>
                          {isHp && (
                            <button type="button" className="btn-secondary adj-add-line-btn" onClick={() => setShowTaxPanel(!showTaxPanel)}>
                              <Percent size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('laporanTransaksi.addTaxLine')}
                            </button>
                          )}
                        </div>

                        {isHp && showTaxPanel && (
                          <div className="tax-box" style={{ marginTop: 12 }}>
                            <div className="tax-toggle-body" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                              <div className="field">
                                <label>{t('transaksi.taxType')}</label>
                                <select value={taxType} onChange={(e) => handleTaxTypeChange(e.target.value)}>
                                  {TAX_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                                </select>
                              </div>
                              <div className="field">
                                <label>{t('transaksi.taxAccount')}</label>
                                <select value={taxAccountId} onChange={(e) => setTaxAccountId(e.target.value)}>
                                  <option value="">{t('transaksi.selectAccount')}</option>
                                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                                </select>
                              </div>
                              <div className="field">
                                <label>{t('transaksi.taxPct')}</label>
                                <input type="number" min="0" step="0.1" value={taxPct} onChange={(e) => { setTaxPct(e.target.value); setTaxType('custom') }} />
                              </div>
                              <div className="field">
                                <label>{t('transaksi.taxDirection')}</label>
                                <select value={taxDirection} onChange={(e) => setTaxDirection(e.target.value)}>
                                  <option value="add">{t('transaksi.taxDirectionAdd')}</option>
                                  <option value="withhold">{t('transaksi.taxDirectionWithhold')}</option>
                                </select>
                              </div>
                            </div>
                            <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={handleApplyTax}>
                              {t('laporanTransaksi.applyTax')}
                            </button>
                          </div>
                        )}

                        <div style={{ marginTop: 12, maxWidth: 320 }}>
                          {editCurrentReceiptPath && !editRemoveReceipt && !editReceiptFile && (
                            <div className="receipt-chip" style={{ marginBottom: 8 }}>
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

                        <div className={`adj-balance-bar ${editBalanced ? 'ok' : 'warn'}`}>
                          <div><span>{t('jurnal.colDebit')}</span><strong>{editTotalDebit.toLocaleString(i18n.language)}</strong></div>
                          <div><span>{t('jurnal.colCredit')}</span><strong>{editTotalCredit.toLocaleString(i18n.language)}</strong></div>
                        </div>

                        {editError && <p className="error" style={{ marginTop: 10 }}>{editError}</p>}
                        <button className="btn-primary" style={{ marginTop: 10 }} disabled={editSaving} onClick={() => handleSaveEdit(t2)}>
                          {editSaving ? t('transaksi.saving') : t('common.save')}
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!rows.length && <tr><td colSpan={6} className="empty">{t('laporanTransaksi.noData')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
