import { useState } from 'react'
import { loginWithPassword } from '../lib/supabase'
import logo from '../assets/coin_logo.png'

export default function Login({ onNavigate, onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <main className="auth-page android-auth">
      <section className="auth-panel xml-login-panel">
        <img className="auth-logo" src={logo} alt="CoinCubby logo" />
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
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="alert">{error}</p>}

          <button className="primary-button xml-black-button" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Continue'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{' '}
          <button type="button" onClick={() => onNavigate('register')}>
            Create an account
          </button>
        </p>
      </section>
    </main>
  )
}
