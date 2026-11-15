import { useState } from 'react'
import { loginWithPassword, sendPasswordResetEmail } from '../lib/supabase'
import logo from '../assets/CoinCubby.png'
import AlertDialog from '../components/AlertDialog'
import LoadingScreen from '../components/LoadingScreen'

export default function Login({ onNavigate, onLogin, t, lang }) {
  const [form, setForm] = useState(() => ({
    email: localStorage.getItem('coincubby.rememberedEmail') || '',
    password: '',
  }))
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('coincubby.remember_me') !== 'false')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [view, setView] = useState('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetNotice, setResetNotice] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!form.email.trim()) return setError(lang === 'tl' ? 'Mangyaring ilagay ang iyong email.' : 'Please enter your email.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError(lang === 'tl' ? 'Ilagay ang wastong email address.' : 'Enter a valid email address.')
    if (!form.password) return setError(lang === 'tl' ? 'Mangyaring ilagay ang iyong PIN.' : 'Please enter your PIN.')

    setLoading(true)
    try {
      localStorage.setItem('coincubby.remember_me', rememberMe ? 'true' : 'false')
      const session = await loginWithPassword(form.email.trim(), form.password, rememberMe)
      await new Promise((resolve) => setTimeout(resolve, 600))
      onLogin(session)
      onNavigate('home')
    } catch (err) {
      const message = err.message?.includes('Email not confirmed')
        ? (lang === 'tl' ? 'Pakikumpirma muna ang iyong email bago mag-log in.' : 'Please confirm your email before logging in.')
        : (lang === 'tl' ? 'Maling email o PIN.' : 'Invalid email or password.')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault()
    setResetError('')
    setResetNotice('')

    if (!resetEmail.trim()) return setResetError(lang === 'tl' ? 'Mangyaring ilagay ang iyong email.' : 'Please enter your email.')
    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) return setResetError(lang === 'tl' ? 'Ilagay ang wastong email address.' : 'Enter a valid email address.')

    setResetLoading(true)
    try {
      await sendPasswordResetEmail(resetEmail.trim())
      setResetNotice(lang === 'tl' ? 'Naipadala na ang link para sa pag-reset ng password! Pakisuri ang iyong inbox.' : 'Password reset link sent! Please check your inbox.')
      setResetEmail('')
    } catch {
      setResetError(lang === 'tl' ? 'Bigo sa pagpapadala ng recovery email. Pakisubukan muli.' : 'Failed to send recovery email. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <main className="auth-page android-auth login-page neo-brutalist-login">
      {loading && (
        <LoadingScreen
          message={lang === 'tl' ? 'Pumapasok sa CoinCubby...' : 'Signing in to CoinCubby...'}
        />
      )}
      {/* Neo-brutalist decorative badges matching the kiosk screen */}
      <div className="neo-sticker sticker-top-left" aria-hidden="true">
        <span>↓</span>
      </div>
      <div className="neo-sticker sticker-top-right" aria-hidden="true">
        <span>⊞</span>
      </div>
      <div className="neo-sticker sticker-bottom-left" aria-hidden="true">
        <span>✓</span>
      </div>
      <div className="neo-sticker sticker-bottom-right" aria-hidden="true">
        <span>!</span>
      </div>
      <div className="neo-dot dot-top-center" aria-hidden="true"></div>
      <div className="neo-dot dot-bottom-center" aria-hidden="true"></div>

      <section className="auth-panel xml-login-panel neo-login-card">
        <div className="neo-logo-wrapper">
          <img className="auth-logo coin-logo-animated" src={logo} alt="CoinCubby logo" />
        </div>

        {view === 'login' ? (
          <>
            <div className="neo-header-block">
              <h1>CoinCubby</h1>
              <div className="neo-kiosk-tagline">
                Smart Locker System • Secure Storage
              </div>
              <p className="muted">{t('login_sub')}</p>
            </div>

            <form className="form-stack" onSubmit={handleSubmit}>
              <label className="xml-field">
                <span>{t('email_label')}</span>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="example@mail.com"
                  autoComplete="email"
                />
              </label>
              <label className="xml-field">
                <span>{t('pin_label')}</span>
                <input
                  name="password"
                  type="password"
                  inputMode="numeric"
                  maxLength="6"
                  value={form.password}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setForm((current) => ({ ...current, password: val }))
                  }}
                  placeholder="••••••"
                  autoComplete="current-password"
                />
              </label>

              <div className="login-options-row">
                <label className="remember-me-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>{t('remember_me')}</span>
                </label>
                <button
                  type="button"
                  className="forgot-pin-link"
                  onClick={() => {
                    setView('forgot')
                    setResetEmail(form.email)
                    setResetError('')
                    setResetNotice('')
                  }}
                >
                  {t('forgot_pin')}
                </button>
              </div>

              {error && (
                <AlertDialog
                  type="error"
                  title={lang === 'tl' ? 'Maling Kredensyal' : 'Invalid Credentials'}
                  message={error}
                  confirmText="Try Again"
                  onClose={() => setError('')}
                />
              )}

              <button className="primary-button xml-black-button neo-action-button" type="submit" disabled={loading}>
                {loading ? t('logging_in') : t('continue_payment')}
              </button>
            </form>

            <p className="auth-switch">
              {t('no_account')}{' '}
              <button type="button" onClick={() => onNavigate('register')}>
                {t('create_one')}
              </button>
            </p>
          </>
        ) : (
          <>
            <div>
              <h1>{t('reset_pin_title')}</h1>
              <p className="muted">{t('reset_pin_sub')}</p>
            </div>

            <form className="form-stack" onSubmit={handleResetSubmit}>
              <label className="xml-field">
                <span>{t('email_label')}</span>
                <input
                  name="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="example@mail.com"
                  autoComplete="email"
                />
              </label>

              {resetError && (
                <AlertDialog
                  type="error"
                  title={lang === 'tl' ? 'Hindi Maipadala' : 'Failed to Send'}
                  message={resetError}
                  confirmText="OK"
                  onClose={() => setResetError('')}
                />
              )}
              {resetNotice && (
                <AlertDialog
                  type="success"
                  title={lang === 'tl' ? 'Email Naipadala!' : 'Email Sent!'}
                  message={resetNotice}
                  confirmText={lang === 'tl' ? 'Salamat' : 'Got it'}
                  onClose={() => setResetNotice('')}
                />
              )}

              <button className="primary-button xml-black-button neo-action-button" type="submit" disabled={resetLoading}>
                {resetLoading ? t('sending') : t('send_reset_link')}
              </button>
            </form>

            <p className="auth-switch">
              <button
                type="button"
                onClick={() => {
                  setView('login')
                  setResetError('')
                  setResetNotice('')
                }}
              >
                {t('back_to_login')}
              </button>
            </p>
          </>
        )}
      </section>
    </main>
  )
}
