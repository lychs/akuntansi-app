import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Receipt, FileBarChart,
  PlusCircle, FileSpreadsheet, BookOpen, Box, Users, ListOrdered,
  BookMarked, ScrollText, Scale, TrendingUp, PieChart, HandCoins, Wallet, UploadCloud, Building2, RefreshCw, Waves, Lock, Users2, Settings, X,
  Package, ShoppingCart, ShoppingBag, ClipboardList, ClipboardCheck, PackagePlus, GitBranch, RotateCcw,
  Briefcase, FolderKanban, Warehouse, ArrowRightLeft, Database, CreditCard, AlertTriangle, Undo2, FileBarChart2,
} from 'lucide-react'
import { useCompany } from '../lib/CompanyContext.jsx'

function useSections(businessType) {
  const sections = [
    {
      key: 'sectionTransaksi', icon: Receipt,
      items: [
        { key: 'addTransaction', to: '/transaksi', icon: PlusCircle },
        { key: 'importExcel', to: '/transaksi/import', icon: FileSpreadsheet },
      ],
    },
  ]

  if (businessType === 'dagang') {
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

  // Cabang & dimensi lain — sengaja section TERSENDIRI, gak dicampur ke Master Data
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
      { key: 'companyProfile', to: '/perusahaan/profil', icon: Building2 },
      { key: 'manageAccess', to: '/perusahaan/akses', icon: Users2 },
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

  const laporanItems = [
    { key: 'reportTransactions', to: '/laporan/transaksi', icon: ListOrdered },
    { key: 'reportJournal', to: '/laporan/jurnal', icon: ScrollText },
    { key: 'reportLedger', to: '/laporan/buku-besar', icon: BookMarked },
    { key: 'reportTrialBalance', to: '/laporan/neraca-saldo', icon: Scale },
    { key: 'reportProfitLoss', to: '/laporan/laba-rugi', icon: TrendingUp },
    { key: 'reportEquityChanges', to: '/laporan/perubahan-modal', icon: RefreshCw },
    { key: 'reportCashFlow', to: '/laporan/arus-kas', icon: Waves },
    { key: 'reportBalanceSheet', to: '/laporan/neraca', icon: PieChart },
    { key: 'reportArAp', to: '/laporan/hutang-piutang', icon: HandCoins },
    { key: 'reportOpex', to: '/laporan/beban-operasional', icon: Wallet },
  ]
  if (businessType === 'dagang') {
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

  // Billing & Hapus Data — sengaja dipisah jadi 2 menu berbeda, gak digabung
  // jadi satu "Pengaturan" lagi.
  sections.push({
    key: 'sectionPengaturan', icon: Settings,
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
  const { activeBusinessType } = useCompany()
  const SECTIONS = useSections(activeBusinessType)

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

      <nav className="sidebar-nav sidebar-nav-flat">
        <Link to="/" className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}>
          <LayoutDashboard size={18} /> {t('sidebar.dashboard')}
        </Link>

        {SECTIONS.map((s) => (
          <div key={s.key} className="sidebar-section">
            <div className="sidebar-section-label">{t(`sidebar.${s.key}`)}</div>
            {s.items.map((it) => {
              const ItemIcon = it.icon
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`sidebar-link sidebar-flat-link ${location.pathname === it.to ? 'active' : ''}`}
                >
                  <ItemIcon size={16} /> {t(`sidebar.${it.key}`)}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
