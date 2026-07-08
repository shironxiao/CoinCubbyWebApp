import { useState } from 'react'
import logo from '../assets/coin_logo.png'

export default function WelcomeIntro({ onLanguageSelect }) {
  const [selected, setSelected] = useState('en')

  function handleProceed() {
    onLanguageSelect(selected)
  }

  return (
    <main className="auth-page android-auth intro-page">
      <section className="auth-panel xml-register-panel intro-panel-card">
        <div className="intro-header">
          <img className="intro-logo" src={logo} alt="CoinCubby Logo" />
          <h1 className="intro-title">CoinCubby</h1>
          <p className="intro-tagline">
            Smart & Secure Public Lockers
            <br />
            <span style={{ fontSize: '14px', opacity: 0.8, display: 'block', marginTop: '6px' }}>
              Mabilis at Ligtas na Locker para sa Lahat
            </span>
          </p>
        </div>

        <div className="intro-body">
          <h2 className="intro-sub-title">Select Wika / Language</h2>
          <p className="intro-instructions">
            Choose a language to start using the app.
            <br />
            Pumili ng wika upang magpatuloy.
          </p>

          <div className="lang-button-group">
            <button
              type="button"
              className={`lang-select-btn ${selected === 'en' ? 'active' : ''}`}
              onClick={() => setSelected('en')}
            >
              <span className="lang-flag">🇺🇸</span>
              <span className="lang-name">English</span>
            </button>

            <button
              type="button"
              className={`lang-select-btn ${selected === 'tl' ? 'active' : ''}`}
              onClick={() => setSelected('tl')}
            >
              <span className="lang-flag">🇵🇭</span>
              <span className="lang-name">Tagalog</span>
            </button>
          </div>

          <button
            className="primary-button xml-black-button intro-action-btn"
            type="button"
            onClick={handleProceed}
          >
            {selected === 'en' ? 'Get Started' : 'Magsimula'}
          </button>
        </div>
      </section>
    </main>
  )
}
