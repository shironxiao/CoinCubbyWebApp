/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchProfile, logout, privateKeyFor } from '../lib/supabase'

export default function Profile({ session, onLogout, onNavigate }) {
  const [profile, setProfile] = useState({
    fullName: session?.fullName || '',
    contact: session?.email || '',
    userId: session?.userId || '',
  })
  const [message, setMessage] = useState('')

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
        contact: customer?.contact_number || customer?.email || user.email || session.email || '',
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
        <p>Your Private Key</p>
        <strong>{privateKeyFor(profile.userId)}</strong>
        <small>Use this key for quick locker access</small>
      </section>

      <section className="xml-list-row">
        <span>▣</span>
        <p>Change Private Key</p>
        <b>›</b>
      </section>

      <button className="danger-button xml-black-button" type="button" onClick={handleSignOut}>
        Sign Out
      </button>
    </main>
  )
}
