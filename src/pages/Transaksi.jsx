import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList, TrendingUp, TrendingDown, CreditCard, Receipt, PiggyBank,
  Wallet, ArrowLeftRight, Clock3, SlidersHorizontal, ArrowRight, Plus, Trash2, CheckCircle2, AlertCircle, Percent,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { TRANSACTION_TYPES, getTypeConfig } from '../lib/transactionTypes'
import CurrencyInput from '../components/CurrencyInput.jsx'
import { DateField, DateTimeField } from '../components/DateField.jsx'
import { useCompany } from '../lib/CompanyContext.jsx'
import ViewerNotice from '../components/ViewerNotice.jsx'
import ReceiptUpload, { uploadReceiptIfNeeded } from '../components/ReceiptUpload.jsx'

const TYPE_ICON = {
  general: ClipboardList, pemasukan: TrendingUp, pengeluaran: TrendingDown,
  hutang: CreditCard, piutang: Receipt, tanam_modal: PiggyBank, tarik_modal: Wallet,
  transfer: ArrowLeftRight, pemasukan_sebagai_piutang: Clock3, pengeluaran_sebagai_hutang: Clock3,
  penyesuaian: SlidersHorizontal,
}

// Preset jenis pajak Indonesia yang umum dipakai — biar gak cuma PPN/PPh 21/23.
// Persentase & arahnya cuma nilai awal/saran, tetap bisa diubah manual.
const TAX_PRESETS = [
  { key: 'ppn', label: 'PPN (11%)', pct: 11, direction: 'add' },
  { key: 'pph21', label: 'PPh 21 (Karyawan)', pct: 5, direction: 'withhold' },
  { key: 'pph22', label: 'PPh 22', pct: 1.5, direction: 'withhold' },
  { key: 'pph23_jasa', label: 'PPh 23 — Jasa (2%)', pct: 2, direction: 'withhold' },
  { key: 'pph23_lain', label: 'PPh 23 — Dividen/Bunga/Royalti (15%)', pct: 15, direction: 'withhold' },
  { key: 'pph25', label: 'PPh 25 (Angsuran)', pct: 0, direction: 'add' },
  { key: 'pph26', label: 'PPh 26 (Non-Resident, 20%)', pct: 20, direction: 'withhold' },
  { key: 'pph_final_umkm', label: 'PPh Final UMKM (0,5%)', pct: 0.5, direction: 'withhold' },
  { key: 'pph_final_sewa', label: 'PPh Final — Sewa Tanah/Bangunan (10%)', pct: 10, direction: 'withhold' },
  { key: 'pph_final_konstruksi', label: 'PPh Final — Jasa Konstruksi', pct: 3, direction: 'withhold' },
  { key: 'custom', label: 'Custom / Lainnya', pct: 0, direction: 'add' },
]

const TERMIN_OPTIONS = [0, 7, 14, 30, 60, 90, 'custom']

let lineIdCounter = 0
function newLine() { lineIdCounter += 1; return { id: lineIdCounter, account_id: '', debit: 0, credit: 0 } }

