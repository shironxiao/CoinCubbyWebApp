import { useState } from 'react'
import { registerAccount } from '../lib/supabase'

export default function Register({ onNavigate }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.firstName.trim()) return setError('First name is required.')
    if (!form.lastName.trim()) return setError('Last name is required.')
    if (!form.email.trim()) return setError('Email is required.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    if (!form.password) return setError('Password is required.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')

    setLoading(true)
    try {
      await registerAccount({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      setNotice('Account created successfully. Please check your email if confirmation is required.')
      setTimeout(() => onNavigate('login'), 900)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page android-auth">
      <section className="auth-panel xml-register-panel">
        <div>
          <h1>Create Account</h1>
          <p className="muted">Join our smart public locker system</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="two-column">
            <label className="xml-field">
              <span>First Name</span>
              <input name="firstName" value={form.firstName} onChange={updateField} placeholder="John" />
            </label>
            <label className="xml-field">
              <span>Last Name</span>
              <input name="lastName" value={form.lastName} onChange={updateField} placeholder="Doe" />
            </label>
          </div>
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button type="button" onClick={() => onNavigate('login')}>
            Log In
          </button>
        </p>
      </section>
    </main>
  )
}
