import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import CurrencyInput from '../../components/CurrencyInput.jsx'
import { DateField } from '../../components/DateField.jsx'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'

const CATEGORIES = [
  'kas_bank', 'piutang', 'persediaan', 'harta_lancar_lainnya', 'harta_tetap',
  'hutang', 'modal', 'pendapatan', 'beban_pokok', 'beban_operasional',
]
const PAGE_SIZE = 50

export default function Akun() {
  const { t } = useTranslation()
  const CATEGORY_LABEL = {
    kas_bank: t('akun.catKasBank'), piutang: t('akun.catPiutang'), persediaan: t('akun.catPersediaan'),
    harta_lancar_lainnya: t('akun.catHartaLancarLainnya'), harta_tetap: t('akun.catHartaTetap'),
    hutang: t('akun.catHutang'), modal: t('akun.catModal'), pendapatan: t('akun.catPendapatan'),
    beban_pokok: t('akun.catBebanPokok'), beban_operasional: t('akun.catBebanOperasional'),
  }
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [accounts, setAccounts] = useState([])
  const [allAccountsLite, setAllAccountsLite] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const fromUrl = searchParams.get('q')
    if (fromUrl) setQ(fromUrl)
  }, [searchParams])
  // Debounce pencarian 350ms biar gak nembak query ke server tiap ketikan huruf
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQ(q); setPage(0) }, 350)
    return () => clearTimeout(timer)
  }, [q])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', category: 'kas_bank', normal_balance: 'debit', description: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [showSaldoAwal, setShowSaldoAwal] = useState(false)
  const [sa, setSa] = useState({ account_id: '', amount: 0, date: new Date().toISOString().slice(0, 10), note: t('akun.notePlaceholder') || 'Saldo Awal' })
  const [saError, setSaError] = useState(null)
  const [saSaving, setSaSaving] = useState(false)
  const [saSuccess, setSaSuccess] = useState(null)

  useEffect(() => { load() }, [companyId, page, debouncedQ])

  // Daftar RINGAN (cuma id/code/name) buat dropdown "atur saldo awal" — perlu SEMUA akun,
  // gak dibatasi halaman seperti tabel utama, tapi tetap ringan karena kolomnya sedikit.
  useEffect(() => {
    if (!companyId) return
    supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .order('code')
      .then(({ data }) => setAllAccountsLite(data || []))
  }, [companyId, totalCount])

  async function load() {
    // Pagination server-side (bukan ambil semua akun sekaligus) supaya query tetap
    // ringan walau COA-nya sudah punya ratusan/ribuan akun.
    let query = supabase
      .from('accounts')
      .select('id, code, name, category, normal_balance, description, is_locked', { count: 'exact' })
      .eq('company_id', companyId)
      .order('code')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (debouncedQ.trim()) {
      query = query.or(`name.ilike.%${debouncedQ.trim()}%,code.ilike.%${debouncedQ.trim()}%`)
    }
    const { data, error, count } = await query
    if (error) setError(error.message)
    else {
      setAccounts(data || [])
      setTotalCount(count || 0)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const { error } = await supabase.from('accounts').insert({ company_id: companyId, ...form })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm({ code: '', name: '', category: 'kas_bank', normal_balance: 'debit', description: '' })
    setShowForm(false)
    load()
  }

  async function handleDelete(a) {
    if (!confirm(t('common.confirmDelete', { name: a.name }))) return
    setError(null)
    const { error } = await supabase.from('accounts').delete().eq('id', a.id)
    if (error) { setError(error.message); return }
    load()
  }

  async function handleSaldoAwal(e) {
    e.preventDefault()
    setSaError(null)
    setSaSuccess(null)
    setSaSaving(true)
    const { error } = await supabase.rpc('set_account_opening_balance', {
      p_company_id: companyId,
      p_account_id: sa.account_id,
      p_amount: sa.amount,
      p_date: sa.date,
      p_note: sa.note || 'Saldo Awal',
    })
    setSaSaving(false)
    if (error) { setSaError(error.message); return }
    setSaSuccess(t('akun.openingBalanceSuccess'))
    setSa({ account_id: '', amount: 0, date: new Date().toISOString().slice(0, 10), note: 'Saldo Awal' })
  }

  // Akun "Saldo Awal" (3-30099) itu penyeimbang otomatis sistem — sembunyikan dari
  // pilihan "atur saldo awal untuk akun ini", gak masuk akal atur saldo awal utk dia sendiri.
  const saldoAwalTargetAccounts = allAccountsLite.filter((a) => a.code !== '3-30099')
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div>
      <div className="p-6">
        <div className="page-header">
          <h1>{t('akun.title')}</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder={t('akun.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
            {canEdit && (
              <>
                <button className="btn-secondary" onClick={() => setShowSaldoAwal(!showSaldoAwal)}>
                  {showSaldoAwal ? t('akun.closeSaldoAwal') : t('akun.openSaldoAwal')}
                </button>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                  {showForm ? t('akun.closeForm') : t('akun.addAccount')}
                </button>
              </>
            )}
          </div>
        </div>

        {!canEdit && <ViewerNotice />}

        {canEdit && showSaldoAwal && (
          <form className="section inline-form" onSubmit={handleSaldoAwal}>
            <div className="field">
              <label>{t('akun.account')}</label>
              <select value={sa.account_id} onChange={(e) => setSa({ ...sa, account_id: e.target.value })} required>
                <option value="">{t('akun.selectAccount')}</option>
                {saldoAwalTargetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('akun.amount')}</label>
              <CurrencyInput value={sa.amount} onChange={(v) => setSa({ ...sa, amount: v })} required />
            </div>
            <div className="field">
              <label>{t('akun.perDate')}</label>
              <DateField value={sa.date} onChange={(v) => setSa({ ...sa, date: v })} required />
            </div>
            <div className="field">
              <label>{t('akun.note')}</label>
              <input value={sa.note} onChange={(e) => setSa({ ...sa, note: e.target.value })} />
            </div>
            <button className="btn-primary" disabled={saSaving}>{saSaving ? t('akun.saving') : t('akun.saveOpeningBalance')}</button>
            <p className="hint" style={{ flexBasis: '100%', marginTop: 0 }}>
              {t('akun.openingBalanceHint')}
            </p>
            {saError && <p className="error" style={{ flexBasis: '100%' }}>{saError}</p>}
            {saSuccess && <p style={{ flexBasis: '100%', color: 'var(--positive)', fontSize: 13 }}>{saSuccess}</p>}
          </form>
        )}

        {canEdit && showForm && (
          <form className="section inline-form" onSubmit={handleAdd}>
            <div className="field">
              <label>{t('akun.code')}</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={t('akun.codePlaceholder')} required />
            </div>
            <div className="field">
              <label>{t('akun.name')}</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>{t('akun.category')}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('akun.normalBalance')}</label>
              <select value={form.normal_balance} onChange={(e) => setForm({ ...form, normal_balance: e.target.value })}>
                <option value="debit">{t('transactionTypes.debit')}</option>
                <option value="kredit">{t('transactionTypes.credit')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('akun.descriptionLabel')}</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <button className="btn-primary" disabled={saving}>{saving ? t('akun.saving') : t('akun.save')}</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}

        <table className="tbl">
          <thead>
            <tr><th>{t('akun.colCode')}</th><th>{t('akun.colName')}</th><th>{t('akun.colCategory')}</th><th>{t('akun.colNormalBalance')}</th><th>{t('akun.colDescription')}</th>{canEdit && <th></th>}</tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.code} {a.is_locked && '🔒'}</td>
                <td>{a.name}</td>
                <td>{CATEGORY_LABEL[a.category] || a.category}</td>
                <td style={{ textTransform: 'capitalize' }}>{a.normal_balance}</td>
                <td>{a.description}</td>
                {canEdit && (
                  <td>
                    <button
                      className="btn-icon-danger"
                      onClick={() => handleDelete(a)}
                      disabled={a.is_locked}
                      title={a.is_locked ? t('akun.lockedHint') : t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!accounts.length && <tr><td colSpan={6} className="empty">{t('akun.noAccounts')}</td></tr>}
          </tbody>
        </table>

        {totalCount > PAGE_SIZE && (
          <div className="pagination-bar">
            <span className="pagination-info">
              {t('common.paginationInfo', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, totalCount), total: totalCount })}
            </span>
            <div className="pagination-controls">
              <button className="btn-secondary" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                {t('common.prevPage')}
              </button>
              <span className="pagination-page">{page + 1} / {totalPages}</span>
              <button className="btn-secondary" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                {t('common.nextPage')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
