import { useEffect, useState } from 'react'

// Hitungan mundur hidup (hari/jam/menit/detik) sampai sebuah tanggal target.
// Dipakai buat nunjukin sisa waktu paket berbayar di halaman Billing.
export function useCountdown(targetDate) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!targetDate) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (!targetDate) return null

  const diff = new Date(targetDate).getTime() - now
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  return { expired: false, days, hours, minutes, seconds }
}
