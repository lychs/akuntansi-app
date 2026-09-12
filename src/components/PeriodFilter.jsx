import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateRangeField } from './DateField.jsx'

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

export function usePeriod() {
  const [start, setStart] = useState(firstDayOfMonth())
  const [end, setEnd] = useState(today())
  return { start, setStart, end, setEnd }
}

export default function PeriodFilter({ start, setStart, end, setEnd }) {
  const { t } = useTranslation()
  return (
    <span className="filter-inline-group">
      <label style={{ fontSize: 13, fontWeight: 600 }}>{t('common.periodLabel')}</label>
      <DateRangeField
        value={{ start, end }}
        onChange={(range) => { setStart(range.start); setEnd(range.end) }}
      />
    </span>
  )
}
