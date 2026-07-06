import { useState } from 'react'
import { loginWithPassword, sendPasswordResetEmail } from '../lib/supabase'
import logo from '../assets/coin_logo.png'
import AlertDialog from '../components/AlertDialog'

export default function Login({ onNavigate, onLogin }) {
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

    if (!form.email.trim()) return setError('Please enter your email.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    if (!form.password) return setError('Please enter your password.')

    setLoading(true)
    try {
      const session = await loginWithPassword(form.email.trim(), form.password)
      onLogin(session)
      onNavigate('home')
    } catch (err) {
      const message = err.message?.includes('Email not confirmed')
        ? 'Please confirm your email before logging in.'
        : err.message || 'Invalid email or password.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault()
    setResetError('')
    setResetNotice('')

    if (!resetEmail.trim()) return setResetError('Please enter your email.')
    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) return setResetError('Enter a valid email address.')

    setResetLoading(true)
    try {
      await sendPasswordResetEmail(resetEmail.trim())
      setResetNotice('Password reset link sent! Please check your inbox.')
      setResetEmail('')
    } catch (err) {
      setResetError(err.message || 'Failed to send recovery email. Please try again.')
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
              <p className="muted">Log in to our smart public locker system</p>
            </div>

            <form className="form-stack" onSubmit={handleSubmit}>
              <label className="xml-field">
                <span>Email Address</span>
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
                <span>6-Digit PIN</span>
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
                {loading ? 'Logging in...' : 'Continue'}
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
                Forgot your PIN?
              </button>
            </p>

            <p className="auth-switch">
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => onNavigate('register')}>
                Create an account
              </button>
            </p>
          </>
        ) : (
          <>
            <div>
              <h1>Reset PIN</h1>
              <p className="muted">Enter your email and we&apos;ll send you a reset link</p>
            </div>

            <form className="form-stack" onSubmit={handleResetSubmit}>
              <label className="xml-field">
                <span>Email Address</span>
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
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
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
                Back to Login
              </button>
            </p>
          </>
        )}
      </section>
    </main>
  )
}

