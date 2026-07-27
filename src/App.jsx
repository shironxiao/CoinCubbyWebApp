/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Register from './pages/Register'
import Rent from './pages/Rent'
import ResetPassword from './pages/ResetPassword'
import WelcomeIntro from './pages/WelcomeIntro'
import Feedback from './pages/Feedback'
import NotificationsDrawer from './components/NotificationsDrawer'
import { translations } from './lib/translations'
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

const protectedPages = ['home', 'rent', 'history', 'profile', 'feedback']

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

  // Language localization states
  const [lang, setLang] = useState(() => localStorage.getItem('coincubby.lang') || 'en')
  const [introSeen, setIntroSeen] = useState(() => localStorage.getItem('coincubby.introSeen') === 'true')

  function t(key) {
    return translations[lang]?.[key] || translations['en']?.[key] || key
  }

  function handleLanguageSelect(selectedLang) {
    setLang(selectedLang)
    localStorage.setItem('coincubby.lang', selectedLang)
    setIntroSeen(true)
    localStorage.setItem('coincubby.introSeen', 'true')
  }

  function changeLanguage(newLang) {
    setLang(newLang)
    localStorage.setItem('coincubby.lang', newLang)
  }

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
    // If onboarding hasn't been completed, don't validate yet
    if (!localStorage.getItem('coincubby.introSeen')) {
      setValidating(false)
      return
    }
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
    if (showLoading) {
      setLoadingData(true)
    }

    try {
      const lockersPromise = fetchLockers()
      const modulesPromise = fetchModules()
      const ratesPromise = fetchRatesMap()

      const userPromises = session?.userId
        ? Promise.all([
            getOrCreateWallet(session),
            fetchActiveRentals(session.userId, session.accessToken),
            fetchRentalHistory(session.userId, session.accessToken),
          ])
        : Promise.resolve([null, [], []])

      const [allLockers, allModules, rates, [bal, activeRows, historyRows]] = await Promise.all([
        lockersPromise,
        modulesPromise,
        ratesPromise,
        userPromises,
      ])

      setLockers(allLockers || [])

      if (allModules?.length) {
        setModules(allModules)
        setSelectedModuleId((prev) => {
          if (!prev || !allModules.some((m) => String(m.module_id) === String(prev))) {
            return String(allModules[0].module_id)
          }
          return prev
        })
      }

      if (rates) {
        setRatesMap(rates)
      }

      if (session?.userId) {
        if (bal !== null) {
          setWalletBalance(bal)
        }
        setActiveRentals((activeRows || []).map(mapRental))
        setRentalHistory((historyRows || []).map(mapHistory))
      }
    } catch (err) {
      console.error('Error syncing app data:', err)
    } finally {
      if (showLoading) {
        setLoadingData(false)
      }
    }
  }, [session])

  // Setup periodic AJAX background sync (every 2.5s) & instant tab focus listener
  useEffect(() => {
    // Run initial fetch
    refreshAllData(true)

    // Poll silently every 2.5 seconds across all sections
    const interval = setInterval(() => {
      refreshAllData(false)
    }, 2500)

    // Trigger immediate sync when browser tab/window gains focus or becomes visible
    function handleVisibilityOrFocus() {
      if (document.visibilityState === 'visible') {
        refreshAllData(false)
      }
    }

    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
    }
  }, [refreshAllData])

  // Clear states when user logs out
  useEffect(() => {
    if (!session) {
      setWalletBalance(50)
      setActiveRentals([])
      setRentalHistory([])
      setLockers([])
    }
  }, [session])

  // Detect when an active rental is terminated because a locker goes into Maintenance
  const prevActiveRentalsRef = useRef([])
  useEffect(() => {
    if (!session?.userId) {
      prevActiveRentalsRef.current = []
      return
    }

    const prevActive = prevActiveRentalsRef.current

    if (prevActive.length > 0) {
      const currentActiveIds = new Set(activeRentals.map((r) => r.transactionId))

      for (const oldRental of prevActive) {
        if (!currentActiveIds.has(oldRental.transactionId)) {
          // Rental disappeared. Check if the locker status is now Maintenance
          const locker = lockers.find((l) => String(l.locker_id) === String(oldRental.lockerId))
          if (locker && locker.status === 'Maintenance') {
            const title = lang === 'tl' ? 'Locker nasa Maintenance' : 'Locker Under Maintenance'
            const content = lang === 'tl'
              ? `Ang Locker ${oldRental.lockerNumber} ay inilagay sa maintenance. Ang natitirang balanse ay ibinalik sa iyong wallet.`
              : `Locker ${oldRental.lockerNumber} has been placed under maintenance. Your remaining balance has been refunded to your wallet.`

            addNotification({
              title,
              content,
              type: 'info',
              showOnDevice: true,
            })
          } else {
            // Normal retrieval/completion — notify the user about their digital receipt
            const title = lang === 'tl'
              ? `📄 Resibo handa para sa Locker ${oldRental.lockerNumber}`
              : `📄 Receipt ready for Locker ${oldRental.lockerNumber}`
            const content = lang === 'tl'
              ? 'Pumunta sa Kasaysayan at piliin ang natapos na renta upang tingnan ang iyong Resibo ng Renta o Pagkuha — kasama ang detalye ng bayad at refund.'
              : 'Go to History and tap the completed rental to view your Rental or Retrieval Receipt — including payment details and any refunds.'

            addNotification({
              title,
              content,
              type: 'success',
              showOnDevice: true,
              url: '#/history',
            })
          }
        }
      }
    }

    prevActiveRentalsRef.current = activeRentals
  }, [activeRentals, lockers, lang, session?.userId])

  const navItems = [
    ['home', t('home')],
    ['rent', t('rental')],
    ['history', t('history')],
    ['feedback', t('feedback')],
    ['profile', t('profile')],
  ]

  // Load user-specific notifications
  useEffect(() => {
    if (session?.userId) {
      try {
        const stored = localStorage.getItem(`coincubby.notifications.${session.userId}`)
        const receiptNotif = {
          id: 'receipt-info',
          title: lang === 'tl' ? '📄 Makita ang iyong Resibo' : '📄 View Your Digital Receipt',
          content: lang === 'tl'
            ? 'Sa Kasaysayan, pindutin ang isang kumpleto na renta at piliin ang "Tingnan ang Resibo". Maaari kang lumipat sa pagitan ng Resibo ng Renta at Pagkuha — kasama ang detalye ng cash, wallet, at refund.'
            : 'In History, tap any completed rental and select "View Receipt". You can switch between the Rental and Retrieval receipts — including cash/wallet payment details and any refunds.',
          type: 'info',
          url: '#/history',
          timestamp: new Date().toISOString(),
          isRead: false,
        }
        if (stored) {
          const parsed = JSON.parse(stored)
          // Inject the receipt-info notification if it doesn't already exist
          const hasReceiptNotif = parsed.some((n) => n.id === 'receipt-info')
          setNotifications(hasReceiptNotif ? parsed : [receiptNotif, ...parsed])
        } else {
          setNotifications([
            {
              id: 'welcome',
              title: lang === 'tl' ? 'Maligayang Pagdating sa CoinCubby!' : 'Welcome to CoinCubby!',
              content: lang === 'tl'
                ? 'Maaari ka nang mag-rent ng locker, tingnan ang iyong balanse, at suriin ang kasaysayan ng transaksyon.'
                : 'You can now rent lockers, check your balance, and view transaction history.',
              type: 'info',
              timestamp: new Date().toISOString(),
              isRead: false,
            },
            receiptNotif,
          ])
        }
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
    if (!introSeen) {
      return <WelcomeIntro onLanguageSelect={handleLanguageSelect} />
    }

    if (recoveryToken) {
      return <ResetPassword accessToken={recoveryToken} onNavigate={navigate} t={t} lang={lang} />
    }

    if (!session && page === 'register') return <Register onNavigate={navigate} t={t} lang={lang} />
    if (!session) return <Login onLogin={setSession} onNavigate={navigate} t={t} lang={lang} />

    if (page === 'rent') {
      return (
        <Rent
          session={session}
          addNotification={addNotification}
          activeRentals={activeRentals}
          walletBalance={walletBalance}
          loadingData={loadingData}
          refreshAllData={refreshAllData}
          t={t}
          lang={lang}
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
          t={t}
          lang={lang}
          onNavigate={navigate}
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
          t={t}
          lang={lang}
          onLanguageChange={changeLanguage}
          onShowTutorial={() => setIntroSeen(false)}
        />
      )
    }
    if (page === 'feedback') {
      return (
        <Feedback
          session={session}
          rentalHistory={rentalHistory}
          loadingData={loadingData}
          t={t}
          lang={lang}
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
        t={t}
        lang={lang}
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
        lang={lang}
        t={t}
        onNavigate={(path) => {
          navigate(path)
          setNotifOpen(false)
        }}
      />
    </div>
  )
}

