import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { useCompany } from '../lib/CompanyContext.jsx'
import ViewerNotice from '../components/ViewerNotice.jsx'
import FileDropzone from '../components/FileDropzone.jsx'

// Parse baris-baris excel (format: Alasan_gagal, Tanggal, Kode Akun, Akun, Debit, Credit, Catatan)
// jadi kelompok transaksi: baris dengan "Tanggal" terisi memulai transaksi baru,
// baris berikutnya yang Tanggal-nya kosong dianggap masih bagian dari transaksi yang sama.
function groupRows(rows) {
  const groups = []
  let current = null
  for (const r of rows) {
    const tanggal = r['Tanggal']
    const kodeAkun = r['Kode Akun']
    const debit = Number(r['Debit']) || 0
    const credit = Number(r['Credit']) || 0
    const catatan = r['Catatan']
    if (!kodeAkun) continue
    if (tanggal) {
      current = { date: tanggal, note: catatan || '', lines: [] }
      groups.push(current)
    }
    if (!current) continue
    current.lines.push({ kodeAkun: String(kodeAkun).trim(), debit, credit })
    if (catatan && !current.note) current.note = catatan
  }
  return groups
}

export default function ImportTransaksi() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [preview, setPreview] = useState([])
  const [fileName, setFileName] = useState('')
  const [log, setLog] = useState([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(file) {
    if (!file) { setFileName(''); setPreview([]); return }
    setFileName(file.name)
    setError(null)
    setLog([])
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const groups = groupRows(json)
    if (groups.length > 5000) {
      setError(t('importTransaksi.errMaxRows', { count: groups.length }))
      setPreview([])
      return
    }
    setPreview(groups)
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    const newLog = []

    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id, code')
      .eq('company_id', companyId)
    if (accErr) { setError(accErr.message); setImporting(false); return }
    const codeToId = Object.fromEntries((accounts || []).map((a) => [a.code, a.id]))

    for (let i = 0; i < preview.length; i++) {
      const g = preview[i]
      const totalDebit = g.lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = g.lines.reduce((s, l) => s + l.credit, 0)
      if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
        newLog.push({ i, ok: false, msg: t('importTransaksi.rowMismatch', { row: i + 1, debit: totalDebit, credit: totalCredit }) })
        continue
      }
      const unknownCode = g.lines.find((l) => !codeToId[l.kodeAkun])
      if (unknownCode) {
        newLog.push({ i, ok: false, msg: t('importTransaksi.rowUnknownCode', { row: i + 1, code: unknownCode.kodeAkun }) })
        continue
      }
      const lines = g.lines.map((l) => ({ account_id: codeToId[l.kodeAkun], debit: l.debit, credit: l.credit }))
      const dateVal = g.date instanceof Date ? g.date.toISOString() : new Date(g.date).toISOString()
      const { error } = await supabase.rpc('create_transaction', {
        p_company_id: companyId,
        p_date: dateVal,
        p_type: 'general',
        p_note: g.note || '(import excel)',
        p_contact_id: null,
        p_lines: lines,
      })
      if (error) newLog.push({ i, ok: false, msg: t('importTransaksi.rowFailed', { row: i + 1, msg: error.message }) })
      else newLog.push({ i, ok: true, msg: t('importTransaksi.rowSuccess', { row: i + 1 }) })
    }
    setLog(newLog)
    setImporting(false)
  }

  return (
    <div>
      <div className="p-6">
        <div className="page-header"><h1>{t('importTransaksi.title')}</h1></div>
        {!canEdit ? (
          <ViewerNotice />
        ) : (
        <>
        <div className="section">
          <p className="hint" style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: t('importTransaksi.formatHint') }} />
          <FileDropzone fileName={fileName} onFileSelected={handleFile} />
        </div>

        {error && <p className="error">{error}</p>}

        {preview.length > 0 && (
          <div className="section">
            <h3>{t('importTransaksi.previewTitle', { count: preview.length, file: fileName })}</h3>
            <table className="tbl">
              <thead><tr><th>{t('importTransaksi.colNumber')}</th><th>{t('importTransaksi.colDate')}</th><th>{t('importTransaksi.colNote')}</th><th>{t('importTransaksi.colJournalLines')}</th></tr></thead>
              <tbody>
                {preview.map((g, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{g.date instanceof Date ? g.date.toLocaleString(i18n.language) : String(g.date)}</td>
                    <td>{g.note}</td>
                    <td>{g.lines.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-primary" onClick={handleImport} disabled={importing} style={{ marginTop: 14 }}>
              {importing ? t('importTransaksi.importing') : t('importTransaksi.uploadNow', { count: preview.length })}
            </button>
          </div>
        )}

        {log.length > 0 && (
          <div className="section">
            <h3>{t('importTransaksi.resultTitle')}</h3>
            <ul>
              {log.map((l, i) => (
                <li key={i} style={{ color: l.ok ? '#1a8a4b' : '#c43030' }}>{l.ok ? '✅' : '❌'} {l.msg}</li>
              ))}
            </ul>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
