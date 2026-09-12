import DimensionReportPage from './DimensionReportPage.jsx'
export default function LaporanGudang() {
  return <DimensionReportPage rpcName="get_warehouse_summary" titleKey="laporanGudang" masterKey="warehouse" fileSlug="laporan-gudang" />
}
