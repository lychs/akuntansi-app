import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import FileDropzone from '../../components/FileDropzone.jsx'

const VALID_CATEGORIES = [
  'kas_bank', 'piutang', 'persediaan', 'harta_lancar_lainnya', 'harta_tetap',
  'hutang', 'modal', 'pendapatan', 'beban_pokok', 'beban_operasional',
]

export default function ImportAkun() {
  const { t } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [log, setLog] = useState([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(file) {
    if (!file) { setFileName(''); setRows([]); return }
    setFileName(file.name)
    setError(null)
    setLog([])
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const parsed = json
      .filter((r) => r['Kode'])
      .map((r) => ({
        code: String(r['Kode']).trim(),
        name: String(r['Nama'] || '').trim(),
        category: String(r['Kategori'] || '').trim(),
        normal_balance: String(r['Normal Balance'] || '').trim().toLowerCase(),
        description: String(r['Deskripsi'] || '').trim(),
      }))
    if (parsed.length > 200) {
      setError(t('importAkun.errMaxRows', { count: parsed.length }))
      setRows([])
      return
    }
    setRows(parsed)
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    const newLog = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!VALID_CATEGORIES.includes(r.category)) {
        newLog.push({ ok: false, msg: t('importAkun.errInvalidCategory', { row: i + 1, code: r.code, category: r.category, valid: VALID_CATEGORIES.join(', ') }) })
        continue
      }
      if (!['debit', 'kredit'].includes(r.normal_balance)) {
        newLog.push({ ok: false, msg: t('importAkun.errInvalidNormalBalance', { row: i + 1, code: r.code }) })
        continue
      }
      if (!r.name) {
        newLog.push({ ok: false, msg: t('importAkun.errNameRequired', { row: i + 1, code: r.code }) })
        continue
      }
      const { error } = await supabase.from('accounts').insert({
        company_id: companyId, code: r.code, name: r.name, category: r.category,
        normal_balance: r.normal_balance, description: r.description || null,
      })
      newLog.push(error
        ? { ok: false, msg: t('importAkun.rowFailed', { row: i + 1, code: r.code, msg: error.message }) }
        : { ok: true, msg: t('importAkun.rowSuccess', { row: i + 1, code: r.code }) })
    }
    setLog(newLog)
    setImporting(false)
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('importAkun.title')}</h1></div>
      {!canEdit ? (
        <ViewerNotice />
      ) : (
      <>
      <div className="section">
        <p className="hint" style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: t('importAkun.formatHint', { categories: VALID_CATEGORIES.join(', ') }) }} />
        <FileDropzone fileName={fileName} onFileSelected={handleFile} />
      </div>
      {error && <p className="error">{error}</p>}
      {rows.length > 0 && (
        <div className="section">
          <h3>{t('importAkun.previewTitle', { count: rows.length, file: fileName })}</h3>
          <table className="tbl">
            <thead><tr><th>{t('importAkun.colCode')}</th><th>{t('importAkun.colName')}</th><th>{t('importAkun.colCategory')}</th><th>{t('importAkun.colNormalBalance')}</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.category}</td><td>{r.normal_balance}</td></tr>
              ))}
            </tbody>
          </table>
          <button className="btn-primary" onClick={handleImport} disabled={importing} style={{ marginTop: 14 }}>
            {importing ? t('importAkun.importing') : t('importAkun.uploadNow', { count: rows.length })}
          </button>
        </div>
      )}
      {log.length > 0 && (
        <div className="section">
          <h3>{t('importAkun.resultTitle')}</h3>
          <ul>{log.map((l, i) => <li key={i} style={{ color: l.ok ? 'var(--positive)' : 'var(--negative)' }}>{l.ok ? '✅' : '❌'} {l.msg}</li>)}</ul>
        </div>
      )}
      </>
      )}
    </div>
  )
}
