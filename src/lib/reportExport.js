import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// Utility export laporan ke PDF (bilingual ID/EN, gaya letterhead kayak contoh laporan
// resmi), Excel (.xlsx), dan CSV. Dipakai di semua 10 halaman Laporan.
//
// config = {
//   companyName: string,
//   titleId: string, titleEn: string,           // judul laporan dwibahasa
//   periodTextId: string, periodTextEn: string,  // teks periode dwibahasa (opsional)
//   columns: [{ key, headerId, headerEn, align: 'left'|'right' }],
//   rows: [{ ...values, _rowType: 'normal'|'subtotal'|'total' }],
//   fileBaseName: string,                        // dipakai buat nama file
// }

function formatCell(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') return val.toLocaleString('id-ID')
  return String(val)
}

export function exportReportPdf(config) {
  const { companyName, titleId, titleEn, periodTextId, periodTextEn, columns, rows, fileBaseName } = config
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt' })
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 40
  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(companyName || '', pageWidth / 2, y, { align: 'center' })
  y += 20
  doc.setFontSize(11)
  doc.text(titleId, pageWidth / 2, y, { align: 'center' })
  y += 14
  doc.setFont(undefined, 'italic')
  doc.setFontSize(9.5)
  doc.text(titleEn, pageWidth / 2, y, { align: 'center' })
  y += 16

  if (periodTextId) {
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(periodTextId, pageWidth / 2, y, { align: 'center' })
    y += 12
    if (periodTextEn) {
      doc.setFont(undefined, 'italic')
      doc.text(periodTextEn, pageWidth / 2, y, { align: 'center' })
      y += 12
    }
  }
  y += 8

  const head = [columns.map((c) => `${c.headerId}\n${c.headerEn}`)]
  const body = rows.map((r) =>
    columns.map((c) => formatCell(r[c.key]))
  )

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [124, 92, 251], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, { halign: c.align === 'right' ? 'right' : 'left' }])
    ),
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const rowType = rows[data.row.index]?._rowType
      if (rowType === 'total') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [237, 233, 254]
      } else if (rowType === 'subtotal') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [248, 247, 252]
      }
    },
  })

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : y
  doc.setFontSize(7.5)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(130)
  doc.text(
    `Dicetak / Generated: ${new Date().toLocaleString('id-ID')}`,
    40,
    Math.min(finalY + 20, doc.internal.pageSize.getHeight() - 20)
  )

  doc.save(`${fileBaseName}.pdf`)
}

export function exportReportExcel(config) {
  const { titleId, columns, rows, fileBaseName } = config
  const header = columns.map((c) => `${c.headerId} / ${c.headerEn}`)
  const data = rows.map((r) => columns.map((c) => r[c.key] ?? ''))
  const ws = XLSX.utils.aoa_to_sheet([[titleId], [], header, ...data])
  ws['!cols'] = columns.map(() => ({ wch: 22 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan')
  XLSX.writeFile(wb, `${fileBaseName}.xlsx`)
}

export function exportReportCsv(config) {
  const { columns, rows, fileBaseName } = config
  const escapeCsv = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = columns.map((c) => escapeCsv(`${c.headerId} / ${c.headerEn}`)).join(',')
  const lines = rows.map((r) => columns.map((c) => escapeCsv(r[c.key])).join(','))
  const csv = [header, ...lines].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBaseName}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
