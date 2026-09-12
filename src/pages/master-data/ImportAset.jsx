import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabaseClient'
import { useCompany } from '../../lib/CompanyContext.jsx'
import ViewerNotice from '../../components/ViewerNotice.jsx'
import FileDropzone from '../../components/FileDropzone.jsx'

export default function ImportAset() {
  const { t, i18n } = useTranslation()
  const companyId = localStorage.getItem('activeCompanyId')
  const { canEdit } = useCompany()
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [log, setLog] = useState([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  function excelDateToStr(v) {
    if (!v) return ''
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return String(v)
  }

  async function handleFile(file) {
    if (!file) { setFileName(''); setRows([]); return }
    setFileName(file.name)
    setError(null)
    setLog([])
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const parsed = json
      .filter((r) => r['Kode'])
      .map((r) => ({
        code: String(r['Kode']).trim(),
        name: String(r['Nama'] || '').trim(),
        account_code: String(r['Kode Akun'] || '').trim(),
        description: String(r['Deskripsi'] || '').trim(),
        acquisition_date: excelDateToStr(r['Tanggal Akuisisi']),
        acquisition_cost: Number(r['Biaya Akuisisi']) || 0,
        depreciation_start_date: excelDateToStr(r['Tanggal Mulai Disusutkan']),
        useful_life_months: Number(r['Masa Manfaat (bulan)']) || null,
        salvage_value: Number(r['Nilai Residu']) || 0,
      }))
    if (parsed.length > 200) {
      setError(t('importAset.errMaxRows', { count: parsed.length }))
      setRows([])
      return
    }
    setRows(parsed)
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    const newLog = []

    const { data: accounts, error: accErr } = await supabase
      .from('accounts').select('id, code').eq('company_id', companyId).eq('category', 'harta_tetap')
    if (accErr) { setError(accErr.message); setImporting(false); return }
    const codeToId = Object.fromEntries((accounts || []).map((a) => [a.code, a.id]))

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const accountId = codeToId[r.account_code]
      if (!accountId) {
        newLog.push({ ok: false, msg: t('importAset.errAccountNotFound', { row: i + 1, code: r.code, accountCode: r.account_code }) })
        continue
      }
      if (!r.acquisition_date) {
        newLog.push({ ok: false, msg: t('importAset.errAcqDateInvalid', { row: i + 1, code: r.code }) })
        continue
      }
      const { error } = await supabase.from('assets').insert({
        company_id: companyId, code: r.code, name: r.name, account_id: accountId,
        description: r.description || null, acquisition_date: r.acquisition_date,
        acquisition_cost: r.acquisition_cost,
        depreciation_start_date: r.depreciation_start_date || null,
        useful_life_months: r.useful_life_months,
        salvage_value: r.salvage_value,
      })
      newLog.push(error
        ? { ok: false, msg: t('importAset.rowFailed', { row: i + 1, code: r.code, msg: error.message }) }
        : { ok: true, msg: t('importAset.rowSuccess', { row: i + 1, code: r.code }) })
    }
    setLog(newLog)
    setImporting(false)
  }

  return (
    <div className="p-6">
      <div className="page-header"><h1>{t('importAset.title')}</h1></div>
      {!canEdit ? (
        <ViewerNotice />
      ) : (
      <>
      <div className="section">
        <p className="hint" style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: t('importAset.formatHint') }} />
        <FileDropzone fileName={fileName} onFileSelected={handleFile} />
      </div>
      {error && <p className="error">{error}</p>}
      {rows.length > 0 && (
        <div className="section">
          <h3>{t('importAset.previewTitle', { count: rows.length, file: fileName })}</h3>
          <table className="tbl">
            <thead><tr><th>{t('importAset.colCode')}</th><th>{t('importAset.colName')}</th><th>{t('importAset.colAccountCode')}</th><th>{t('importAset.colAcqDate')}</th><th className="num">{t('importAset.colCost')}</th></tr></thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.account_code}</td><td>{r.acquisition_date}</td><td className="num">{r.acquisition_cost.toLocaleString(i18n.language)}</td></tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && <p className="hint">{t('importAset.moreRows', { count: rows.length - 20 })}</p>}
          <button className="btn-primary" onClick={handleImport} disabled={importing} style={{ marginTop: 14 }}>
            {importing ? t('importAset.importing') : t('importAset.uploadNow', { count: rows.length })}
          </button>
        </div>
      )}
      {log.length > 0 && (
        <div className="section">
          <h3>{t('importAset.resultTitle')}</h3>
          <ul>{log.map((l, i) => <li key={i} style={{ color: l.ok ? 'var(--positive)' : 'var(--negative)' }}>{l.ok ? '✅' : '❌'} {l.msg}</li>)}</ul>
        </div>
      )}
      </>
      )}
    </div>
  )
}
