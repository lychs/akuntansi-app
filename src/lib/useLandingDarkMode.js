import { useEffect, useState } from 'react'

const KEY = 'lp-dark-mode'

// Hook dark mode buat landing page — kesimpanan pilihannya di localStorage
// (terpisah dari dark mode aplikasi utama, karena landing page bisa diakses
// tanpa login).
export function useLandingDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem(KEY)
    if (saved) return saved === 'dark'
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    localStorage.setItem(KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  return [isDark, () => setIsDark((v) => !v)]
}
