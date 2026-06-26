/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchProfile, logout, changePassword, verifyUserPassword } from '../lib/supabase'

export default function Profile({ session, onLogout, onNavigate, addNotification }) {
  const [profile, setProfile] = useState({
    fullName: session?.fullName || '',
    contact: session?.email || '',
    userId: session?.userId || '',
    coinUserId: '',
  })
  const [message, setMessage] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  function updatePasswordFields(event) {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!passwordForm.currentPassword) return setError('Current PIN is required.')
    if (!/^\d{6}$/.test(passwordForm.currentPassword)) return setError('Current PIN must be exactly 6 digits.')
    if (!passwordForm.password) return setError('New PIN is required.')
    if (!/^\d{6}$/.test(passwordForm.password)) return setError('New PIN must be exactly 6 digits.')
    if (passwordForm.password !== passwordForm.confirmPassword) return setError('PINs do not match.')

    setLoadingPassword(true)
    try {
      // Verify current PIN first
      await verifyUserPassword(profile.contact, passwordForm.currentPassword)
      // Then change to new PIN
      await changePassword(passwordForm.password, session?.accessToken)
      setNotice('PIN updated successfully.')

      if (addNotification) {
        addNotification({
          title: 'PIN Updated',
          content: 'Your account PIN was updated successfully.',
          type: 'security',
        })
      }

      setPasswordForm({ currentPassword: '', password: '', confirmPassword: '' })
      setTimeout(() => {
        setIsChangingPassword(false)
        setNotice('')
      }, 1500)
    } catch (err) {
      setError(err.message || 'PIN update failed. Please check your current PIN and try again.')
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

    setLoadingProfile(true)
    try {
      const { user, customer } = await fetchProfile(session)
      console.log('Profile component loaded profile data:', { user, customer })
      setProfile({
        fullName: customer?.full_name || user.user_metadata?.full_name || session.fullName || 'User',
        contact: customer?.email || user.email || session.email || '',
        userId: customer?.customer_id || user.id || session.userId,
        coinUserId: customer?.user_id || '',
      })
    } catch (err) {
      console.error('Profile component fetchProfile error:', err)
      setMessage(err.message || 'Showing cached profile only.')
    } finally {
      setLoadingProfile(false)
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

        {/* User ID Badge */}
        {loadingProfile ? (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>Loading User ID...</div>
        ) : profile.coinUserId ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '10px',
            padding: '6px 14px',
            background: 'var(--dark)',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: '700',
            color: 'var(--label-green)',
            letterSpacing: '0.15em',
            fontFamily: 'monospace',
          }}>
            <span style={{ opacity: 0.6, fontSize: '11px', fontWeight: 400, letterSpacing: 0 }}>User ID</span>
            {profile.coinUserId}
          </div>
        ) : (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#aaa' }}>No User ID assigned</div>
        )}
      </section>

      {message && <p className="alert">{message}</p>}

      {/* Change PIN Section */}
      {!isChangingPassword ? (
        <section
          className="xml-list-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setIsChangingPassword(true)}
        >
          <span>🔑</span>
          <p>Change PIN</p>
          <b>›</b>
        </section>
      ) : (
        <form className="form-stack" onSubmit={handleChangePassword} style={{ marginTop: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px 0' }}>Change PIN</h2>
          <p style={{ fontSize: '12px', color: '#888', margin: '0 0 16px 0' }}>
            Your 6-digit PIN is used to log in and verify locker returns.
          </p>

          <label className="xml-field">
            <span>Current 6-Digit PIN</span>
            <input
              name="currentPassword"
              type="password"
              inputMode="numeric"
              maxLength="6"
              value={passwordForm.currentPassword}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setPasswordForm((current) => ({ ...current, currentPassword: val }))
              }}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </label>

          <label className="xml-field">
            <span>New 6-Digit PIN</span>
            <input
              name="password"
              type="password"
              inputMode="numeric"
              maxLength="6"
              value={passwordForm.password}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setPasswordForm((current) => ({ ...current, password: val }))
              }}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>

          <label className="xml-field">
            <span>Confirm New PIN</span>
            <input
              name="confirmPassword"
              type="password"
              inputMode="numeric"
              maxLength="6"
              value={passwordForm.confirmPassword}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setPasswordForm((current) => ({ ...current, confirmPassword: val }))
              }}
              placeholder="••••••"
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
                setPasswordForm({ currentPassword: '', password: '', confirmPassword: '' })
                setError('')
                setNotice('')
              }}
            >
              Cancel
            </button>
            <button className="primary-button xml-black-button" type="submit" disabled={loadingPassword}>
              {loadingPassword ? 'Saving...' : 'Save PIN'}
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
