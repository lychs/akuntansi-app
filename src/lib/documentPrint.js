import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Peta jenis transaksi -> jenis dokumen yang otomatis cocok dicetak.
// Ini yang bikin "pilih transaksi -> otomatis kebuka dokumen yang pas".
export const DOC_TYPE_BY_TRANSACTION_TYPE = {
  pemasukan: 'cash_receipt',
  pengeluaran: 'cash_payment',
  pemasukan_sebagai_piutang: 'cash_receipt',
  pengeluaran_sebagai_hutang: 'cash_payment',
  penjualan_barang: 'faktur_penjualan',
  pembelian_barang: 'faktur_pembelian',
  piutang: 'faktur_penjualan',
  hutang: 'faktur_pembelian',
  retur_pembelian: 'nota_debet',
  retur_penjualan: 'nota_kredit',
}

const DOC_LABEL = {
  faktur_penjualan: { id: 'FAKTUR PENJUALAN', en: 'SALES INVOICE', prefix: 'INV' },
  faktur_pembelian: { id: 'FAKTUR PEMBELIAN', en: 'PURCHASE INVOICE', prefix: 'PB' },
  nota_debet: { id: 'NOTA DEBET', en: 'DEBIT NOTE', prefix: 'ND' },
  nota_kredit: { id: 'NOTA KREDIT', en: 'CREDIT NOTE', prefix: 'NK' },
  cash_receipt: { id: 'BUKTI PENERIMAAN KAS', en: 'CASH RECEIPT', prefix: 'CR' },
  cash_payment: { id: 'BUKTI PENGELUARAN KAS', en: 'CASH PAYMENT', prefix: 'CP' },
}

function fmtMoney(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}
function docNumber(prefix, transactionId, date) {
  const shortId = transactionId.replace(/-/g, '').slice(0, 6).toUpperCase()
  const d = new Date(date)
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${prefix}-${ym}-${shortId}`
}

// transaction: { id, date, type, note, contact_name, total_amount }
// lineItems: opsional, array [{ name, qty, unit, unitPrice, subtotal }] — dipakai
//   kalau transaksinya dari modul Dagang (ada rincian barang). Kalau kosong,
//   dokumen nampilin 1 baris deskripsi umum dari catatan transaksi.
export function generateTransactionDocument(transaction, companyName, lineItems = []) {
  const docType = DOC_TYPE_BY_TRANSACTION_TYPE[transaction.type]
  if (!docType) return null
  const label = DOC_LABEL[docType]

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 50

  doc.setFontSize(15)
  doc.setFont(undefined, 'bold')
  doc.text(companyName || '', 40, y)
  y += 26

  doc.setFontSize(14)
  doc.text(label.id, pageWidth - 40, 50, { align: 'right' })
  doc.setFontSize(9.5)
  doc.setFont(undefined, 'italic')
  doc.text(label.en, pageWidth - 40, 66, { align: 'right' })

  doc.setDrawColor(180)
  doc.line(40, y, pageWidth - 40, y)
  y += 24

  const no = docNumber(label.prefix, transaction.id, transaction.date)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  doc.text(`No. Dokumen / Doc No.`, 40, y)
  doc.text(`: ${no}`, 160, y)
  y += 16
  doc.text(`Tanggal / Date`, 40, y)
  doc.text(`: ${new Date(transaction.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 160, y)
  y += 16
  if (transaction.contact_name) {
    doc.text(`Kepada Yth / To`, 40, y)
    doc.text(`: ${transaction.contact_name}`, 160, y)
    y += 16
  }
  y += 14

  if (lineItems.length) {
    autoTable(doc, {
      startY: y,
      head: [['Deskripsi / Description', 'Qty', 'Satuan', 'Harga Satuan', 'Subtotal']],
      body: lineItems.map((it) => [it.name, it.qty, it.unit || '-', fmtMoney(it.unitPrice), fmtMoney(it.subtotal)]),
      foot: [['', '', '', 'TOTAL', fmtMoney(transaction.total_amount)]],
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [109, 90, 230] },
      footStyles: { fillColor: [237, 233, 254], textColor: [30, 30, 30], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY + 30
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Deskripsi / Description', 'Nominal / Amount']],
      body: [[transaction.note || '-', fmtMoney(transaction.total_amount)]],
      styles: { fontSize: 9.5, cellPadding: 8 },
      headStyles: { fillColor: [109, 90, 230] },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY + 30
  }

  const colWidth = (pageWidth - 80) / 2
  doc.setFontSize(9.5)
  doc.text('Dibuat oleh / Prepared by,', 40, y)
  doc.text(docType === 'nota_kredit' || docType === 'cash_receipt' ? 'Diterima oleh / Received by,' : 'Disetujui oleh / Approved by,', 40 + colWidth, y)
  y += 55
  doc.line(40, y, 40 + 140, y)
  doc.line(40 + colWidth, y, 40 + colWidth + 140, y)
  y += 14
  doc.setFontSize(8.5)
  doc.text('( _________________ )', 40, y)
  doc.text('( _________________ )', 40 + colWidth, y)

  doc.save(`${no}.pdf`)
}
