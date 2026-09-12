import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, Wallet, HandCoins, Clock3, ArrowUpRight, ArrowDownRight, Percent, Package } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { netAmount, sumCategory, monthBounds, monthsBetween, fmt, fmtCompact, trendPct, daysUntil, MONTH_LABEL } from '../lib/reportHelpers.js'

const TYPE_COLOR = {
  pemasukan: '#059669', pengeluaran: '#DC2626', hutang: '#D97706', piutang: '#8B5CF6',
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const TYPE_LABEL = {
    general: t('dashboard.typeGeneral'), pemasukan: t('dashboard.typePemasukan'), pengeluaran: t('dashboard.typePengeluaran'),
    hutang: t('dashboard.typeHutang'), piutang: t('dashboard.typePiutang'), tanam_modal: t('dashboard.typeTanamModal'),
    tarik_modal: t('dashboard.typeTarikModal'), transfer: t('dashboard.typeTransfer'),
    pemasukan_sebagai_piutang: t('dashboard.typePelunasanPiutang'), pengeluaran_sebagai_hutang: t('dashboard.typePelunasanHutang'),
  }
  const { activeCompanyId: companyId, activeBusinessType } = useCompany()
  const { session } = useAuth()
  const isDagang = activeBusinessType === 'dagang'
  const [displayName, setDisplayName] = useState('')
  const [kpi, setKpi] = useState(null)
  const [chartData, setChartData] = useState([])
  const [chartRange, setChartRange] = useState('6m')
  const [chartLoading, setChartLoading] = useState(false)
  const [recent, setRecent] = useState([])
  const [dueSoon, setDueSoon] = useState([])
  const [kasBreakdown, setKasBreakdown] = useState({ accounts: [], total: 0 })
  const [hutangPiutang, setHutangPiutang] = useState({ hutang: 0, piutang: 0 })
  const [topProducts, setTopProducts] = useState([])
  const [margin, setMargin] = useState({ revenue: 0, cogs: 0, pct: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.full_name || session.user.email || ''))
  }, [session?.user?.id])

  useEffect(() => {
    if (companyId) loadAll(companyId)
  }, [companyId, activeBusinessType])

  useEffect(() => {
    if (companyId) loadChart(companyId, chartRange)
  }, [companyId, chartRange])

  async function trialBalance(start, end) {
    const { data, error } = await supabase.rpc('get_trial_balance', { p_company_id: companyId, p_start: start, p_end: end })
    if (error) { console.error(error); return [] }
    return data || []
  }

  async function loadChart(cid, range) {
    setChartLoading(true)
    let monthCount
    if (range === '3m') monthCount = 3
    else if (range === '6m') monthCount = 6
    else if (range === '1y') monthCount = 12
    else {
      // "Semua": hitung dari transaksi paling lama, dibatasi maksimal 60 bulan (5 tahun)
      // biar gak query kebanyakan kalau riwayat perusahaan sudah sangat panjang.
      const { data } = await supabase
        .from('transactions')
        .select('date')
        .eq('company_id', cid)
        .order('date', { ascending: true })
        .limit(1)
      const earliest = data && data[0] ? data[0].date : null
      monthCount = earliest ? Math.min(monthsBetween(earliest) + 1, 60) : 6
    }
    const months = Array.from({ length: monthCount }, (_, i) => monthCount - 1 - i)
    const tbMonths = await Promise.all(months.map((m) => {
      const b = monthBounds(m)
      return trialBalance(b.start, b.end).then((rows) => ({ m, rows }))
    }))
    setChartData(tbMonths.map(({ m, rows }) => {
      const d = new Date(); d.setMonth(d.getMonth() - m)
      const pend = sumCategory(rows, 'pendapatan')
      const beban = sumCategory(rows, 'beban_pokok') + sumCategory(rows, 'beban_operasional')
      return { name: `${MONTH_LABEL[d.getMonth()]} ${d.getFullYear()}`, Pendapatan: pend, Pengeluaran: beban, 'Laba Bersih': pend - beban }
    }))
    setChartLoading(false)
  }

  async function loadAll(cid) {
    setLoading(true)
    const thisMonth = monthBounds(0)
    const lastMonth = monthBounds(1)
    const today = new Date().toISOString().slice(0, 10)

    const [tbThis, tbLast, tbCumNow, tbCumLast] = await Promise.all([
      trialBalance(thisMonth.start, thisMonth.end),
      trialBalance(lastMonth.start, lastMonth.end),
      trialBalance('1900-01-01', today),
      trialBalance('1900-01-01', lastMonth.end),
    ])

    const pendapatanNow = sumCategory(tbThis, 'pendapatan')
    const pendapatanLast = sumCategory(tbLast, 'pendapatan')
    const pengeluaranNow = sumCategory(tbThis, 'beban_pokok') + sumCategory(tbThis, 'beban_operasional')
    const pengeluaranLast = sumCategory(tbLast, 'beban_pokok') + sumCategory(tbLast, 'beban_operasional')
    const labaNow = pendapatanNow - pengeluaranNow
    const labaLast = pendapatanLast - pengeluaranLast
    const piutangNow = sumCategory(tbCumNow, 'piutang')
    const piutangLast = sumCategory(tbCumLast, 'piutang')
    const hutangNow = sumCategory(tbCumNow, 'hutang')

    setKpi({
      pendapatan: { value: pendapatanNow, trend: trendPct(pendapatanNow, pendapatanLast) },
      pengeluaran: { value: pengeluaranNow, trend: trendPct(pengeluaranNow, pengeluaranLast) },
      laba: { value: labaNow, trend: trendPct(labaNow, labaLast) },
      piutang: { value: piutangNow, trend: trendPct(piutangNow, piutangLast) },
    })
    setHutangPiutang({ hutang: hutangNow, piutang: piutangNow })

    // Widget khusus Dagang: margin kotor bulan ini & produk terlaris
    if (activeBusinessType === 'dagang') {
      const hppNow = sumCategory(tbThis, 'beban_pokok')
      setMargin({
        revenue: pendapatanNow, cogs: hppNow,
        pct: pendapatanNow > 0 ? ((pendapatanNow - hppNow) / pendapatanNow) * 100 : 0,
      })
      const thisMonthRange = monthBounds(0)
      const { data: topProds } = await supabase.rpc('get_top_selling_products', {
        p_company_id: cid, p_start: thisMonthRange.start, p_end: thisMonthRange.end, p_limit: 5,
      })
      setTopProducts(topProds || [])
    }

    // Kas & Bank breakdown
    const kasAccounts = (tbCumNow || []).filter((r) => r.category === 'kas_bank').map((r) => ({ name: r.account_name, value: netAmount(r) })).filter((a) => a.value !== 0)
    const totalKas = kasAccounts.reduce((s, a) => s + a.value, 0)
    setKasBreakdown({ accounts: kasAccounts.sort((a, b) => b.value - a.value), total: totalKas })

    // Transaksi terbaru
    const { data: txns } = await supabase
      .from('transactions')
      .select('id, date, type, note, journal_entries ( debit )')
      .eq('company_id', cid)
      .order('date', { ascending: false })
      .limit(5)
    setRecent((txns || []).map((t) => ({
      ...t, nominal: (t.journal_entries || []).reduce((s, l) => s + Number(l.debit), 0),
    })))

    // Tagihan jatuh tempo (piutang belum lunas)
    const { data: rp } = await supabase
      .from('v_receivables_payables')
      .select('*')
      .eq('company_id', cid)
      .eq('type', 'piutang')
      .neq('status', 'Lunas')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(5)
    setDueSoon(rp || [])

    setLoading(false)
  }

  if (loading || !kpi) {
    return (
      <div className="page-loading-center">
        <div className="page-loading-spinner" />
        <p>{t('dashboard.loadingDashboard')}</p>
      </div>
    )
  }

  const hariIni = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const kasColors = ['#7C5CFB', '#10B981', '#8B5CF6', '#F59E0B', '#F43F5E', '#14B8A6']

  return (
    <div className="p-6">
      <div className="dash-grid-top">
        <div className="welcome-card">
          <div>
            <div className="welcome-label">{t('dashboard.welcome')}</div>
            <div className="welcome-name">{displayName || '👋'} 👋</div>
            <p className="hint" style={{ marginTop: 10 }}>
              {t('dashboard.summary')}
            </p>
            <div className="welcome-date">📅 {hariIni}</div>
          </div>
        </div>

        <KpiCard label={t('dashboard.revenueMonth')} value={kpi.pendapatan.value} trend={kpi.pendapatan.trend} icon={TrendingUp} accent="#10B981" positiveIsGood vsLabel={t('dashboard.vsLastMonth')} />
        <KpiCard label={t('dashboard.expenseMonth')} value={kpi.pengeluaran.value} trend={kpi.pengeluaran.trend} icon={TrendingDown} accent="#F43F5E" positiveIsGood={false} vsLabel={t('dashboard.vsLastMonth')} />
        <KpiCard label={t('dashboard.netProfitMonth')} value={kpi.laba.value} trend={kpi.laba.trend} icon={Wallet} accent="#14B8A6" positiveIsGood vsLabel={t('dashboard.vsLastMonth')} />
        {isDagang ? (
          <KpiCard label={t('dashboard.grossMargin')} value={margin.pct} isPercent trend={0} icon={Percent} accent="#F59E0B" positiveIsGood vsLabel="" hideTrend />
        ) : (
          <KpiCard label={t('dashboard.receivables')} value={kpi.piutang.value} trend={kpi.piutang.trend} icon={HandCoins} accent="#8B5CF6" positiveIsGood={false} vsLabel={t('dashboard.vsLastMonth')} />
        )}
      </div>

      <div className="dash-grid-mid">
        <div className="section chart-section">
          <div className="section-head">
            <h3>{t('dashboard.chartTitle')}</h3>
            <div className="chart-range-switch">
              {['3m', '6m', '1y', 'all'].map((r) => (
                <button
                  key={r}
                  className={chartRange === r ? 'active' : ''}
                  onClick={() => setChartRange(r)}
                  type="button"
                >
                  {t(`dashboard.range${r === '3m' ? '3m' : r === '6m' ? '6m' : r === '1y' ? 'Year' : 'All'}`)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Bar dataKey="Pendapatan" fill="#7C5CFB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pengeluaran" fill="#C7BBFA" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Laba Bersih" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>        <div className="section">
          <div className="section-head">
            <h3>{t('dashboard.recentTransactions')}</h3>
            <Link to="/laporan/transaksi" className="link-small">{t('dashboard.viewAll')}</Link>
          </div>
          <table className="tbl compact">
            <thead><tr><th>{t('dashboard.colDate')}</th><th>{t('dashboard.colType')}</th><th>{t('dashboard.colNote')}</th><th className="num">{t('dashboard.colAmount')}</th></tr></thead>
            <tbody>
              {recent.map((t2) => (
                <tr key={t2.id}>
                  <td>{new Date(t2.date).toLocaleDateString(i18n.language)}</td>
                  <td><span className="type-pill" style={{ color: TYPE_COLOR[t2.type] || '#616a7d' }}>{TYPE_LABEL[t2.type] || t2.type}</span></td>
                  <td>{t2.note}</td>
                  <td className="num">{fmt(t2.nominal)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={4} className="empty">{t('dashboard.noTransactions')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-grid-bottom">
        <div className="section">
          <div className="section-head">
            <h3><Clock3 size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('dashboard.dueTitle')}</h3>
            <Link to="/laporan/hutang-piutang" className="link-small">{t('dashboard.viewAll')}</Link>
          </div>
          <table className="tbl compact">
            <thead><tr><th>{t('dashboard.colDueDate')}</th><th>{t('dashboard.colCustomer')}</th><th className="num">{t('dashboard.colAmount')}</th><th>{t('dashboard.colDaysLeft')}</th></tr></thead>
            <tbody>
              {dueSoon.map((r) => {
                const d = daysUntil(r.due_date)
                return (
                  <tr key={r.id}>
                    <td>{r.due_date}</td>
                    <td>{r.contact_name}</td>
                    <td className="num">{fmt(r.sisa)}</td>
                    <td className={d < 0 ? 'overdue-text' : ''}>{d < 0 ? t('dashboard.overdueDays', { days: -d }) : t('dashboard.daysLeft', { days: d })}</td>
                  </tr>
                )
              })}
              {!dueSoon.length && <tr><td colSpan={4} className="empty">{t('dashboard.noDue')}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="section">
          <h3>{t('dashboard.cashSummary')}</h3>
          <div className="kas-total-label">{t('dashboard.totalCash')}</div>
          <div className="kas-total-value">{fmt(kasBreakdown.total)}</div>
          <div className="kas-bar">
            {kasBreakdown.accounts.map((a, i) => (
              <div key={a.name} style={{ width: `${(a.value / (kasBreakdown.total || 1)) * 100}%`, background: kasColors[i % kasColors.length] }} />
            ))}
          </div>
          <ul className="kas-list">
            {kasBreakdown.accounts.map((a, i) => (
              <li key={a.name}>
                <span className="dot" style={{ background: kasColors[i % kasColors.length] }} /> {a.name}
                <span className="kas-list-value">{fmt(a.value)}</span>
              </li>
            ))}
            {!kasBreakdown.accounts.length && <li className="hint">{t('dashboard.noCashBalance')}</li>}
          </ul>
        </div>
      </div>

      <div className="dash-grid-bottom">
        <div className="section">
          <h3>{t('dashboard.hutangPiutangTitle')}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              layout="vertical"
              data={[
                { name: t('dashboard.receivables'), value: hutangPiutang.piutang, fill: '#8B5CF6' },
                { name: t('hutangPiutang.typeHutang'), value: hutangPiutang.hutang, fill: '#F59E0B' },
              ]}
              margin={{ left: 10 }}
            >
              <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                {[0, 1].map((i) => <Cell key={i} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {isDagang && (
          <div className="section">
            <div className="section-head">
              <h3><Package size={16} style={{ verticalAlign: -2, marginRight: 6 }} />{t('dashboard.topProductsTitle')}</h3>
              <Link to="/laporan/kartu-persediaan" className="link-small">{t('dashboard.viewAll')}</Link>
            </div>
            <table className="tbl compact">
              <thead><tr><th>{t('produk.colName')}</th><th className="num">{t('dashboard.topProductsQty')}</th></tr></thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.name} <span className="hint">({p.code})</span></td>
                    <td className="num">{Number(p.total_qty).toLocaleString(i18n.language)} {p.unit}</td>
                  </tr>
                ))}
                {!topProducts.length && <tr><td colSpan={2} className="empty">{t('dashboard.noTopProducts')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, trend, icon: Icon, accent, positiveIsGood, vsLabel, isPercent, hideTrend }) {
  const isUp = trend >= 0
  const isGood = positiveIsGood ? isUp : !isUp
  return (
    <div className="kpi-card2">
      <div className="kpi-card2-icon" style={{ background: accent + '1a', color: accent }}><Icon size={18} /></div>
      <div className="kpi-card2-label">{label}</div>
      <div className="kpi-card2-value">{isPercent ? `${value.toFixed(1)}%` : fmt(value)}</div>
      {!hideTrend && (
        <div className={`kpi-card2-trend ${isGood ? 'good' : 'bad'}`}>
          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend).toFixed(1)}% {vsLabel}
        </div>
      )}
    </div>
  )
}
