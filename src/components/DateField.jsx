import { forwardRef, useEffect, useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { useTranslation } from 'react-i18next'
import { Calendar } from 'lucide-react'
import { id } from 'date-fns/locale/id'
import { enUS } from 'date-fns/locale/en-US'
import { ru } from 'date-fns/locale/ru'
import { fr } from 'date-fns/locale/fr'
import { ms } from 'date-fns/locale/ms'
import { zhCN } from 'date-fns/locale/zh-CN'
import { ja } from 'date-fns/locale/ja'
import { ar } from 'date-fns/locale/ar'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('id', id)
registerLocale('en', enUS)
registerLocale('ru', ru)
registerLocale('fr', fr)
registerLocale('ms', ms)
registerLocale('zh', zhCN)
registerLocale('ja', ja)
registerLocale('ar', ar)

function toDate(str) {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}
function pad(n) { return String(n).padStart(2, '0') }
function toDateStr(d) {
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toDateTimeStr(d) {
  if (!d) return ''
  return `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const CustomInput = forwardRef(({ value, onClick, placeholder, disabled }, ref) => (
  <button type="button" className="date-field-input" onClick={onClick} ref={ref} disabled={disabled}>
    <Calendar size={15} className="date-field-icon" />
    <span className={value ? '' : 'date-field-placeholder'}>{value || placeholder}</span>
  </button>
))

const RangeInput = forwardRef(({ value, onClick, placeholder }, ref) => (
  <button type="button" className="date-field-input date-range-input" onClick={onClick} ref={ref}>
    <Calendar size={15} className="date-field-icon" />
    <span className={value ? '' : 'date-field-placeholder'}>{value || placeholder}</span>
  </button>
))

// DateRangeField — satu kontrol tunggal buat pilih rentang "dari tanggal - sampai
// tanggal" (bukan 2 kalender terpisah). value = { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }.
export function DateRangeField({ value, onChange }) {
  const { t, i18n } = useTranslation()
  // State lokal terpisah dari `value` orang tua — soalnya pas user baru klik
  // tanggal AWAL (klik pertama), tanggal akhir belum ada (null). Kalau langsung
  // kita paksa jadi "start = end" di situ juga, react-datepicker bakal mikir
  // rentangnya udah selesai dipilih, jadi klik kedua malah mulai rentang baru
  // dari nol (bukan menutup rentang) — itu penyebab date picker "kayak gamau".
  const [localStart, setLocalStart] = useState(toDate(value?.start))
  const [localEnd, setLocalEnd] = useState(toDate(value?.end))

  useEffect(() => {
    setLocalStart(toDate(value?.start))
    setLocalEnd(toDate(value?.end))
  }, [value?.start, value?.end])

  function handleChange([start, end]) {
    setLocalStart(start)
    setLocalEnd(end)
    // Cuma kirim ke parent (yang bikin laporan reload) kalau rentangnya udah
    // LENGKAP (2 tanggal terpilih) — biar klik pertama gak langsung nutup rentang.
    if (start && end) {
      onChange({ start: toDateStr(start), end: toDateStr(end) })
    }
  }

  return (
    <DatePicker
      selectsRange
      startDate={localStart}
      endDate={localEnd}
      onChange={handleChange}
      dateFormat="dd/MM/yyyy"
      locale={i18n.language}
      monthsShown={2}
      customInput={<RangeInput placeholder={t('periodFilter.selectRange')} />}
      popperPlacement="bottom-start"
      showPopperArrow={false}
    />
  )
}

// DateField — pengganti <input type="date">, tampilan kalender custom sesuai tema app.
// value/onChange pakai string "YYYY-MM-DD" (sama seperti native date input).
export function DateField({ value, onChange, required, min, max, placeholder, disabled }) {
  const { i18n } = useTranslation()
  return (
    <DatePicker
      selected={toDate(value)}
      onChange={(d) => onChange(toDateStr(d))}
      dateFormat="dd/MM/yyyy"
      locale={i18n.language}
      minDate={min ? toDate(min) : undefined}
      maxDate={max ? toDate(max) : undefined}
      customInput={<CustomInput placeholder={placeholder} disabled={disabled} />}
      required={required}
      disabled={disabled}
      popperPlacement="bottom-start"
      showPopperArrow={false}
    />
  )
}

// DateTimeField — pengganti <input type="datetime-local">.
// value/onChange pakai string "YYYY-MM-DDTHH:mm".
export function DateTimeField({ value, onChange, required, disabled }) {
  const { i18n } = useTranslation()
  return (
    <DatePicker
      selected={toDate(value)}
      onChange={(d) => onChange(toDateTimeStr(d))}
      dateFormat="dd/MM/yyyy HH:mm"
      locale={i18n.language}
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={5}
      customInput={<CustomInput disabled={disabled} />}
      required={required}
      disabled={disabled}
      popperPlacement="bottom-start"
      showPopperArrow={false}
    />
  )
}
