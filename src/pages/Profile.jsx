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

  async function handleVerifyReveal(event) {
    event.preventDefault()
    setRevealError('')
    if (!revealPassword) return setRevealError('Password is required.')

    setLoadingPasskey(true)
    try {
      await verifyUserPassword(profile.contact, revealPassword)
      const pin = await recoverPasskey(profile.passkey)
      setRevealedPin(pin)
      setIsVerified(true)
      setIsVerifyingReveal(false)
      setRevealPassword('')
    } catch (err) {
      setRevealError(err.message || 'Incorrect password. Please try again.')
    } finally {
      setLoadingPasskey(false)
    }
  }

  async function handleSetOrChangePasskey(event) {
    event.preventDefault()
    setPasskeyError('')
    setPasskeyNotice('')

    if (!newPasskey) return setPasskeyError('PassKey PIN is required.')
    if (newPasskey.length !== 4) return setPasskeyError('PassKey must be exactly 4 digits.')
    if (!confirmPassword) return setPasskeyError('Account password is required.')

    setLoadingPasskey(true)
    try {
      // 1. Verify account password
      await verifyUserPassword(profile.contact, confirmPassword)

      // 2. Check if the passkey is taken
      const taken = await isPasskeyTaken(newPasskey)
      if (taken) {
        throw new Error('This PassKey PIN is already taken. Please choose a different 4-digit PIN.')
      }

      // 3. Update the passkey in database
      await updatePasskey(profile.userId, newPasskey, session?.accessToken)

      const hashed = await hashPasskey(newPasskey)
      setProfile((current) => ({ ...current, passkey: hashed }))
      setRevealedPin(newPasskey)
      setPasskeyNotice(profile.passkey ? 'PassKey changed successfully.' : 'PassKey set successfully.')
      setNewPasskey('')
      setConfirmPassword('')
      setIsChangingPasskey(false)
      setIsVerified(true) // Show the newly set/updated passkey

      if (addNotification) {
        addNotification({
          title: 'PassKey Updated',
          content: 'Your transaction-link PassKey PIN was updated successfully.',
          type: 'security',
        })
      }

      setTimeout(() => setPasskeyNotice(''), 2000)
    } catch (err) {
      setPasskeyError(err.message || 'Failed to update PassKey. Please try again.')
    } finally {
      setLoadingPasskey(false)
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

      {message && <p className="alert">{message}</p>}

      <section className="info-panel passkey-panel" style={{ padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔑</span> PassKey (Kiosk Link)
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>
          Your PassKey is a 4-digit PIN used to link your physical locker transactions at the kiosk to your web app account.
        </p>

        {loadingProfile ? (
          <div className="xml-loading" style={{ minHeight: '80px', padding: '10px 0' }}>
            <span></span>
            <p>Checking PassKey status...</p>
          </div>
        ) : !profile.passkey ? (
          /* Case 1: Existing User setting their PassKey for the first time */
          <form className="form-stack" onSubmit={handleSetOrChangePasskey}>
            <p className="notice-sub" style={{ fontSize: '0.85rem', color: '#ffb300', marginBottom: '12px' }}>
              ⚠️ You don't have a PassKey set yet. Please choose a 4-digit PIN below.
            </p>
            <label className="xml-field">
              <span>Choose 4-Digit PassKey PIN</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                value={newPasskey}
                onChange={(e) => setNewPasskey(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                disabled={loadingPasskey}
                required
              />
            </label>
            <label className="xml-field">
              <span>Account Password (To Verify)</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loadingPasskey}
                required
              />
            </label>

            {passkeyError && <p className="alert" style={{ marginTop: '8px' }}>{passkeyError}</p>}
            {passkeyNotice && <p className="success" style={{ marginTop: '8px' }}>{passkeyNotice}</p>}

            <button className="primary-button xml-black-button" type="submit" disabled={loadingPasskey} style={{ marginTop: '12px', width: '100%' }}>
              {loadingPasskey ? 'Saving...' : 'Set PassKey'}
            </button>
          </form>
        ) : (
          /* Case 2: PassKey exists */
          <div>
            {!isVerified ? (
              /* PassKey is Hidden/Locked */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.25rem', letterSpacing: '0.4em', color: '#666', fontWeight: 'bold' }}>••••</span>
                  <span style={{ background: '#ff3b30', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', color: '#fff' }}>Locked</span>
                </div>

                {!isVerifyingReveal ? (
                  <button className="secondary-button" type="button" onClick={() => setIsVerifyingReveal(true)} style={{ width: '100%' }}>
                    Reveal PassKey
                  </button>
                ) : (
                  <form onSubmit={handleVerifyReveal} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                    <label className="xml-field">
                      <span>Enter Account Password</span>
                      <input
                        type="password"
                        value={revealPassword}
                        onChange={(e) => setRevealPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loadingPasskey}
                        autoFocus
                        required
                      />
                    </label>
                    {revealError && <p className="alert">{revealError}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setIsVerifyingReveal(false)
                          setRevealPassword('')
                          setRevealError('')
                        }}
                        disabled={loadingPasskey}
                      >
                        Cancel
                      </button>
                      <button className="primary-button xml-black-button" type="submit" disabled={loadingPasskey}>
                        {loadingPasskey ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* PassKey is Revealed */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', marginBottom: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <span style={{ fontSize: '1.4rem', letterSpacing: '0.4em', color: '#4cd964', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {(revealedPin || '••••').split('').join(' ')}
                  </span>
                  <span style={{ background: '#4cd964', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', color: '#000' }}>Active</span>
                </div>

                {!isChangingPasskey ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button className="secondary-button" type="button" onClick={() => {
                      setIsVerified(false)
                      setRevealedPin('')
                    }}>
                      Hide PIN
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setIsChangingPasskey(true)}>
                      Change PassKey
                    </button>
                  </div>
                ) : (
                  <form className="form-stack" onSubmit={handleSetOrChangePasskey} style={{ marginTop: '12px' }}>
                    <label className="xml-field">
                      <span>New 4-Digit PassKey PIN</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength="4"
                        value={newPasskey}
                        onChange={(e) => setNewPasskey(e.target.value.replace(/\D/g, ''))}
                        placeholder="1234"
                        disabled={loadingPasskey}
                        required
                      />
                    </label>
                    <label className="xml-field">
                      <span>Confirm Account Password</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loadingPasskey}
                        required
                      />
                    </label>

                    {passkeyError && <p className="alert">{passkeyError}</p>}
                    {passkeyNotice && <p className="success">{passkeyNotice}</p>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={loadingPasskey}
                        onClick={() => {
                          setIsChangingPasskey(false)
                          setNewPasskey('')
                          setConfirmPassword('')
                          setPasskeyError('')
                        }}
                      >
                        Cancel
                      </button>
                      <button className="primary-button xml-black-button" type="submit" disabled={loadingPasskey}>
                        {loadingPasskey ? 'Saving...' : 'Save PIN'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
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
