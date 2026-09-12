import DimensionReportPage from './DimensionReportPage.jsx'
export default function LaporanProyek() {
  return <DimensionReportPage rpcName="get_project_summary" titleKey="laporanProyek" masterKey="project" fileSlug="laporan-proyek" />
}
