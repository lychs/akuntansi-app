export function netAmount(row) {
  return row.normal_balance === 'kredit'
    ? Number(row.total_credit) - Number(row.total_debit)
    : Number(row.total_debit) - Number(row.total_credit)
}

export function sumCategory(rows, category) {
  return (rows || []).filter((r) => r.category === category).reduce((s, r) => s + netAmount(r), 0)
}

export function monthBounds(monthsAgo = 0) {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1)
  const end = new Date(d.getFullYear(), d.getMonth() - monthsAgo + 1, 0)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function fmt(n) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')
}

export function fmtCompact(n) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' M'
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' jt'
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + ' rb'
  return String(Math.round(n))
}

export function trendPct(current, previous) {
  if (!previous) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0)
  return Math.round((due - today) / 86400000)
}

export function dayBefore(dateStr) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function monthsBetween(startStr, end = new Date()) {
  const start = new Date(startStr)
  const endD = end instanceof Date ? end : new Date(end)
  let months = (endD.getFullYear() - start.getFullYear()) * 12 + (endD.getMonth() - start.getMonth())
  if (endD.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

// Nilai buku aset (metode garis lurus): cost - akumulasi penyusutan, gak boleh di bawah nilai residu.
export function computeBookValue(asset) {
  const cost = Number(asset.acquisition_cost) || 0
  if (!asset.depreciation_start_date || !asset.useful_life_months) {
    return { started: false, bookValue: cost, accumulatedDepreciation: 0 }
  }
  const startDate = new Date(asset.depreciation_start_date)
  const today = new Date()
  if (startDate > today) {
    return { started: false, bookValue: cost, accumulatedDepreciation: 0 }
  }
  const salvage = Number(asset.salvage_value) || 0
  const usefulLife = Number(asset.useful_life_months)
  const depreciableBase = Math.max(0, cost - salvage)
  const monthlyDep = usefulLife > 0 ? depreciableBase / usefulLife : 0
  const monthsElapsed = Math.min(monthsBetween(asset.depreciation_start_date, today), usefulLife)
  const accumulatedDepreciation = monthlyDep * monthsElapsed
  const bookValue = Math.max(salvage, cost - accumulatedDepreciation)
  return { started: true, bookValue, accumulatedDepreciation, monthlyDep, monthsElapsed, usefulLife }
}

export const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