export default function Transaksi() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const navigate = useNavigate()

  const [accounts, setAccounts] = useState([])
  const [contacts, setContacts] = useState([])
  const [costCenters, setCostCenters] = useState([])
  const [costCenterId, setCostCenterId] = useState('')
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [warehouses, setWarehouses] = useState([])
  const [warehouseId, setWarehouseId] = useState('')
  const [type, setType] = useState('pemasukan')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [debitAccount, setDebitAccount] = useState('')
  const [creditAccount, setCreditAccount] = useState('')
  const [nominal, setNominal] = useState('')
  const [note, setNote] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [contactId, setContactId] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Khusus Hutang/Piutang: termin pembayaran
  const [invoiceNo, setInvoiceNo] = useState('')
  const [termin, setTermin] = useState(30)
  const [customDueDate, setCustomDueDate] = useState('')

  // Khusus Pemasukan/Pengeluaran: pajak & bunga opsional
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxType, setTaxType] = useState('ppn')
  const [taxAccountId, setTaxAccountId] = useState('')
  const [taxPct, setTaxPct] = useState(11)
  const [taxDirection, setTaxDirection] = useState('add') // 'add' | 'withhold'
  const [interestEnabled, setInterestEnabled] = useState(false)
  const [interestAccountId, setInterestAccountId] = useState('')
  const [interestPct, setInterestPct] = useState(0)

  // Khusus jenis "Penyesuaian"/"General": jurnal multi-baris (bukan cuma 1 debit + 1 kredit)
  const [adjLines, setAdjLines] = useState(() => [newLine(), newLine()])

  const config = useMemo(() => getTypeConfig(type), [type])
  const isAdjustment = type === 'penyesuaian' || type === 'general'
  const isHutangPiutang = type === 'hutang' || type === 'piutang'
  const isCashFlow = type === 'pemasukan' || type === 'pengeluaran'

  useEffect(() => {
    if (!companyId) return
    supabase
      .from('accounts')
      .select('id, code, name, category')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setAccounts(data || [])
      })
    supabase
      .from('contacts')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')
      .then(({ data }) => setContacts(data || []))
    supabase
      .from('cost_centers')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code')
      .then(({ data }) => setCostCenters(data || []))
    supabase.from('departments').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code')
      .then(({ data }) => setDepartments(data || []))
    supabase.from('projects').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code')
      .then(({ data }) => setProjects(data || []))
    supabase.from('warehouses').select('id, code, name').eq('company_id', companyId).eq('is_active', true).order('code')
      .then(({ data }) => setWarehouses(data || []))
  }, [companyId])

  // Reset pilihan akun tiap jenis transaksi ganti (biar gak kebawa akun yang gak relevan)
  useEffect(() => {
    setDebitAccount('')
    setCreditAccount('')
    setAdjLines([newLine(), newLine()])
    setTaxEnabled(false)
    setInterestEnabled(false)
    setInvoiceNo('')
    setTermin(30)
  }, [type])

  function filteredAccounts(categoryFilter) {
    if (!categoryFilter) return accounts
    return accounts.filter((a) => categoryFilter.includes(a.category))
  }

  function updateLine(id, patch) {
    setAdjLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setAdjLines((lines) => [...lines, newLine()])
  }
  function removeLine(id) {
    setAdjLines((lines) => (lines.length > 2 ? lines.filter((l) => l.id !== id) : lines))
  }

  const adjTotalDebit = adjLines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const adjTotalCredit = adjLines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const adjBalanced = adjLines.length >= 2 && adjTotalDebit > 0 && Math.round(adjTotalDebit * 100) === Math.round(adjTotalCredit * 100)

  const dpp = Number(nominal) || 0
  const taxAmount = taxEnabled ? Math.round(dpp * (Number(taxPct) || 0)) / 100 : 0
  const interestAmount = interestEnabled ? Math.round(dpp * (Number(interestPct) || 0)) / 100 : 0
  const taxAccountOptions = filteredAccounts(['hutang', 'harta_lancar_lainnya'])
  const interestAccountOptions = filteredAccounts(type === 'pemasukan' ? ['pendapatan'] : ['beban_operasional'])

  function computeDueDate() {
    if (termin === 'custom') return customDueDate
    const d = new Date(date)
    d.setDate(d.getDate() + Number(termin))
    return d.toISOString().slice(0, 10)
  }

  function handleTaxTypeChange(key) {
    setTaxType(key)
    const preset = TAX_PRESETS.find((p) => p.key === key)
    if (preset && key !== 'custom') {
      setTaxPct(preset.pct)
      setTaxDirection(preset.direction)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    let lines
    let extraParams = {}

    if (isAdjustment) {
      if (!adjBalanced) {
        setError(t('transaksi.adjNotBalancedError'))
        return
      }
      if (adjLines.some((l) => !l.account_id)) {
        setError(t('transaksi.errChooseAccounts'))
        return
      }
      lines = adjLines.map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
    } else {
      const amount = Number(nominal)
      if (!debitAccount || !creditAccount) {
        setError(t('transaksi.errChooseAccounts'))
        return
      }
      if (debitAccount === creditAccount) {
        setError(t('transaksi.errSameAccount'))
        return
      }
      if (!amount || amount <= 0) {
        setError(t('transaksi.errAmount'))
        return
      }

      if (isHutangPiutang) {
        if (!contactId) { setError(t('transaksi.errContactRequired')); return }
        const dueDate = computeDueDate()
        if (!dueDate) { setError(t('transaksi.errDueDateRequired')); return }
        extraParams = { p_due_date: dueDate, p_invoice_no: invoiceNo.trim() || null }
        lines = [
          { account_id: debitAccount, debit: amount, credit: 0 },
          { account_id: creditAccount, debit: 0, credit: amount },
        ]
      } else if (isCashFlow) {
        if (taxEnabled && !taxAccountId) { setError(t('transaksi.errTaxAccountRequired')); return }
        if (interestEnabled && !interestAccountId) { setError(t('transaksi.errInterestAccountRequired')); return }

        let kasAdjust = 0
        if (taxEnabled) kasAdjust += taxDirection === 'add' ? taxAmount : -taxAmount
        if (interestEnabled) kasAdjust += interestAmount

        if (type === 'pemasukan') {
          lines = [
            { account_id: debitAccount, debit: amount + kasAdjust, credit: 0 }, // kas/bank
            { account_id: creditAccount, debit: 0, credit: amount }, // pendapatan
          ]
          if (taxEnabled) {
            lines.push(taxDirection === 'add'
              ? { account_id: taxAccountId, debit: 0, credit: taxAmount }
              : { account_id: taxAccountId, debit: taxAmount, credit: 0 })
          }
          if (interestEnabled) lines.push({ account_id: interestAccountId, debit: 0, credit: interestAmount })
        } else {
          lines = [
            { account_id: debitAccount, debit: amount, credit: 0 }, // beban
            { account_id: creditAccount, debit: 0, credit: amount + kasAdjust }, // kas/bank
          ]
          if (taxEnabled) {
            lines.push(taxDirection === 'add'
              ? { account_id: taxAccountId, debit: taxAmount, credit: 0 }
              : { account_id: taxAccountId, debit: 0, credit: taxAmount })
          }
          if (interestEnabled) lines.push({ account_id: interestAccountId, debit: interestAmount, credit: 0 })
        }
      } else {
        lines = [
          { account_id: debitAccount, debit: amount, credit: 0 },
          { account_id: creditAccount, debit: 0, credit: amount },
        ]
      }
    }

    if (!note.trim()) {
      setError(t('transaksi.errNote'))
      return
    }

    setSaving(true)
    let receiptPath = null
    try {
      receiptPath = await uploadReceiptIfNeeded(supabase, companyId, receiptFile)
    } catch (uploadErr) {
      setSaving(false)
      setError(uploadErr.message)
      return
    }
    const { error } = await supabase.rpc('create_transaction', {
      p_company_id: companyId,
      p_date: new Date(date).toISOString(),
      p_type: type,
      p_note: note.trim(),
      p_contact_id: contactId || null,
      p_lines: lines,
      p_cost_center_id: costCenterId || null,
      p_department_id: departmentId || null,
      p_project_id: projectId || null,
      p_warehouse_id: warehouseId || null,
      p_receipt_path: receiptPath,
      ...extraParams,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  if (!companyId) {
    return (
      <div>
        <div className="p-6">{t('transaksi.selectCompanyFirst')}</div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="p-6">
        <div className="page-header"><h1>{t('transaksi.title')}</h1></div>
        <ViewerNotice />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('transaksi.title')}</h1></div>

      <div className="txn-layout">
        {/* ---- Panel kiri: pilih jenis transaksi secara visual ---- */}
        <div className="txn-type-panel">
          <div className="txn-type-panel-label">{t('transaksi.selectTypeLabel')}</div>
          <div className="txn-type-grid">
            {TRANSACTION_TYPES.map((tt) => {
              const Icon = TYPE_ICON[tt.value] || ClipboardList
              return (
                <button
                  key={tt.value}
                  type="button"
                  className={`txn-type-card ${type === tt.value ? 'active' : ''} ${tt.value === 'penyesuaian' ? 'adjustment' : ''}`}
                  onClick={() => setType(tt.value)}
                >
                  <Icon size={18} />
                  <span>{t(`transactionTypes.${tt.labelKey}`)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ---- Panel kanan: form ---- */}
        <form className="txn-form-panel" onSubmit={handleSubmit}>
          <div className="txn-form-row">
            <div className="field">
              <label>{t('transaksi.dateTime')}</label>
              <DateTimeField value={date} onChange={setDate} required />
            </div>
            <div className="field">
              <label>{isHutangPiutang ? t('transaksi.contactRequired') : t('transaksi.contactOptional')}</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} required={isHutangPiutang}>
                <option value="">{t('transaksi.select')}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {costCenters.length > 0 && (
            <div className="field">
              <label>{t('transaksi.costCenterOptional')}</label>
              <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
                <option value="">{t('transaksi.select')}</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          )}

          {(departments.length > 0 || projects.length > 0 || warehouses.length > 0) && (
            <div className="dimension-row">
              {departments.length > 0 && (
                <div className="field">
                  <label>{t('department.optionalLabel')}</label>
                  <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">{t('transaksi.select')}</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
              )}
              {projects.length > 0 && (
                <div className="field">
                  <label>{t('project.optionalLabel')}</label>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">{t('transaksi.select')}</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
              )}
              {warehouses.length > 0 && (
                <div className="field">
                  <label>{t('warehouse.optionalLabel')}</label>
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    <option value="">{t('transaksi.select')}</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {isHutangPiutang && (
            <div className="txn-form-row">
              <div className="field">
                <label>{t('transaksi.invoiceNo')}</label>
                <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder={t('transaksi.invoiceNoPlaceholder')} />
              </div>
              <div className="field">
                <label>{t('transaksi.terminLabel')}</label>
                <select value={termin} onChange={(e) => setTermin(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}>
                  {TERMIN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'custom' ? t('transaksi.terminCustom') : opt === 0 ? t('transaksi.terminCod') : t('transaksi.terminNet', { days: opt })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {isHutangPiutang && (
            <div className="field">
              <label>{t('transaksi.dueDateLabel')}</label>
              {termin === 'custom'
                ? <DateField value={customDueDate} onChange={setCustomDueDate} required />
                : <div className="date-field-input" style={{ cursor: 'default', background: 'var(--surface-alt)' }}>{computeDueDate()}</div>}
            </div>
          )}

          {isAdjustment ? (
            <div className="adj-box">
              <div className="adj-box-header">
                <SlidersHorizontal size={16} />
                <div>
                  <div className="adj-box-title">{type === 'general' ? t('transaksi.generalTitle') : t('transaksi.adjTitle')}</div>
                  <div className="adj-box-desc">{type === 'general' ? t('transaksi.generalDesc') : t('transaksi.adjDesc')}</div>
                </div>
              </div>

              <div className="adj-lines">
                {adjLines.map((line, idx) => (
                  <div className="adj-line" key={line.id}>
                    <span className="adj-line-no">{idx + 1}</span>
                    <select
                      value={line.account_id}
                      onChange={(e) => updateLine(line.id, { account_id: e.target.value })}
                      required
                    >
                      <option value="">{t('transaksi.selectAccount')}</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                      ))}
                    </select>
                    <div className="adj-line-amount">
                      <label>{t('transactionTypes.debit')}</label>
                      <CurrencyInput value={line.debit} onChange={(v) => updateLine(line.id, { debit: v, credit: v ? 0 : line.credit })} />
                    </div>
                    <div className="adj-line-amount">
                      <label>{t('transactionTypes.credit')}</label>
                      <CurrencyInput value={line.credit} onChange={(v) => updateLine(line.id, { credit: v, debit: v ? 0 : line.debit })} />
                    </div>
                    <button
                      type="button"
                      className="btn-icon-danger"
                      onClick={() => removeLine(line.id)}
                      disabled={adjLines.length <= 2}
                      title={t('transaksi.adjRemoveLine')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="btn-secondary adj-add-line-btn" onClick={addLine}>
                <Plus size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('transaksi.adjAddLine')}
              </button>

              <div className={`adj-balance-bar ${adjBalanced ? 'ok' : 'off'}`}>
                <div>
                  <span>{t('transaksi.adjTotalDebit')}</span>
                  <strong>{adjTotalDebit.toLocaleString('id-ID')}</strong>
                </div>
                <div>
                  <span>{t('transaksi.adjTotalCredit')}</span>
                  <strong>{adjTotalCredit.toLocaleString('id-ID')}</strong>
                </div>
                <div className="adj-balance-status">
                  {adjBalanced ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  {adjBalanced ? t('transaksi.adjBalanced') : t('transaksi.adjNotBalanced', { amount: Math.abs(adjTotalDebit - adjTotalCredit).toLocaleString('id-ID') })}
                </div>
              </div>
            </div>
          ) : (
            <div className="txn-flow-box">
              <div className="txn-flow-side debit">
                <span className="txn-flow-badge debit">{t('transactionTypes.debit')}</span>
                <label>{t(`transactionTypes.${config.debitLabelKey}`)}</label>
                <select value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)} required>
                  <option value="">{t('transaksi.selectAccount')}</option>
                  {filteredAccounts(config.debitCategoryFilter).map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                  ))}
                </select>
              </div>
              <div className="txn-flow-arrow"><ArrowRight size={20} /></div>
              <div className="txn-flow-side credit">
                <span className="txn-flow-badge credit">{t('transactionTypes.credit')}</span>
                <label>{t(`transactionTypes.${config.creditLabelKey}`)}</label>
                <select value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)} required>
                  <option value="">{t('transaksi.selectAccount')}</option>
                  {filteredAccounts(config.creditCategoryFilter).map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isAdjustment && (
            <div className="field">
              <label>{t('transaksi.amount')}</label>
              <CurrencyInput value={nominal} onChange={setNominal} required />
            </div>
          )}

          {isCashFlow && (
            <div className="tax-box">
              <label className="tax-toggle-row">
                <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
                <Percent size={14} /> {t('transaksi.taxToggle')}
              </label>
              {taxEnabled && (
                <div className="tax-toggle-body">
                  <div className="field">
                    <label>{t('transaksi.taxType')}</label>
                    <select value={taxType} onChange={(e) => handleTaxTypeChange(e.target.value)}>
                      {TAX_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t('transaksi.taxAccount')}</label>
                    <select value={taxAccountId} onChange={(e) => setTaxAccountId(e.target.value)} required={taxEnabled}>
                      <option value="">{t('transaksi.selectAccount')}</option>
                      {taxAccountOptions.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
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
                  <div className="tax-computed">{t('transaksi.taxAmountLabel')}: <strong>{taxAmount.toLocaleString('id-ID')}</strong></div>
                </div>
              )}

              <label className="tax-toggle-row" style={{ marginTop: taxEnabled ? 14 : 0 }}>
                <input type="checkbox" checked={interestEnabled} onChange={(e) => setInterestEnabled(e.target.checked)} />
                <Percent size={14} /> {t('transaksi.interestToggle')}
              </label>
              {interestEnabled && (
                <div className="tax-toggle-body">
                  <div className="field">
                    <label>{t('transaksi.interestAccount')}</label>
                    <select value={interestAccountId} onChange={(e) => setInterestAccountId(e.target.value)} required={interestEnabled}>
                      <option value="">{t('transaksi.selectAccount')}</option>
                      {interestAccountOptions.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t('transaksi.interestPct')}</label>
                    <input type="number" min="0" step="0.1" value={interestPct} onChange={(e) => setInterestPct(e.target.value)} />
                  </div>
                  <div className="tax-computed">{t('transaksi.interestAmountLabel')}: <strong>{interestAmount.toLocaleString('id-ID')}</strong></div>
                </div>
              )}
            </div>
          )}

          <div className="txn-form-row">
            <div className="field">
              <label>{t('transaksi.note')}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} required />
            </div>
            <ReceiptUpload file={receiptFile} setFile={setReceiptFile} />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={saving || (isAdjustment && !adjBalanced)}>
            {saving ? t('transaksi.saving') : t('transaksi.save')}
          </button>
        </form>
      </div>
    </div>
  )
}
