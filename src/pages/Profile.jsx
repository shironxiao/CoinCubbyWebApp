/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchProfile, logout, changePassword } from '../lib/supabase'

export default function Profile({ session, onLogout, onNavigate, addNotification }) {
  const [profile, setProfile] = useState({
    fullName: session?.fullName || '',
    contact: session?.email || '',
    userId: session?.userId || '',
  })
  const [message, setMessage] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)

  function updatePasswordFields(event) {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!passwordForm.password) return setError('Password is required.')
    if (passwordForm.password.length < 6) return setError('Password must be at least 6 characters.')
    if (passwordForm.password !== passwordForm.confirmPassword) return setError('Passwords do not match.')

    setLoadingPassword(true)
    try {
      await changePassword(passwordForm.password, session?.accessToken)
      setNotice('Password updated successfully.')
      
      // Trigger notification
      if (addNotification) {
        addNotification({
          title: 'Password Updated',
          content: 'Your account password was updated successfully.',
          type: 'security',
        })
      }

      setPasswordForm({ password: '', confirmPassword: '' })
      setTimeout(() => {
        setIsChangingPassword(false)
        setNotice('')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Password update failed. Please try again.')
    } finally {
      setLoadingPassword(false)
    }
  }

  const initials = useMemo(() => {
    const name = profile.fullName || profile.contact || 'User'
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }, [profile])

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return

    try {
      const { user, customer } = await fetchProfile(session)
      setProfile({
        fullName: customer?.full_name || user.user_metadata?.full_name || session.fullName || 'User',
        contact: customer?.email || user.email || session.email || '',
        userId: customer?.customer_id || user.id || session.userId,
      })
    } catch (err) {
      setMessage(err.message || 'Showing cached profile only.')
    }
  }, [session])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function handleSignOut() {
    try {
      await logout(session?.accessToken)
    } finally {
      onLogout()
      onNavigate('login')
    }
  }

  return (
    <main className="page xml-page profile-page">
      <header className="xml-topbar">
        <strong>Profile</strong>
      </header>

      <section className="profile-hero">
        <div className="avatar">{initials || 'U'}</div>
        <h1>{profile.fullName || 'Loading...'}</h1>
        <p>{profile.contact}</p>
      </section>

      {message && <p className="alert">{message}</p>}

      <section className="info-panel">
        <p>Access Token</p>
        <strong style={{ letterSpacing: '0.1em' }}>Per-Transaction PIN</strong>
        <small>A unique 6-digit PIN is generated for each locker rental. View it on your active rental card.</small>
      </section>

      {!isChangingPassword ? (
        <section
          className="xml-list-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setIsChangingPassword(true)}
        >
          <span>▣</span>
          <p>Change password</p>
          <b>›</b>
        </section>
      ) : (
        <form className="form-stack" onSubmit={handleChangePassword} style={{ marginTop: '16px' }}>
          <label className="xml-field">
            <span>New Password</span>
            <input
              name="password"
              type="password"
              value={passwordForm.password}
              onChange={updatePasswordFields}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>
          <label className="xml-field">
            <span>Confirm Password</span>
            <input
              name="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={updatePasswordFields}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>

          {error && <p className="alert">{error}</p>}
          {notice && <p className="success">{notice}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setIsChangingPassword(false)
                setPasswordForm({ password: '', confirmPassword: '' })
                setError('')
                setNotice('')
              }}
            >
              Cancel
            </button>
            <button className="primary-button xml-black-button" type="submit" disabled={loadingPassword}>
              {loadingPassword ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <button className="danger-button xml-black-button" type="button" onClick={handleSignOut}>
        Sign Out
      </button>
    </main>
  )
}
