import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Receipt, FileBarChart,
  PlusCircle, FileSpreadsheet, BookOpen, Box, Users, ListOrdered,
  BookMarked, ScrollText, Scale, TrendingUp, PieChart, HandCoins, Wallet, UploadCloud, RefreshCw, Waves, Lock, X, ChevronDown,
  Package, ShoppingCart, ShoppingBag, ClipboardList, ClipboardCheck, PackagePlus, GitBranch, RotateCcw,
  Briefcase, FolderKanban, Warehouse, ArrowRightLeft, Database, CreditCard, AlertTriangle, Undo2, FileBarChart2, Repeat,
  Factory, ListTree, Cog, Calculator,
} from 'lucide-react'
import { useCompany } from '../lib/CompanyContext.jsx'

// Urutan section: Cabang & Dimensi -> Master Data -> Transaksi (& Dagang) -> Laporan -> Pengaturan
function useSections(businessType) {
  const sections = []

  sections.push({
    key: 'sectionCabang', icon: GitBranch,
    items: [
      { key: 'costCenter', to: '/master/cost-center', icon: GitBranch },
      { key: 'department', to: '/master/department', icon: Briefcase },
      { key: 'project', to: '/master/project', icon: FolderKanban },
      { key: 'warehouse', to: '/master/warehouse', icon: Warehouse },
    ],
  })

  sections.push({
    key: 'sectionMasterData', icon: Database,
    items: [
      { key: 'accounts', to: '/master/akun', icon: BookOpen },
      { key: 'importAccounts', to: '/master/akun/import', icon: UploadCloud },
      { key: 'assets', to: '/master/aset', icon: Box },
      { key: 'importAssets', to: '/master/aset/import', icon: UploadCloud },
      { key: 'contacts', to: '/master/kontak', icon: Users },
      { key: 'importContacts', to: '/master/kontak/import', icon: UploadCloud },
      { key: 'openingArAp', to: '/master/saldo-awal-hp', icon: HandCoins },
      { key: 'yearEndClosing', to: '/master/tutup-buku', icon: Lock },
    ],
  })

  sections.push({
    key: 'sectionTransaksi', icon: Receipt,
    items: [
      { key: 'addTransaction', to: '/transaksi', icon: PlusCircle },
      { key: 'recurringTransaction', to: '/transaksi/berulang', icon: Repeat },
      { key: 'penyesuaianOtomatis', to: '/transaksi/penyesuaian-otomatis', icon: Calculator },
      { key: 'importExcel', to: '/transaksi/import', icon: FileSpreadsheet },
    ],
  })

  if (businessType === 'dagang' || businessType === 'manufaktur') {
    sections.push({
      key: 'sectionDagang', icon: ShoppingBag,
      items: [
        { key: 'products', to: '/dagang/produk', icon: Package },
        { key: 'importProducts', to: '/dagang/produk/import', icon: UploadCloud },
        { key: 'openingStock', to: '/dagang/saldo-awal-persediaan', icon: PackagePlus },
        { key: 'purchaseGoods', to: '/dagang/pembelian', icon: ShoppingCart },
        { key: 'sellGoods', to: '/dagang/penjualan', icon: ClipboardList },
        { key: 'stockOpname', to: '/dagang/stock-opname', icon: ClipboardCheck },
        { key: 'stockTransfer', to: '/dagang/transfer-cabang', icon: ArrowRightLeft },
        { key: 'returPembelian', to: '/dagang/retur-pembelian', icon: Undo2 },
        { key: 'returPenjualan', to: '/dagang/retur-penjualan', icon: Undo2 },
      ],
    })
  }

  if (businessType === 'manufaktur') {
    sections.push({
      key: 'sectionManufaktur', icon: Factory,
      items: [
        { key: 'manufakturDashboard', to: '/manufaktur/dashboard', icon: Factory },
        { key: 'bom', to: '/manufaktur/bom', icon: ListTree },
        { key: 'productionOrder', to: '/manufaktur/production-order', icon: Cog },
        { key: 'laporanProduksi', to: '/manufaktur/laporan-produksi', icon: FileBarChart2 },
        { key: 'laporanKonsumsiBahan', to: '/manufaktur/laporan-konsumsi-bahan', icon: Package },
        { key: 'laporanBiayaProduksi', to: '/manufaktur/laporan-biaya', icon: Wallet },
        { key: 'laporanTenagaKerja', to: '/manufaktur/laporan-tenaga-kerja', icon: Briefcase },
        { key: 'laporanRejectScrap', to: '/manufaktur/laporan-reject-scrap', icon: AlertTriangle },
        { key: 'laporanProfitabilitas', to: '/manufaktur/laporan-profitabilitas', icon: TrendingUp },
        { key: 'laporanInventoriManufaktur', to: '/manufaktur/laporan-inventori', icon: Database },
      ],
    })
  }

  // 5 laporan keuangan inti digabung jadi 1 submenu "Laporan Keuangan"
  // (type: 'group' -> punya children sendiri, nested 1 tingkat lagi).
  const laporanItems = [
    { key: 'reportTransactions', to: '/laporan/transaksi', icon: ListOrdered },
    { key: 'reportJournal', to: '/laporan/jurnal', icon: ScrollText },
    { key: 'reportLedger', to: '/laporan/buku-besar', icon: BookMarked },
    {
      key: 'financialReportsGroup', type: 'group', icon: FileBarChart2,
      children: [
        { key: 'reportTrialBalance', to: '/laporan/neraca-saldo', icon: Scale },
        { key: 'reportProfitLoss', to: '/laporan/laba-rugi', icon: TrendingUp },
        { key: 'reportEquityChanges', to: '/laporan/perubahan-modal', icon: RefreshCw },
        { key: 'reportCashFlow', to: '/laporan/arus-kas', icon: Waves },
        { key: 'reportBalanceSheet', to: '/laporan/neraca', icon: PieChart },
      ],
    },
    { key: 'reportArAp', to: '/laporan/hutang-piutang', icon: HandCoins },
    { key: 'reportOpex', to: '/laporan/beban-operasional', icon: Wallet },
  ]
  if (businessType === 'dagang' || businessType === 'manufaktur') {
    laporanItems.push({ key: 'reportInventoryCard', to: '/laporan/kartu-persediaan', icon: Package })
    laporanItems.push({ key: 'reportPurchaseSalesRecap', to: '/laporan/rekap-pembelian-penjualan', icon: FileBarChart2 })
  }
  laporanItems.push(
    { key: 'reportCostCenter', to: '/laporan/cost-center', icon: GitBranch },
    { key: 'reportDepartment', to: '/laporan/departemen', icon: Briefcase },
    { key: 'reportProject', to: '/laporan/proyek', icon: FolderKanban },
    { key: 'reportWarehouse', to: '/laporan/gudang', icon: Warehouse },
    { key: 'reportReversingEntry', to: '/laporan/jurnal-pembalik', icon: RotateCcw },
  )
  sections.push({ key: 'sectionLaporan', icon: FileBarChart, items: laporanItems })

  sections.push({
    key: 'sectionPengaturan', icon: CreditCard,
    items: [
      { key: 'billingMenu', to: '/billing', icon: CreditCard },
      { key: 'hapusDataMenu', to: '/hapus-data', icon: AlertTriangle },
    ],
  })

  return sections
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { t } = useTranslation()
  const location = useLocation()
  const { activeBusinessType, activeHiddenMenuKeys } = useCompany()
  const rawSections = useSections(activeBusinessType)
  // Sembunyikan section/menu yang di-nonaktifin admin khusus buat perusahaan
  // ini (paket Corporate custom) — gak ngaruh ke perusahaan lain sama sekali.
  const SECTIONS = rawSections
    .filter((s) => !activeHiddenMenuKeys.includes(s.key))
    .map((s) => ({
      ...s,
      items: s.items
        .filter((it) => !activeHiddenMenuKeys.includes(it.key))
        .map((it) => (it.type === 'group' ? { ...it, children: it.children.filter((c) => !activeHiddenMenuKeys.includes(c.key)) } : it))
        .filter((it) => it.type !== 'group' || it.children.length > 0),
    }))
    .filter((s) => s.items.length > 0)

  const groupContainsPath = (it) => it.type === 'group' && it.children.some((c) => c.to === location.pathname)
  const activeSectionKey = SECTIONS.find((s) => s.items.some((it) => it.to === location.pathname || groupContainsPath(it)))?.key
  const activeGroupKey = SECTIONS.flatMap((s) => s.items).find(groupContainsPath)?.key

  const [openKeys, setOpenKeys] = useState(() => new Set(activeSectionKey ? [activeSectionKey] : []))
  const [openGroupKeys, setOpenGroupKeys] = useState(() => new Set(activeGroupKey ? [activeGroupKey] : []))

  function toggleSection(key) {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function toggleGroup(key) {
    setOpenGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <img src="/logo-icon.png" alt="My Worksheet" className="sidebar-logo" />
        <div>
          <div className="sidebar-brand-title">My Worksheet</div>
          <div className="sidebar-brand-sub">{t('sidebar.tagline')}</div>
        </div>
        <button className="sidebar-mobile-close" onClick={onClose} type="button" aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <Link to="/" className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}>
          <LayoutDashboard size={18} /> {t('sidebar.dashboard')}
        </Link>

        {SECTIONS.map((s) => {
          const SectionIcon = s.icon
          const isOpen = openKeys.has(s.key)
          return (
            <div key={s.key} className="sidebar-group">
              <button type="button" className={`sidebar-link sidebar-group-btn ${isOpen ? 'open' : ''}`} onClick={() => toggleSection(s.key)}>
                <SectionIcon size={17} />
                <span>{t(`sidebar.${s.key}`)}</span>
                <ChevronDown size={14} className="chevron" />
              </button>
              {isOpen && (
                <div className="sidebar-submenu">
                  {s.items.map((it) => {
                    if (it.type === 'group') {
                      const GroupIcon = it.icon
                      const groupOpen = openGroupKeys.has(it.key)
                      return (
                        <div key={it.key} className="sidebar-nested-group">
                          <button type="button" className={`sidebar-sublink sidebar-nested-btn ${groupOpen ? 'open' : ''}`} onClick={() => toggleGroup(it.key)}>
                            <GroupIcon size={15} /> {t(`sidebar.${it.key}`)}
                            <ChevronDown size={12} className="chevron" />
                          </button>
                          {groupOpen && (
                            <div className="sidebar-nested-submenu">
                              {it.children.map((c) => {
                                const ChildIcon = c.icon
                                return (
                                  <Link key={c.to} to={c.to} className={`sidebar-sublink sidebar-nested-link ${location.pathname === c.to ? 'active' : ''}`}>
                                    <ChildIcon size={14} /> {t(`sidebar.${c.key}`)}
                                  </Link>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    }
                    const ItemIcon = it.icon
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        className={`sidebar-sublink ${location.pathname === it.to ? 'active' : ''}`}
                      >
                        <ItemIcon size={15} /> {t(`sidebar.${it.key}`)}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
