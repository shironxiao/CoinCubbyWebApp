import { useState } from 'react'
import { changePassword } from '../lib/supabase'
import logo from '../assets/coin_logo.png'
import AlertDialog from '../components/AlertDialog'

export default function ResetPassword({ accessToken, onNavigate }) {
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.password) return setError('PIN is required.')
    if (!/^\d{6}$/.test(form.password)) return setError('PIN must be exactly 6 digits.')
    if (form.password !== form.confirmPassword) return setError('PINs do not match.')

    setLoading(true)
    try {
      await changePassword(form.password, accessToken)
      setNotice('PIN updated successfully! Redirecting to login...')
      setTimeout(() => onNavigate('login'), 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset PIN. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page android-auth">
      <section className="auth-panel xml-login-panel">
        <img className="auth-logo" src={logo} alt="CoinCubby logo" />
        <div>
          <h1>Set New PIN</h1>
          <p className="muted">Enter your new 6-digit PIN below</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="xml-field">
            <span>New 6-Digit PIN</span>
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
              autoComplete="new-password"
            />
          </label>
          <label className="xml-field">
            <span>Confirm New 6-Digit PIN</span>
            <input
              name="confirmPassword"
              type="password"
              inputMode="numeric"
              maxLength="6"
              value={form.confirmPassword}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setForm((current) => ({ ...current, confirmPassword: val }))
              }}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>

          {error && <AlertDialog type="error" message={error} onClose={() => setError('')} />}
          {notice && <AlertDialog type="success" message={notice} onClose={() => setNotice('')} />}

          <button className="primary-button xml-black-button" type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Reset PIN'}
          </button>
        </form>

        <p className="auth-switch">
          <button type="button" onClick={() => onNavigate('login')}>
            Back to Login
          </button>
        </p>
      </section>
    </main>
  )
}
