import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ArrowRight, ArrowUpRight, ShieldCheck, Smartphone } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis } from 'recharts'
import LandingNav from '../components/LandingNav.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import LandingPricingGrid from '../components/LandingPricingGrid.jsx'
import { Reveal, useReveal, useCountUp } from '../lib/useReveal.jsx'
import { useLandingDarkMode } from '../lib/useLandingDarkMode.js'
import '../landing.css'

const CHART_DATA = [
  { m: 'Apr', rev: 22, exp: 14 }, { m: 'Mei', rev: 26, exp: 15 }, { m: 'Jun', rev: 24, exp: 17 },
  { m: 'Jul', rev: 31, exp: 16 }, { m: 'Agu', rev: 29, exp: 18 }, { m: 'Sep', rev: 42, exp: 18 },
]
const PROFIT_DATA = CHART_DATA.map((d) => ({ m: d.m, profit: d.rev - d.exp }))

function ProductMockup({ animated = true }) {
  const { t } = useTranslation()
  const [ref, visible] = useReveal()
  const rev = useCountUp(128450000, animated ? visible : true, 1400)
  const profit = useCountUp(54130000, animated ? visible : true, 1400)

  return (
    <div ref={ref}>
      <div className={`lp-product-frame ${animated ? `lp-reveal-scale ${visible ? 'is-visible' : ''}` : ''}`}>
        <div className="lp-product-topbar">
          <div className="lp-product-dots"><span /><span /><span /></div>
          <div className="lp-product-tabs">
            <span className="lp-product-tab active">Dashboard</span>
            <span className="lp-product-tab">Transaksi</span>
            <span className="lp-product-tab">Laporan</span>
          </div>
        </div>
        <div className="lp-product-body">
          <div className="lp-kpi-row">
            <div className="lp-kpi-card">
              <div className="lp-kpi-label">Pendapatan</div>
              <div className="lp-kpi-value up lp-tabular">Rp {rev.toLocaleString('id-ID')}</div>
            </div>
            <div className="lp-kpi-card">
              <div className="lp-kpi-label">Pengeluaran</div>
              <div className="lp-kpi-value lp-tabular">Rp 74.320.000</div>
            </div>
            <div className="lp-kpi-card">
              <div className="lp-kpi-label">Laba Bersih</div>
              <div className="lp-kpi-value up lp-tabular">Rp {profit.toLocaleString('id-ID')}</div>
            </div>
            <div className="lp-kpi-card">
              <div className="lp-kpi-label">Saldo Kas</div>
              <div className="lp-kpi-value lp-tabular">Rp 61.800.000</div>
            </div>
          </div>
          <div className="lp-product-main-grid">
            <div className="lp-chart-card">
              <div className="lp-chart-card-head">
                <span className="lp-chart-card-title">Pendapatan vs Pengeluaran</span>
                <span className="lp-chart-card-pill">6 Bulan</span>
              </div>
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={CHART_DATA}>
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#9a9aa5' }} axisLine={false} tickLine={false} />
                    <Line type="monotone" dataKey="rev" stroke="#6D5AE6" strokeWidth={2.4} dot={false} isAnimationActive={visible} animationDuration={1200} />
                    <Line type="monotone" dataKey="exp" stroke="#e6e1d6" strokeWidth={2} dot={false} isAnimationActive={visible} animationDuration={1200} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lp-tx-card">
              <div className="lp-tx-card-title">{t('landing.dash.recentTitle')}</div>
              <div className="lp-tx-row"><div><div className="lp-tx-name">{t('landing.dash.recent1')}</div><div className="lp-tx-sub">{t('landing.dash.recent1Sub')}</div></div><span className="lp-tx-amt in lp-tabular">+5.000.000</span></div>
              <div className="lp-tx-row"><div><div className="lp-tx-name">{t('landing.dash.recent2')}</div><div className="lp-tx-sub">{t('landing.dash.recent2Sub')}</div></div><span className="lp-tx-amt out lp-tabular">-3.500.000</span></div>
              <div className="lp-tx-row"><div><div className="lp-tx-name">{t('landing.dash.recent3')}</div><div className="lp-tx-sub">{t('landing.dash.recent3Sub')}</div></div><span className="lp-tx-amt in lp-tabular">+8.200.000</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { t } = useTranslation()
  const [isDark, toggleDark] = useLandingDarkMode()
  const [showcaseTab, setShowcaseTab] = useState('tx')
  const [usecaseTab, setUsecaseTab] = useState('retail')

  const SHOWCASE_TABS = [
    { key: 'tx', label: t('landing.showcaseV2.navTransaksi'), desc: t('landing.showcaseV2.descTransaksi') },
    { key: 'kas', label: t('landing.showcaseV2.navKas'), desc: t('landing.showcaseV2.descKas') },
    { key: 'lap', label: t('landing.showcaseV2.navLaporan'), desc: t('landing.showcaseV2.descLaporan') },
    { key: 'piutang', label: t('landing.showcaseV2.navPiutang'), desc: t('landing.showcaseV2.descPiutang') },
    { key: 'stok', label: t('landing.showcaseV2.navPersediaan'), desc: t('landing.showcaseV2.descPersediaan') },
    { key: 'cabang', label: t('landing.showcaseV2.navCabang'), desc: t('landing.showcaseV2.descCabang') },
  ]
  const activeShowcase = SHOWCASE_TABS.find((s) => s.key === showcaseTab)

  const USECASE_TABS = ['retail', 'fnb', 'jasa', 'toko', 'dist', 'umkm']
  const usecaseTagsFor = {
    retail: ['Stok', 'Penjualan', 'Multi Cabang'],
    fnb: ['Pendapatan Harian', 'Beban Operasional', 'Kas'],
    jasa: ['Piutang', 'Pendapatan Jasa', 'Laporan'],
    toko: ['Penjualan Online', 'Stok', 'Rekonsiliasi'],
    dist: ['Persediaan Besar', 'Piutang', 'Multi Cabang'],
    umkm: ['Transaksi Sederhana', 'Laporan Dasar', 'Mudah Dipakai'],
  }

  const [branchSel, setBranchSel] = useState('all')

  return (
    <div className={`lp ${isDark ? 'dark' : ''}`}>
      <LandingNav isDark={isDark} onToggleDark={toggleDark} />

      {/* ============ HERO — product-led ============ */}
      <section className="lp-hero">
        <div className="lp-hero-grid-bg" />
        <div className="lp-hero-glow" />
        <div className="lp-wrap">
          <Reveal as="h1" className="lp-hero-title lp-head" style={{ marginTop: 0 }}>{t('landing.heroV3.title')}</Reveal>
          <Reveal as="p" className="lp-hero-sub">{t('landing.heroV3.sub')}</Reveal>
          <Reveal className="lp-hero-ctas">
            <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">{t('landing.hero.ctaPrimary')} <ArrowRight size={15} /></Link>
            <a href="#showcase" className="lp-btn lp-btn-ghost lp-btn-lg">{t('landing.heroV3.ctaSecondary')}</a>
          </Reveal>

          <ProductMockup />
        </div>
      </section>

      {/* ============ PRODUCT PROOF ============ */}
      <section className="lp-section">
        <div className="lp-wrap">
          <Reveal className="lp-proof-statement">
            <h2 className="lp-h2 lp-head lp-center">{t('landing.proof.statement')}</h2>
          </Reveal>
        </div>
      </section>

      {/* ============ PROBLEM -> TRANSFORM ============ */}
      <section className="lp-section lp-section-alt">
        <div className="lp-wrap-narrow lp-center">
          <Reveal>
            <span className="lp-eyebrow-label">{t('landing.problem.kicker')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.transform.title')}</h2>
          </Reveal>

          <Reveal className="lp-flow-chain">
            <span className="lp-flow-chip">{t('landing.transform.c1')}</span>
            <ArrowRight size={14} className="lp-flow-arrow" />
            <span className="lp-flow-chip">{t('landing.transform.c2')}</span>
            <ArrowRight size={14} className="lp-flow-arrow" />
            <span className="lp-flow-chip">{t('landing.transform.c3')}</span>
            <ArrowRight size={14} className="lp-flow-arrow" />
            <span className="lp-flow-chip">{t('landing.transform.c4')}</span>
            <ArrowRight size={14} className="lp-flow-arrow" />
            <span className="lp-flow-chip">{t('landing.transform.c5')}</span>
          </Reveal>
          <Reveal>
            <div className="lp-flow-result">
              <ArrowUpRight size={16} /> {t('landing.transform.resultLabel')}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FEATURE SHOWCASE (sticky nav + preview) ============ */}
      <section className="lp-section" id="showcase">
        <div className="lp-wrap">
          <Reveal className="lp-center" style={{ maxWidth: 620, margin: '0 auto 56px' }}>
            <span className="lp-eyebrow-label">Product Tour</span>
            <h2 className="lp-h2 lp-head">{t('landing.showcaseV2.title')}</h2>
          </Reveal>

          <div className="lp-showcase-layout">
            <div className="lp-showcase-nav">
              {SHOWCASE_TABS.map((s) => (
                <button key={s.key} type="button" className={`lp-showcase-nav-item ${showcaseTab === s.key ? 'active' : ''}`} onClick={() => setShowcaseTab(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="lp-showcase-preview">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, marginBottom: 20, maxWidth: 480 }}>{activeShowcase.desc}</p>

              {showcaseTab === 'tx' && (
                <div className="lp-tx-card" style={{ maxWidth: 520 }}>
                  <div className="lp-tx-card-title">{t('landing.dash.recentTitle')}</div>
                  <div className="lp-tx-row"><div><div className="lp-tx-name">{t('landing.dash.recent1')}</div><div className="lp-tx-sub">{t('landing.dash.recent1Sub')}</div></div><span className="lp-tx-amt in lp-tabular">+5.000.000</span></div>
                  <div className="lp-tx-row"><div><div className="lp-tx-name">{t('landing.dash.recent2')}</div><div className="lp-tx-sub">{t('landing.dash.recent2Sub')}</div></div><span className="lp-tx-amt out lp-tabular">-3.500.000</span></div>
                  <div className="lp-tx-row"><div><div className="lp-tx-name">{t('landing.dash.recent3')}</div><div className="lp-tx-sub">{t('landing.dash.recent3Sub')}</div></div><span className="lp-tx-amt in lp-tabular">+8.200.000</span></div>
                </div>
              )}
              {showcaseTab === 'kas' && (
                <div className="lp-kpi-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}>
                  <div className="lp-kpi-card"><div className="lp-kpi-label">Bank Mandiri</div><div className="lp-kpi-value lp-tabular">Rp 38.200.000</div></div>
                  <div className="lp-kpi-card"><div className="lp-kpi-label">Kas Kecil</div><div className="lp-kpi-value lp-tabular">Rp 4.500.000</div></div>
                </div>
              )}
              {showcaseTab === 'lap' && (
                <div className="lp-report-sheet" style={{ maxWidth: 420, padding: 22 }}>
                  <div className="lp-report-line"><span>{t('landing.reportSection.pendapatan')}</span><span className="lp-tabular">Rp 100.000.000</span></div>
                  <div className="lp-report-line sub"><span>{t('landing.reportSection.hpp')}</span><span className="lp-tabular">Rp 60.000.000</span></div>
                  <div className="lp-report-line total"><span>{t('landing.reportSection.labaKotor')}</span><span className="lp-tabular">Rp 40.000.000</span></div>
                </div>
              )}
              {showcaseTab === 'piutang' && (
                <div className="lp-tx-card" style={{ maxWidth: 480 }}>
                  <div className="lp-tx-row"><div><div className="lp-tx-name">CV Berkah Event</div><div className="lp-tx-sub">Jatuh tempo 14 hari</div></div><span className="lp-tx-amt lp-tabular">Rp 8.000.000</span></div>
                  <div className="lp-tx-row"><div><div className="lp-tx-name">Hotel Grand Mega</div><div className="lp-tx-sub">Lunas</div></div><span className="lp-tx-amt in lp-tabular">Rp 12.000.000</span></div>
                </div>
              )}
              {showcaseTab === 'stok' && (
                <div className="lp-kpi-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}>
                  <div className="lp-kpi-card"><div className="lp-kpi-label">Lampu Moving Head</div><div className="lp-kpi-value lp-tabular">24 unit</div></div>
                  <div className="lp-kpi-card"><div className="lp-kpi-label">Speaker Aktif</div><div className="lp-kpi-value lp-tabular">12 unit</div></div>
                </div>
              )}
              {showcaseTab === 'cabang' && (
                <div className="lp-kpi-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 560 }}>
                  <div className="lp-kpi-card"><div className="lp-kpi-label">Cabang Jakarta</div><div className="lp-kpi-value up lp-tabular">Rp 45jt</div></div>
                  <div className="lp-kpi-card"><div className="lp-kpi-label">Cabang Bali</div><div className="lp-kpi-value up lp-tabular">Rp 30jt</div></div>
                  <div className="lp-kpi-card"><div className="lp-kpi-label">Cabang Surabaya</div><div className="lp-kpi-value up lp-tabular">Rp 25jt</div></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ PROMO STRIP (4 panel) ============ */}
      <section className="lp-section-tight lp-section-alt">
        <div className="lp-wrap">
          <Reveal stagger className="lp-promo-strip">
            <div className="lp-promo-tile violet">
              <div>
                <h3 className="lp-promo-tile-title">{t('landing.promo.title1')}</h3>
                <p className="lp-promo-tile-sub">{t('landing.promo.sub1')}</p>
              </div>
              <div>
                <div className="lp-promo-tile-photo"><img src="/promo-photo.jpg" alt="" /></div>
                <div className="lp-promo-tile-badge">
                  <img src="/logo-icon.png" alt="" />
                  <span>My Worksheet</span>
                </div>
              </div>
            </div>

            <div className="lp-promo-tile dark">
              <h3 className="lp-promo-tile-title">{t('landing.promo.title2')}</h3>
              <div style={{ position: 'relative' }}>
                <div className="lp-promo-tile-mockup">
                  <div className="lp-promo-tile-bars">
                    <span style={{ height: '40%' }} /><span style={{ height: '65%' }} /><span style={{ height: '50%' }} />
                    <span style={{ height: '85%' }} /><span style={{ height: '70%' }} /><span style={{ height: '95%' }} />
                  </div>
                </div>
                <div className="lp-promo-tile-float">
                  <div className="l">{t('landing.promo.statLabel')}</div>
                  <div className="v lp-tabular">{t('landing.promo.statValue')}</div>
                </div>
              </div>
            </div>

            <div className="lp-promo-tile light">
              <h3 className="lp-promo-tile-title">{t('landing.promo.title3')}</h3>
              <div className="lp-promo-tile-icons">
                <div className="lp-promo-tile-icon-row">
                  <div className="lp-promo-tile-icon-box"><Check size={16} /></div>
                  <span className="lp-promo-tile-icon-label">{t('landing.promo.f1')}</span>
                </div>
                <div className="lp-promo-tile-icon-row">
                  <div className="lp-promo-tile-icon-box"><ShieldCheck size={16} /></div>
                  <span className="lp-promo-tile-icon-label">{t('landing.promo.f2')}</span>
                </div>
                <div className="lp-promo-tile-icon-row">
                  <div className="lp-promo-tile-icon-box"><Smartphone size={16} /></div>
                  <span className="lp-promo-tile-icon-label">{t('landing.promo.f3')}</span>
                </div>
              </div>
            </div>

            <div className="lp-promo-tile gradient">
              <h3 className="lp-promo-tile-title">{t('landing.promo.title4')}</h3>
              <div>
                <div className="lp-promo-tile-badge">
                  <img src="/logo-icon.png" alt="" />
                  <span>My Worksheet</span>
                </div>
                <Link to="/login" className="lp-btn lp-btn-light" style={{ marginTop: 12 }}>{t('landing.promo.cta')} <ArrowRight size={14} /></Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FINANCIAL DATA VISUALIZATION ============ */}
      <section className="lp-section lp-section-dark">
        <div className="lp-wrap">
          <Reveal className="lp-center" style={{ maxWidth: 560, margin: '0 auto 56px' }}>
            <h2 className="lp-h2 lp-head">{t('landing.financeViz.title')}</h2>
            <p className="lp-p-lead lp-center">{t('landing.financeViz.desc')}</p>
          </Reveal>
          <Reveal stagger className="lp-product-main-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="lp-chart-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="lp-chart-card-head"><span className="lp-chart-card-title" style={{ color: '#fff' }}>Pendapatan</span></div>
              <div style={{ height: 90 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={CHART_DATA}><Line type="monotone" dataKey="rev" stroke="#9C8FF0" strokeWidth={2.4} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lp-chart-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="lp-chart-card-head"><span className="lp-chart-card-title" style={{ color: '#fff' }}>Pengeluaran</span></div>
              <div style={{ height: 90 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CHART_DATA}><Bar dataKey="exp" fill="rgba(255,255,255,0.25)" radius={[3, 3, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lp-chart-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="lp-chart-card-head"><span className="lp-chart-card-title" style={{ color: '#fff' }}>Laba Bersih</span></div>
              <div style={{ height: 90 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={PROFIT_DATA}><Line type="monotone" dataKey="profit" stroke="#34D399" strokeWidth={2.4} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ MULTI-BRANCH ============ */}
      <section className="lp-section" id="solusi">
        <div className="lp-section-glow" />
        <div className="lp-wrap lp-center">
          <Reveal style={{ maxWidth: 560, margin: '0 auto' }}>
            <span className="lp-eyebrow-label">{t('landing.branch.kicker')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.branch.title')}</h2>
          </Reveal>

          <Reveal className="lp-tree">
            <div className="lp-tree-node root">{t('landing.branch.rootLabel')}</div>
            <div className="lp-tree-line" />
            <div className="lp-tree-branches">
              <div className="lp-tree-branch"><div className="lp-tree-line-up" /><div className="lp-tree-node branch">{t('landing.branch.branch1')}</div></div>
              <div className="lp-tree-branch"><div className="lp-tree-line-up" /><div className="lp-tree-node branch">{t('landing.branch.branch2')}</div></div>
              <div className="lp-tree-branch"><div className="lp-tree-line-up" /><div className="lp-tree-node branch">{t('landing.branch.branch3')}</div></div>
            </div>
            <div className="lp-tree-result">{t('landing.branch.resultLabel')}</div>
          </Reveal>

          <Reveal style={{ maxWidth: 620, margin: '32px auto 0' }}>
            <div className="lp-showcase-nav" style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
              {['all', 'b1', 'b2', 'b3'].map((b) => (
                <button key={b} type="button" className={`lp-usecase-tab ${branchSel === b ? 'active' : ''}`} onClick={() => setBranchSel(b)}>
                  {b === 'all' ? t('landing.branch.allBranches') : t(`landing.branch.branch${b.slice(1)}`)}
                </button>
              ))}
            </div>
            <div className="lp-kpi-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="lp-kpi-card"><div className="lp-kpi-label">{t('landing.reportSection.pendapatan')}</div><div className="lp-kpi-value up lp-tabular">Rp {({ all: 100, b1: 45, b2: 30, b3: 25 })[branchSel]}jt</div></div>
              <div className="lp-kpi-card"><div className="lp-kpi-label">{t('landing.reportSection.bebanOps')}</div><div className="lp-kpi-value lp-tabular">Rp {({ all: 62, b1: 26, b2: 20, b3: 16 })[branchSel]}jt</div></div>
              <div className="lp-kpi-card"><div className="lp-kpi-label">{t('landing.reportSection.labaBersih')}</div><div className="lp-kpi-value up lp-tabular">Rp {({ all: 38, b1: 19, b2: 10, b3: 9 })[branchSel]}jt</div></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ REPORTING ============ */}
      <section className="lp-section lp-section-alt">
        <div className="lp-wrap lp-report-layout">
          <Reveal>
            <span className="lp-eyebrow-label">{t('landing.reportSection.kicker')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.reportV3.title')}</h2>
            <p className="lp-p-lead">{t('landing.reportSection.desc')}</p>
          </Reveal>
          <Reveal className="lp-report-sheet">
            <div className="lp-report-sheet-title">{t('landing.reportSection.reportTitle')}</div>
            <div className="lp-report-line"><span>{t('landing.reportSection.pendapatan')}</span><span className="lp-tabular">Rp 100.000.000</span></div>
            <div className="lp-report-line sub"><span>{t('landing.reportSection.hpp')}</span><span className="lp-tabular">Rp 60.000.000</span></div>
            <div className="lp-report-line total"><span>{t('landing.reportSection.labaKotor')}</span><span className="lp-tabular">Rp 40.000.000</span></div>
            <div className="lp-report-line sub"><span>{t('landing.reportSection.bebanOps')}</span><span className="lp-tabular">Rp 20.000.000</span></div>
            <div className="lp-report-line grand"><span>{t('landing.reportSection.labaBersih')}</span><span className="lp-tabular">Rp 20.000.000</span></div>
          </Reveal>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="lp-section" id="cara-kerja">
        <div className="lp-wrap">
          <Reveal className="lp-center" style={{ maxWidth: 480, margin: '0 auto 56px' }}>
            <span className="lp-eyebrow-label">{t('landing.how.kicker')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.how.title')}</h2>
          </Reveal>
          <Reveal stagger className="lp-steps">
            <div>
              <div className="lp-step-num">01</div>
              <h3 className="lp-step-title">{t('landing.how.s1t')}</h3>
              <p className="lp-step-desc">{t('landing.how.s1d')}</p>
              <div className="lp-step-visual"><div className="lp-badge" style={{ margin: 0 }}>Bisnis Saya</div></div>
            </div>
            <div>
              <div className="lp-step-num">02</div>
              <h3 className="lp-step-title">{t('landing.how.s2t')}</h3>
              <p className="lp-step-desc">{t('landing.how.s2d')}</p>
              <div className="lp-step-visual">
                <div className="lp-tx-row" style={{ width: '80%' }}><span className="lp-tx-name" style={{ fontSize: 11 }}>Pembayaran Klien</span><span className="lp-tx-amt in lp-tabular" style={{ fontSize: 11 }}>+5.000.000</span></div>
              </div>
            </div>
            <div>
              <div className="lp-step-num">03</div>
              <h3 className="lp-step-title">{t('landing.how.s3t')}</h3>
              <p className="lp-step-desc">{t('landing.how.s3d')}</p>
              <div className="lp-step-visual">
                <div style={{ width: '70%', height: 40 }}>
                  <ResponsiveContainer width="100%" height="100%"><LineChart data={CHART_DATA}><Line type="monotone" dataKey="rev" stroke="#6D5AE6" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ USE CASES (selector) ============ */}
      <section className="lp-section lp-section-alt">
        <div className="lp-wrap">
          <Reveal className="lp-center" style={{ maxWidth: 480, margin: '0 auto 40px' }}>
            <span className="lp-eyebrow-label">{t('landing.usecase.kicker')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.usecase.title')}</h2>
          </Reveal>
          <Reveal>
            <div className="lp-usecase-tabs">
              {USECASE_TABS.map((k) => (
                <button key={k} type="button" className={`lp-usecase-tab ${usecaseTab === k ? 'active' : ''}`} onClick={() => setUsecaseTab(k)}>
                  {t(`landing.usecase.${k}T`)}
                </button>
              ))}
            </div>
            <div className="lp-usecase-panel">
              <div className="lp-usecase-panel-title">{t(`landing.usecase.${usecaseTab}T`)}</div>
              <p className="lp-usecase-panel-desc">{t(`landing.usecase.${usecaseTab}D`)}</p>
              <div className="lp-usecase-panel-tags">
                {usecaseTagsFor[usecaseTab].map((tag) => <span key={tag} className="lp-usecase-panel-tag">{tag}</span>)}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ WHY US ============ */}
      <section className="lp-section" id="tentang">
        <div className="lp-wrap lp-center">
          <Reveal style={{ maxWidth: 560, margin: '0 auto 40px' }}>
            <span className="lp-eyebrow-label">{t('landing.whySection.kicker')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.whySection.title')}</h2>
          </Reveal>
          <Reveal className="lp-why-list">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div className="lp-why-row" key={n}>
                <Check size={18} className="lp-why-check" />
                {t(`landing.whySection.w${n}`)}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="lp-section lp-section-alt" id="harga">
        <div className="lp-wrap">
          <Reveal className="lp-center" style={{ maxWidth: 480, margin: '0 auto 48px' }}>
            <span className="lp-eyebrow-label">{t('landing.pricing.sectionTitle')}</span>
            <h2 className="lp-h2 lp-head">{t('landing.pricing.sectionDesc')}</h2>
          </Reveal>
          <Reveal>
            <LandingPricingGrid />
          </Reveal>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link to="/harga" className="lp-btn lp-btn-ghost">{t('landing.pricing.seeFullPricing')}</Link>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="lp-final-cta">
        <div className="lp-final-cta-bg" />
        <div className="lp-final-cta-dashboard-ghost">
          <ProductMockup animated={false} />
        </div>
        <div className="lp-wrap lp-final-cta-content">
          <Reveal>
            <h2 className="lp-h2 lp-head" style={{ fontSize: 'clamp(28px,4vw,44px)' }}>{t('landing.ctaV3.title')}</h2>
            <p className="lp-p-lead lp-center" style={{ margin: '0 auto 32px' }}>{t('landing.ctaV3.desc')}</p>
            <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">{t('landing.cta.button')} <ArrowRight size={15} /></Link>
          </Reveal>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
