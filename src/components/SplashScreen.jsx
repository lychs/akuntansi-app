import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Splash screen animasi logo 3D — tampil sekali pas app pertama kali dibuka,
// lalu otomatis fade-out dan manggil onFinish() buat lanjut ke app sungguhan.
export default function SplashScreen({ onFinish }) {
  const { t } = useTranslation()
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 2600)
    const finishTimer = setTimeout(() => onFinish(), 3100)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(finishTimer)
    }
  }, [onFinish])

  return (
    <div className={`splash-stage ${fadingOut ? 'splash-fade-out' : ''}`}>
      <div className="splash-glow" />
      <div className="splash-badge-wrap">
        <img src="/logo-icon.png" alt="My Worksheet" className="splash-logo-img" />
        <div className="splash-shine" />
      </div>
      <div className="splash-wordmark">My Worksheet</div>
      <div className="splash-tagline">{t('splash.tagline')}</div>
    </div>
  )
}
