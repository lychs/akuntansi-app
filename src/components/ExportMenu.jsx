import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, FileSpreadsheet, FileType } from 'lucide-react'
import { exportReportPdf, exportReportExcel, exportReportCsv } from '../lib/reportExport.js'

// Tombol "Export" dengan dropdown PDF / Excel / CSV, dipakai di semua halaman Laporan.
// `config` harus sudah lengkap (companyName, titleId/En, columns, rows, fileBaseName) —
// lihat src/lib/reportExport.js buat detail bentuknya.
export default function ExportMenu({ config }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const disabled = !config.rows || config.rows.length === 0

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn-secondary" onClick={() => setOpen(!open)} disabled={disabled} type="button">
        <Download size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
        {t('exportMenu.export')}
      </button>
      {open && (
        <div className="export-menu-dropdown">
          <button type="button" onClick={() => { exportReportPdf(config); setOpen(false) }}>
            <FileText size={15} /> {t('exportMenu.pdf')}
          </button>
          <button type="button" onClick={() => { exportReportExcel(config); setOpen(false) }}>
            <FileSpreadsheet size={15} /> {t('exportMenu.excel')}
          </button>
          <button type="button" onClick={() => { exportReportCsv(config); setOpen(false) }}>
            <FileType size={15} /> {t('exportMenu.csv')}
          </button>
        </div>
      )}
    </div>
  )
}
