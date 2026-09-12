import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext.jsx'

// Ditampilkan otomatis (bukan lewat route biasa) ketika user klik link reset
// password dari email — AuthContext mendeteksi event PASSWORD_RECOVERY dari
// Supabase dan me-render halaman ini menggantikan seluruh app sampai password
// baru berhasil disimpan.
export default function ResetPassword() {
  const { t } = useTranslation()
  const { setPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError(t('login.errPasswordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('login.errPasswordMismatch'))
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
    setTimeout(() => setPasswordRecovery(false), 1800)
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-anim">
        <span className="auth-blob b1" /><span className="auth-blob b2" /><span className="auth-blob b3" />
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-icon-badge"><KeyRound size={22} /></div>
        <h1>{t('login.resetPasswordTitle')}</h1>
        <p className="hint" style={{ marginTop: -10, marginBottom: 6 }}>{t('login.resetPasswordDesc')}</p>

        {success ? (
          <p style={{ color: 'var(--positive)', fontSize: 13.5, marginTop: 12 }}>{t('login.resetPasswordSuccess')}</p>
        ) : (
          <>
            <label>{t('login.newPassword')}</label>
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <label>{t('login.confirmPassword')}</label>
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>

            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={saving}>
              {saving ? t('login.processing') : t('login.resetPasswordButton')}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
