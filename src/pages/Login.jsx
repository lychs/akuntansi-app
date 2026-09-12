import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Mail, LogIn, UserPlus2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const { t } = useTranslation()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function switchMode(next) {
    setMode(next)
    setError(null)
    setInfo(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (mode === 'forgot') {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      setInfo(t('login.forgotPasswordSent', { email }))
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError(t('login.errPasswordMismatch'))
      return
    }

    setLoading(true)
    // PENTING: panggil method langsung di object `supabase.auth.xxx(...)`,
    // JANGAN di-detach jadi variabel dulu (`const fn = supabase.auth.xxx`)
    // — itu bikin method-nya kehilangan konteks `this` dan error
    // "Cannot read properties of undefined (reading 'storage')".
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (mode === 'signup') {
      setInfo(t('login.signUpSuccess'))
      switchMode('signin')
      return
    }
    navigate('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-anim">
        <span className="auth-blob b1" /><span className="auth-blob b2" /><span className="auth-blob b3" />
      </div>

      <div className="auth-card-wrap">
        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <div className={`auth-tabs-indicator ${mode === 'signup' ? 'to-signup' : ''}`} />
            <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>
              <LogIn size={15} /> {t('login.signIn')}
            </button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>
              <UserPlus2 size={15} /> {t('login.signUp')}
            </button>
          </div>
        )}

        <form className="auth-card" onSubmit={handleSubmit}>
          {mode === 'forgot' ? (
            <>
              <div className="auth-icon-badge"><Mail size={22} /></div>
              <h1>{t('login.forgotPasswordTitle')}</h1>
              <p className="hint" style={{ marginTop: -10, marginBottom: 6 }}>{t('login.forgotPasswordDesc')}</p>
            </>
          ) : (
            <h1>{mode === 'signin' ? t('login.welcomeBackTitle') : t('login.createAccountTitle')}</h1>
          )}

          <label>{t('login.email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />

          {mode !== 'forgot' && (
            <>
              <label>{t('login.password')}</label>
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </>
          )}

          <div className={`auth-grow-field ${mode === 'signup' ? 'open' : ''}`}>
            <div className="auth-grow-field-inner">
              <label>{t('login.confirmPassword')}</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={mode === 'signup'} minLength={6} tabIndex={mode === 'signup' ? 0 : -1}
                />
              </div>
            </div>
          </div>

          {mode === 'signin' && (
            <button type="button" className="link-btn-inline" onClick={() => switchMode('forgot')}>
              {t('login.forgotPasswordLink')}
            </button>
          )}

          {error && <p className="error">{error}</p>}
          {info && <p style={{ color: 'var(--positive)', fontSize: 13, marginTop: 10 }}>{info}</p>}

          <button type="submit" disabled={loading}>
            {loading
              ? t('login.processing')
              : mode === 'signin' ? t('login.signIn') : mode === 'signup' ? t('login.signUp') : t('login.forgotPasswordButton')}
          </button>

          {mode === 'forgot' && (
            <button type="button" className="link-btn" onClick={() => switchMode('signin')}>
              {t('login.backToSignIn')}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
