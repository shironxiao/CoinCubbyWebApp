import { useCallback, useEffect, useState } from 'react'
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
import {
  clearSession,
  getSession,
  validateSession,
  fetchLockers,
  fetchModules,
  fetchRentalHistory,
  fetchActiveRentals,
  fetchRatesMap,
  getOrCreateWallet,
  mapRental,
  mapHistory,
} from './lib/supabase'

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

  const [walletBalance, setWalletBalance] = useState(50)
  const [activeRentals, setActiveRentals] = useState([])
  const [rentalHistory, setRentalHistory] = useState([])
  const [lockers, setLockers] = useState([])
  const [modules, setModules] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [ratesMap, setRatesMap] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  // True while we're verifying the stored session token on first load
  const [validating, setValidating] = useState(() => Boolean(getSession()))

  // On mount: verify the stored session token is still valid with Supabase.
  // If expired or invalid, clear it and force the login page.
  // We block the entire page render (show a spinner) until this resolves
  // so there is zero flash of the home page for users with stale sessions.
  useEffect(() => {
    const storedSession = getSession()
    if (!storedSession) {
      setValidating(false)
      return
    }
    validateSession(storedSession).then((valid) => {
      if (!valid) {
        setSession(null)
        navigate('login')
      }
      setValidating(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch static data (modules and rates) on mount or session change
  useEffect(() => {
    async function initStatic() {
      try {
        const mods = await fetchModules()
        setModules(mods || [])
        if (mods?.length) {
          setSelectedModuleId(String(mods[0].module_id))
        }
        const rates = await fetchRatesMap()
        setRatesMap(rates)
      } catch (err) {
        console.error('Failed to load static modules/rates:', err)
      }
    }
    initStatic()
  }, [])

  // Sync wallet balance to states when session is loaded initially
  useEffect(() => {
    if (session?.userId) {
      getOrCreateWallet(session).then((val) => {
        if (val !== null) setWalletBalance(val)
      })
    }
  }, [session])

  const refreshAllData = useCallback(async (showLoading = false) => {
    if (!session?.userId) return

    if (showLoading) {
      setLoadingData(true)
    }

    try {
      const [bal, activeRows, allLockers, historyRows] = await Promise.all([
        getOrCreateWallet(session),
        fetchActiveRentals(session.userId, session.accessToken),
        fetchLockers(),
        fetchRentalHistory(session.userId, session.accessToken),
      ])

      if (bal !== null) {
        setWalletBalance(bal)
      }
      setActiveRentals((activeRows || []).map(mapRental))
      setLockers(allLockers || [])
      setRentalHistory((historyRows || []).map(mapHistory))
    } catch (err) {
      console.error('Error syncing app data:', err)
    } finally {
      if (showLoading) {
        setLoadingData(false)
      }
    }
  }, [session])

  // Setup periodic polling interval
  useEffect(() => {
    if (!session?.userId) return

    // Run initial full fetch with loading indicator
    refreshAllData(true)

    const interval = setInterval(() => {
      refreshAllData(false)
    }, 4000)

    return () => clearInterval(interval)
  }, [session?.userId, refreshAllData])

  // Clear states when user logs out
  useEffect(() => {
    if (!session) {
      setWalletBalance(50)
      setActiveRentals([])
      setRentalHistory([])
      setLockers([])
    }
  }, [session])

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

    if (page === 'rent') {
      return (
        <Rent
          session={session}
          addNotification={addNotification}
          activeRentals={activeRentals}
          walletBalance={walletBalance}
          loadingData={loadingData}
          refreshAllData={refreshAllData}
        />
      )
    }
    if (page === 'history') {
      return (
        <History
          session={session}
          rentalHistory={rentalHistory}
          loadingData={loadingData}
          refreshAllData={refreshAllData}
        />
      )
    }
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

    return (
      <Home
        session={session}
        onNavigate={navigate}
        addNotification={addNotification}
        modules={modules}
        selectedModuleId={selectedModuleId}
        setSelectedModuleId={setSelectedModuleId}
        lockers={lockers}
        walletBalance={walletBalance}
        activeRentals={activeRentals}
        ratesMap={ratesMap}
        loadingData={loadingData}
        refreshAllData={refreshAllData}
      />
    )
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

      <div className="content-shell">
        {validating ? (
          <div className="session-loading">
            <div className="session-loading-spinner" />
          </div>
        ) : renderPage()}
      </div>

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

