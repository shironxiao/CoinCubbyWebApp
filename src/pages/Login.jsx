import { useState } from 'react'
import { loginWithPassword, sendPasswordResetEmail } from '../lib/supabase'
import logo from '../assets/coin_logo.png'
import AlertDialog from '../components/AlertDialog'

export default function Login({ onNavigate, onLogin, t, lang }) {
  const [form, setForm] = useState({ email: '', password: '' })
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
      const session = await loginWithPassword(form.email.trim(), form.password)
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
    } catch (err) {
      setResetError(lang === 'tl' ? 'Bigo sa pagpapadala ng recovery email. Pakisubukan muli.' : 'Failed to send recovery email. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <main className="auth-page android-auth login-page">
      <section className="auth-panel xml-login-panel">
        <img className="auth-logo" src={logo} alt="CoinCubby logo" />

        {view === 'login' ? (
          <>
            <div>
              <h1>CoinCubby</h1>
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

              {error && <AlertDialog type="error" message={error} onClose={() => setError('')} />}

              <button className="primary-button xml-black-button" type="submit" disabled={loading}>
                {loading ? t('logging_in') : t('continue_payment')}
              </button>
            </form>

            <p className="auth-switch">
              <button
                type="button"
                onClick={() => {
                  setView('forgot')
                  setResetEmail(form.email)
                  setResetError('')
                  setResetNotice('')
                }}
              >
                {t('forgot_pin')}
              </button>
            </p>

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

              {resetError && <AlertDialog type="error" message={resetError} onClose={() => setResetError('')} />}
              {resetNotice && <AlertDialog type="success" message={resetNotice} onClose={() => setResetNotice('')} />}

              <button className="primary-button xml-black-button" type="submit" disabled={resetLoading}>
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

