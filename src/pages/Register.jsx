import { useEffect, useState } from 'react'
import { registerAccount, isUserIdTaken, generateUniqueUserId } from '../lib/supabase'
import AlertDialog from '../components/AlertDialog'

export default function Register({ onNavigate }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [userId, setUserId] = useState('')
  const [generatingId, setGeneratingId] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-generate a unique User ID on page load
  useEffect(() => {
    async function init() {
      setGeneratingId(true)
      const id = await generateUniqueUserId()
      setUserId(id)
      setGeneratingId(false)
    }
    init()
  }, [])

  async function handleRegenerate() {
    setGeneratingId(true)
    const id = await generateUniqueUserId()
    setUserId(id)
    setGeneratingId(false)
  }

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
    if (!form.password) return setError('6-digit PIN is required.')
    if (!/^\d{6}$/.test(form.password)) return setError('PIN must be exactly 6 digits.')
    if (form.password !== form.confirmPassword) return setError('PINs do not match.')
    if (!userId) return setError('User ID is not ready yet. Please wait.')

    setLoading(true)
    try {
      // Double-check uniqueness right before submission
      const taken = await isUserIdTaken(userId)
      if (taken) {
        const newId = await generateUniqueUserId()
        setUserId(newId)
        setError('Your User ID had a conflict. A new one has been generated. Please submit again.')
        setLoading(false)
        return
      }

      await registerAccount({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        userId,
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

          {/* User ID — read-only, auto-generated */}
          <div className="xml-field">
            <span>Your User ID <em style={{ fontSize: '11px', fontWeight: 400, color: '#888' }}>(auto-assigned, share this with the kiosk)</em></span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={generatingId ? 'Generating...' : userId}
                readOnly
                style={{ fontFamily: 'monospace', letterSpacing: '0.2em', fontWeight: '700', flex: 1 }}
              />
              <button
                type="button"
                className="secondary-button"
                style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}
                onClick={handleRegenerate}
                disabled={generatingId || loading}
              >
                {generatingId ? '...' : '↻ New ID'}
              </button>
            </div>
          </div>

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
              autoComplete="new-password"
            />
          </label>

          <label className="xml-field">
            <span>Confirm 6-Digit PIN</span>
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

          <button className="primary-button xml-black-button" type="submit" disabled={loading || generatingId}>
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
