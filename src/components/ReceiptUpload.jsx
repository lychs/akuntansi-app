import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react'

const MAX_SIZE = 1024 * 1024 // 1 MB

// Field upload "Simpan Bukti" (PDF/gambar, maks 1MB) — dipakai di semua form
// transaksi (Jasa & Dagang). Cuma nyimpen FILE di state sampai form disubmit —
// upload beneran ke Supabase Storage baru kejadian pas transaksinya berhasil
// dibuat (biar gak ada file nyangkut kalau submit gagal).
export default function ReceiptUpload({ file, setFile }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [error, setError] = useState(null)

  function handleChange(e) {
    const f = e.target.files[0]
    setError(null)
    if (!f) { setFile(null); return }
    if (f.size > MAX_SIZE) {
      setError(t('receiptUpload.errTooBig'))
      e.target.value = ''
      return
    }
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      setError(t('receiptUpload.errType'))
      e.target.value = ''
      return
    }
    setFile(f)
  }

  function handleClear() {
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="field">
      <label>{t('receiptUpload.label')}</label>
      {file ? (
        <div className="receipt-chip">
          {file.type === 'application/pdf' ? <FileText size={14} /> : <ImageIcon size={14} />}
          <span>{file.name}</span>
          <button type="button" onClick={handleClear} title={t('common.delete')}><X size={13} /></button>
        </div>
      ) : (
        <label className="btn-secondary receipt-upload-btn">
          <Paperclip size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t('receiptUpload.button')}
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden onChange={handleChange} />
        </label>
      )}
      <p className="hint" style={{ margin: '4px 0 0' }}>{t('receiptUpload.hint')}</p>
      {error && <p className="error" style={{ margin: '4px 0 0', fontSize: 11.5 }}>{error}</p>}
    </div>
  )
}

// Upload file ke bucket private, return path-nya (buat disimpan di kolom
// receipt_path). Path selalu diawali company_id biar RLS storage bisa ngecek.
export async function uploadReceiptIfNeeded(supabase, companyId, file) {
  if (!file) return null
  const ext = file.name.split('.').pop()
  const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('transaction-receipts').upload(path, file)
  if (error) throw error
  return path
}
