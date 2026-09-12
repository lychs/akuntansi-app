import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transaksi from './pages/Transaksi.jsx'
import ImportTransaksi from './pages/ImportTransaksi.jsx'
import Akun from './pages/master-data/Akun.jsx'
import ImportAkun from './pages/master-data/ImportAkun.jsx'
import Aset from './pages/master-data/Aset.jsx'
import ImportAset from './pages/master-data/ImportAset.jsx'
import Kontak from './pages/master-data/Kontak.jsx'
import ImportKontak from './pages/master-data/ImportKontak.jsx'
import SaldoAwalHutangPiutang from './pages/master-data/SaldoAwalHutangPiutang.jsx'
import TutupBuku from './pages/master-data/TutupBuku.jsx'
import ProfilPerusahaan from './pages/ProfilPerusahaan.jsx'
import KelolaAkses from './pages/KelolaAkses.jsx'
import Billing from './pages/Billing.jsx'
import HapusData from './pages/HapusData.jsx'
import LaporanTransaksi from './pages/laporan/Transaksi.jsx'
import Jurnal from './pages/laporan/Jurnal.jsx'
import BukuBesar from './pages/laporan/BukuBesar.jsx'
import NeracaSaldo from './pages/laporan/NeracaSaldo.jsx'
import LabaRugi from './pages/laporan/LabaRugi.jsx'
import PerubahanModal from './pages/laporan/PerubahanModal.jsx'
import ArusKas from './pages/laporan/ArusKas.jsx'
import Neraca from './pages/laporan/Neraca.jsx'
import HutangPiutang from './pages/laporan/HutangPiutang.jsx'
import BebanOperasional from './pages/laporan/BebanOperasional.jsx'
import Produk from './pages/dagang/Produk.jsx'
import ImportProduk from './pages/dagang/ImportProduk.jsx'
import SaldoAwalPersediaan from './pages/dagang/SaldoAwalPersediaan.jsx'
import CostCenter from './pages/master-data/CostCenter.jsx'
import Department from './pages/master-data/Department.jsx'
import Project from './pages/master-data/Project.jsx'
import Warehouse from './pages/master-data/Warehouse.jsx'
import TransferAntarCabang from './pages/dagang/TransferAntarCabang.jsx'
import ReturPembelian from './pages/dagang/ReturPembelian.jsx'
import ReturPenjualan from './pages/dagang/ReturPenjualan.jsx'
import RekapPembelianPenjualan from './pages/laporan/RekapPembelianPenjualan.jsx'
import LaporanCostCenter from './pages/laporan/LaporanCostCenter.jsx'
import LaporanDepartemen from './pages/laporan/LaporanDepartemen.jsx'
import LaporanProyek from './pages/laporan/LaporanProyek.jsx'
import LaporanGudang from './pages/laporan/LaporanGudang.jsx'
import JurnalPembalik from './pages/laporan/JurnalPembalik.jsx'
import PembelianBarang from './pages/dagang/PembelianBarang.jsx'
import PenjualanBarang from './pages/dagang/PenjualanBarang.jsx'
import StockOpname from './pages/dagang/StockOpname.jsx'
import KartuPersediaan from './pages/laporan/KartuPersediaan.jsx'
import TambahPerusahaan from './pages/TambahPerusahaan.jsx'
import { useTranslation } from 'react-i18next'
import './i18n/index.js'
import './styles.css'

function RequireAuth({ children }) {
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="page-loading-center">
        <div className="page-loading-spinner" />
        <p>{t('common.loading')}</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { passwordRecovery } = useAuth()
  if (passwordRecovery) return <ResetPassword />
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/transaksi" element={<Transaksi />} />
        <Route path="/transaksi/import" element={<ImportTransaksi />} />
        <Route path="/master/akun" element={<Akun />} />
        <Route path="/master/akun/import" element={<ImportAkun />} />
        <Route path="/master/aset" element={<Aset />} />
        <Route path="/master/aset/import" element={<ImportAset />} />
        <Route path="/master/kontak" element={<Kontak />} />
        <Route path="/master/kontak/import" element={<ImportKontak />} />
        <Route path="/master/saldo-awal-hp" element={<SaldoAwalHutangPiutang />} />
        <Route path="/master/tutup-buku" element={<TutupBuku />} />
        <Route path="/master/cost-center" element={<CostCenter />} />
        <Route path="/master/department" element={<Department />} />
        <Route path="/master/project" element={<Project />} />
        <Route path="/master/warehouse" element={<Warehouse />} />
        <Route path="/dagang/transfer-cabang" element={<TransferAntarCabang />} />
        <Route path="/dagang/retur-pembelian" element={<ReturPembelian />} />
        <Route path="/dagang/retur-penjualan" element={<ReturPenjualan />} />
        <Route path="/laporan/rekap-pembelian-penjualan" element={<RekapPembelianPenjualan />} />
        <Route path="/laporan/cost-center" element={<LaporanCostCenter />} />
        <Route path="/laporan/departemen" element={<LaporanDepartemen />} />
        <Route path="/laporan/proyek" element={<LaporanProyek />} />
        <Route path="/laporan/gudang" element={<LaporanGudang />} />
        <Route path="/laporan/jurnal-pembalik" element={<JurnalPembalik />} />
        <Route path="/dagang/produk" element={<Produk />} />
        <Route path="/dagang/produk/import" element={<ImportProduk />} />
        <Route path="/dagang/saldo-awal-persediaan" element={<SaldoAwalPersediaan />} />
        <Route path="/dagang/pembelian" element={<PembelianBarang />} />
        <Route path="/dagang/penjualan" element={<PenjualanBarang />} />
        <Route path="/dagang/stock-opname" element={<StockOpname />} />
        <Route path="/laporan/kartu-persediaan" element={<KartuPersediaan />} />
        <Route path="/perusahaan/profil" element={<ProfilPerusahaan />} />
        <Route path="/perusahaan/akses" element={<KelolaAkses />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/hapus-data" element={<HapusData />} />
        <Route path="/laporan/transaksi" element={<LaporanTransaksi />} />
        <Route path="/laporan/jurnal" element={<Jurnal />} />
        <Route path="/laporan/buku-besar" element={<BukuBesar />} />
        <Route path="/laporan/neraca-saldo" element={<NeracaSaldo />} />
        <Route path="/laporan/laba-rugi" element={<LabaRugi />} />
        <Route path="/laporan/perubahan-modal" element={<PerubahanModal />} />
        <Route path="/laporan/arus-kas" element={<ArusKas />} />
        <Route path="/laporan/neraca" element={<Neraca />} />
        <Route path="/laporan/hutang-piutang" element={<HutangPiutang />} />
        <Route path="/laporan/beban-operasional" element={<BebanOperasional />} />
        <Route path="/perusahaan/tambah" element={<TambahPerusahaan />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

function Root() {
  const [showSplash, setShowSplash] = useState(true)
  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <App />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
