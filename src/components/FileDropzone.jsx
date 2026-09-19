import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react'

// Dropzone modern buat upload file Excel — dipakai di semua halaman Import
// (Transaksi, Akun, Aset, Kontak). Ganti tampilan <input type="file"> polos
// jadi kotak drag-and-drop dengan preview nama file.
export default function FileDropzone({ onFileSelected, fileName, accept = '.xlsx,.xls' }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files) {
    if (files && files[0]) onFileSelected(files[0])
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleClear(e) {
    e.stopPropagation()
    if (inputRef.current) inputRef.current.value = ''
    onFileSelected(null)
  }

  return (
    <div
      className={`file-dropzone ${dragOver ? 'drag-over' : ''} ${fileName ? 'has-file' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {fileName ? (
        <>
          <FileSpreadsheet size={28} className="file-dropzone-icon" />
          <div className="file-dropzone-filename">{fileName}</div>
          <button type="button" className="file-dropzone-clear" onClick={handleClear} title={t('common.delete')}>
            <X size={13} />
          </button>
        </>
      ) : (
        <>
          <UploadCloud size={28} className="file-dropzone-icon" />
          <div className="file-dropzone-text">{t('exportMenu.dropzoneText')}</div>
          <div className="file-dropzone-hint">{t('exportMenu.dropzoneHint')}</div>
        </>
      )}
    </div>
  )
}
