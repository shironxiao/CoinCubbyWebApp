/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import './App.css'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Register from './pages/Register'
import Rent from './pages/Rent'
import ResetPassword from './pages/ResetPassword'
import NotificationsDrawer from './components/NotificationsDrawer'
import {
  getBrowserNotificationStatus,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from './lib/browserNotifications'
import { clearSession, getSession } from './lib/supabase'

const protectedPages = ['home', 'rent', 'history', 'profile']

function pageFromHash() {
  return window.location.hash.replace('#/', '') || 'login'
}

function getRecoveryToken() {
  const hash = window.location.hash
  if (!hash.includes('access_token') || !hash.includes('type=recovery')) return null
  const params = new URLSearchParams(hash.replace('#', ''))
  return params.get('access_token') || null
}

export default function App() {
  const [session, setSession] = useState(() => getSession())
  const [page, setPage] = useState(() => pageFromHash())
  const [menuOpen, setMenuOpen] = useState(false)
  const [recoveryToken, setRecoveryToken] = useState(() => getRecoveryToken())
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [browserNotificationStatus, setBrowserNotificationStatus] = useState(() =>
    getBrowserNotificationStatus(),
  )

  const navItems = [
    ['home', 'Home'],
    ['rent', 'Rental'],
    ['history', 'History'],
    ['profile', 'Profile'],
  ]

  // Load user-specific notifications
  useEffect(() => {
    if (session?.userId) {
      try {
        const stored = localStorage.getItem(`coincubby.notifications.${session.userId}`)
        setNotifications(
          stored
            ? JSON.parse(stored)
            : [
                {
                  id: 'welcome',
                  title: 'Welcome to CoinCubby!',
                  content: 'You can now rent lockers, check your balance, and view transaction history.',
                  type: 'info',
                  timestamp: new Date().toISOString(),
                  isRead: false,
                },
              ]
        )
      } catch {
        setNotifications([])
      }
    } else {
      setNotifications([])
    }
  }, [session?.userId])

  // Save notifications to localStorage
  useEffect(() => {
    if (session?.userId) {
      localStorage.setItem(`coincubby.notifications.${session.userId}`, JSON.stringify(notifications))
    }
  }, [notifications, session?.userId])

  async function handleEnableBrowserNotifications() {
    const permission = await requestBrowserNotificationPermission()
    setBrowserNotificationStatus(permission)

    if (permission === 'granted') {
      addNotification({
        title: 'Locker Reminders Enabled',
        content: 'CoinCubby can now show locker reminders on this device.',
        type: 'info',
        showOnDevice: true,
      })
    }
  }

  function addNotification({ title, content, type, showOnDevice = true, tag, url }) {
    const newNotif = {
      id: Date.now().toString(),
      title,
      content,
      type,
      timestamp: new Date().toISOString(),
      isRead: false,
    }
    setNotifications((prev) => [newNotif, ...prev])

    if (showOnDevice) {
      showBrowserNotification({
        title,
        body: content,
        tag: tag || `coincubby-${type || 'notice'}`,
        url: url || (type === 'rental_end' ? '#/history' : '#/rent'),
      }).catch((err) => console.warn('Device notification failed:', err))
    }
  }

  function handleMarkAsRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }

  function handleMarkAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  function handleClearAll() {
    setNotifications([])
  }

  useEffect(() => {
    const onHashChange = () => {
      const token = getRecoveryToken()
      if (token) {
        setRecoveryToken(token)
      } else {
        setPage(pageFromHash())
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!session && !recoveryToken && protectedPages.includes(page)) {
      navigate('login')
    }
  }, [page, session, recoveryToken])

  function navigate(nextPage) {
    setRecoveryToken(null)
    window.location.hash = `/${nextPage}`
    setPage(nextPage)
    setMenuOpen(false)
  }

  function handleLogout() {
    clearSession()
    setSession(null)
  }

  function renderPage() {
    if (recoveryToken) {
      return <ResetPassword accessToken={recoveryToken} onNavigate={navigate} />
    }

    if (!session && page === 'register') return <Register onNavigate={navigate} />
    if (!session) return <Login onLogin={setSession} onNavigate={navigate} />

    if (page === 'rent') return <Rent session={session} addNotification={addNotification} />
    if (page === 'history') return <History session={session} />
    if (page === 'profile') {
      return (
        <Profile
          session={session}
          onLogout={handleLogout}
          onNavigate={navigate}
          addNotification={addNotification}
        />
      )
    }

    return <Home session={session} onNavigate={navigate} addNotification={addNotification} />
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="app-shell">
      {session && !recoveryToken && (
        <aside className={`sidebar ${menuOpen ? 'menu-open' : ''}`}>
          <div className="brand">
            <span>CC</span>
            <strong>CoinCubby</strong>
          </div>
          <div className="sidebar-controls">
            <button
              className={`notif-bell-button notif-permission-${browserNotificationStatus} ${unreadCount > 0 ? 'has-unread' : ''}`}
              type="button"
              aria-label="View notifications"
              onClick={() => setNotifOpen(true)}
            >
              {browserNotificationStatus === 'granted' ? (
                /* Bell with check — notifications enabled */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  <path className="bell-status-check" d="M8 12.5l2.5 2.5L16 9" strokeWidth="2.5" stroke="currentColor"></path>
                </svg>
              ) : browserNotificationStatus === 'denied' ? (
                /* Bell with slash — permission blocked */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" opacity="0.45"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" opacity="0.45"></path>
                  <line className="bell-status-slash" x1="4" y1="4" x2="20" y2="20" strokeWidth="2.5" stroke="currentColor"></line>
                </svg>
              ) : (
                /* Bell outline — default / not yet asked */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              )}
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>

            <button
              className="hamburger-button"
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
          <nav>
            {navItems.map(([key, label]) => (
              <button
                key={key}
                className={page === key ? 'active' : ''}
                type="button"
                onClick={() => navigate(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>
      )}

      <div className="content-shell">{renderPage()}</div>

      <NotificationsDrawer
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAll}
        browserNotificationStatus={browserNotificationStatus}
        onEnableBrowserNotifications={handleEnableBrowserNotifications}
        onNavigate={(path) => {
          navigate(path)
          setNotifOpen(false)
        }}
      />
    </div>
  )
}

