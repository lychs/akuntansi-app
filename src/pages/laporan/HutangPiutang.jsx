import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ExportMenu from '../../components/ExportMenu.jsx'
import DimensionFilters, { useDimensionFilters } from '../../components/DimensionFilters.jsx'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'

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

  useEffect(() => { load() }, [companyId, dim.depsKey])

  useEffect(() => {
    if (!companyId) return
    supabase.from('accounts').select('id, code, name').eq('company_id', companyId).eq('category', 'kas_bank').order('code')
      .then(({ data }) => setPaymentAccounts(data || []))
  }, [companyId])

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
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayAmount(Number(r.sisa))
    setPayAccountId('')
    setPayNote('')
    setPayError(null)
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
                          <td>
                            {sisa > 0 && (
                              <button className="btn-secondary" style={{ padding: '5px 10px' }} onClick={() => (isPaying ? setPayingId(null) : openPayForm(r))}>
                                <Wallet size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                                {t('hutangPiutang.payButton')}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
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
