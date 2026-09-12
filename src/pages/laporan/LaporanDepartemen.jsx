import DimensionReportPage from './DimensionReportPage.jsx'
export default function LaporanDepartemen() {
  return <DimensionReportPage rpcName="get_department_summary" titleKey="laporanDepartemen" masterKey="department" fileSlug="laporan-departemen" />
}
