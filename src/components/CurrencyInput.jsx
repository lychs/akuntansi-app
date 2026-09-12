import { useState, useEffect } from 'react'

function formatNumber(n) {
  if (n === '' || n === null || n === undefined || Number.isNaN(n)) return ''
  return Number(n).toLocaleString('id-ID')
}

// Input angka yang menampilkan format ribuan Indonesia (1.000.000) selagi diketik,
// tapi tetap kirim/simpan sebagai number murni lewat onChange.
export default function CurrencyInput({ value, onChange, placeholder = '0', required, id }) {
  const [display, setDisplay] = useState(formatNumber(value))

  useEffect(() => {
    setDisplay(formatNumber(value))
  }, [value])

  function handleChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    const num = raw === '' ? 0 : Number(raw)
    setDisplay(raw === '' ? '' : formatNumber(num))
    onChange(num)
  }

  return (
    <div className="currency-input">
      <span className="currency-prefix">Rp</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}
