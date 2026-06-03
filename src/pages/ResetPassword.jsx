import { useState } from 'react'
import { changePassword } from '../lib/supabase'
import logo from '../assets/coin_logo.png'

export default function ResetPassword({ accessToken, onNavigate }) {
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.password) return setError('Password is required.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')

    setLoading(true)
    try {
      await changePassword(form.password, accessToken)
      setNotice('Password updated successfully! Redirecting to login...')
      setTimeout(() => onNavigate('login'), 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page android-auth">
      <section className="auth-panel xml-login-panel">
        <img className="auth-logo" src={logo} alt="CoinCubby logo" />
        <div>
          <h1>Set New Password</h1>
          <p className="muted">Enter your new password below</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="xml-field">
            <span>New Password</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>
          <label className="xml-field">
            <span>Confirm Password</span>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={updateField}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>

          {error && <p className="alert">{error}</p>}
          {notice && <p className="success">{notice}</p>}

          <button className="primary-button xml-black-button" type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Reset Password'}
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
