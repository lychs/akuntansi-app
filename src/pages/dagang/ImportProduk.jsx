import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import FileDropzone from '../../components/FileDropzone.jsx'

export default function ImportProduk() {
  const { t, i18n } = useTranslation()
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
        unit: String(r['Satuan'] || '').trim() || 'pcs',
        sale_price: Number(r['Harga Jual']) || 0,
      }))
    if (parsed.length > 1000) {
      setError(t('importProduk.errMaxRows', { count: parsed.length }))
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
      if (!r.name) {
        newLog.push({ ok: false, msg: t('importProduk.errNameRequired', { row: i + 1, code: r.code }) })
        continue
      }
      const { error } = await supabase.from('products').insert({
        company_id: companyId, code: r.code, name: r.name, unit: r.unit, sale_price: r.sale_price,
      })
      newLog.push(error
        ? { ok: false, msg: t('importProduk.rowFailed', { row: i + 1, code: r.code, msg: error.message }) }
        : { ok: true, msg: t('importProduk.rowSuccess', { row: i + 1, code: r.code }) })
    }
    setLog(newLog)
    setImporting(false)
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('importProduk.title')}</h1></div>
      {!canEdit ? (
        <ViewerNotice />
      ) : (
      <>
      <div className="section">
        <p className="hint" style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: t('importProduk.formatHint') }} />
        <FileDropzone fileName={fileName} onFileSelected={handleFile} />
      </div>
      {error && <p className="error">{error}</p>}
      {rows.length > 0 && (
        <div className="section">
          <h3>{t('importProduk.previewTitle', { count: rows.length, file: fileName })}</h3>
          <table className="tbl">
            <thead><tr><th>{t('produk.colCode')}</th><th>{t('produk.colName')}</th><th>{t('produk.colUnit')}</th><th className="num">{t('produk.colSalePrice')}</th></tr></thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.unit}</td><td className="num">{r.sale_price.toLocaleString(i18n.language)}</td></tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && <p className="hint">{t('importProduk.moreRows', { count: rows.length - 20 })}</p>}
          <button className="btn-primary" onClick={handleImport} disabled={importing} style={{ marginTop: 14 }}>
            {importing ? t('importProduk.importing') : t('importProduk.uploadNow', { count: rows.length })}
          </button>
        </div>
      )}
      {log.length > 0 && (
        <div className="section">
          <h3>{t('importProduk.resultTitle')}</h3>
          <ul>{log.map((l, i) => <li key={i} style={{ color: l.ok ? 'var(--positive)' : 'var(--negative)' }}>{l.ok ? '✅' : '❌'} {l.msg}</li>)}</ul>
        </div>
      )}
      </>
      )}
    </div>
  )
}
