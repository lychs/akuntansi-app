import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import FileDropzone from '../../components/FileDropzone.jsx'

export default function ImportKontak() {
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
      .filter((r) => r['Nama'])
      .map((r) => ({
        name: String(r['Nama']).trim(),
        email: String(r['Email'] || '').trim(),
        phone: String(r['No HP'] || r['No. HP'] || '').trim(),
        address: String(r['Alamat'] || '').trim(),
      }))
    if (parsed.length > 500) {
      setError(t('importKontak.errMaxRows', { count: parsed.length }))
      setRows([])
      return
    }
    setRows(parsed)
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    const payload = rows.map((r) => ({ company_id: companyId, ...r }))
    const { error } = await supabase.from('contacts').insert(payload).select('id')
    setImporting(false)
    if (error) { setError(error.message); return }
    setLog([{ ok: true, msg: t('importKontak.successMsg', { count: rows.length }) }])
    setRows([])
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('importKontak.title')}</h1></div>
      {!canEdit ? (
        <ViewerNotice />
      ) : (
      <>
      <div className="section">
        <p className="hint" style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: t('importKontak.formatHint') }} />
        <FileDropzone fileName={fileName} onFileSelected={handleFile} />
      </div>
      {error && <p className="error">{error}</p>}
      {rows.length > 0 && (
        <div className="section">
          <h3>{t('importKontak.previewTitle', { count: rows.length, file: fileName })}</h3>
          <table className="tbl">
            <thead><tr><th>{t('importKontak.colName')}</th><th>{t('importKontak.colEmail')}</th><th>{t('importKontak.colPhone')}</th><th>{t('importKontak.colAddress')}</th></tr></thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i}><td>{r.name}</td><td>{r.email}</td><td>{r.phone}</td><td>{r.address}</td></tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && <p className="hint">{t('importKontak.moreRows', { count: rows.length - 20 })}</p>}
          <button className="btn-primary" onClick={handleImport} disabled={importing} style={{ marginTop: 14 }}>
            {importing ? t('importKontak.importing') : t('importKontak.uploadNow', { count: rows.length })}
          </button>
        </div>
      )}
      {log.length > 0 && (
        <div className="section">
          {log.map((l, i) => <p key={i} style={{ color: 'var(--positive)' }}>✅ {l.msg}</p>)}
        </div>
      )}
      </>
      )}
    </div>
  )
}
