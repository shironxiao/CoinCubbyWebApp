import { useEffect, useState } from 'react'
import './App.css'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Register from './pages/Register'
import Rent from './pages/Rent'
import { clearSession, getSession } from './lib/supabase'

const protectedPages = ['home', 'rent', 'history', 'profile']

function pageFromHash() {
  return window.location.hash.replace('#/', '') || 'login'
}

export default function App() {
  const [session, setSession] = useState(() => getSession())
  const [page, setPage] = useState(() => pageFromHash())
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = [
    ['home', 'Home'],
    ['rent', 'My Rental'],
    ['history', 'History'],
    ['profile', 'Profile'],
  ]

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!session && protectedPages.includes(page)) {
      navigate('login')
    }
  }, [page, session])

  function navigate(nextPage) {
    window.location.hash = `/${nextPage}`
    setPage(nextPage)
    setMenuOpen(false)
  }

  function handleLogout() {
    clearSession()
    setSession(null)
  }

  function renderPage() {
    if (!session && page === 'register') return <Register onNavigate={navigate} />
    if (!session) return <Login onLogin={setSession} onNavigate={navigate} />

    if (page === 'rent') return <Rent session={session} />
    if (page === 'history') return <History session={session} />
    if (page === 'profile') {
      return <Profile session={session} onLogout={handleLogout} onNavigate={navigate} />
    }

    return <Home session={session} onNavigate={navigate} />
  }

  return (
    <div className="app-shell">
      {session && (
        <aside className={`sidebar ${menuOpen ? 'menu-open' : ''}`}>
          <div className="brand">
            <span>CC</span>
            <strong>CoinCubby</strong>
          </div>
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
    </div>
  )
}
