import { useState } from 'react'
import logo from '../assets/coin_logo.png'

function FlagUS() {
  return (
    <svg className="lang-flag-svg" viewBox="0 0 32 24" width="28" height="21" style={{ borderRadius: '4px', overflow: 'hidden', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
      {/* Stripes: Red background with 6 white stripes */}
      <rect width="32" height="24" fill="#b22234" />
      <rect y="1.85" width="32" height="1.85" fill="#ffffff" />
      <rect y="5.54" width="32" height="1.85" fill="#ffffff" />
      <rect y="9.23" width="32" height="1.85" fill="#ffffff" />
      <rect y="12.92" width="32" height="1.85" fill="#ffffff" />
      <rect y="16.61" width="32" height="1.85" fill="#ffffff" />
      <rect y="20.3" width="32" height="1.85" fill="#ffffff" />
      {/* Blue Canton */}
      <rect width="14" height="13" fill="#3c3b6e" />
      {/* Stars representation */}
      <g fill="#ffffff">
        <circle cx="2.5" cy="2.5" r="0.7" /><circle cx="5" cy="2.5" r="0.7" /><circle cx="7.5" cy="2.5" r="0.7" /><circle cx="10" cy="2.5" r="0.7" /><circle cx="12" cy="2.5" r="0.7" />
        <circle cx="3.75" cy="4.5" r="0.7" /><circle cx="6.25" cy="4.5" r="0.7" /><circle cx="8.75" cy="4.5" r="0.7" /><circle cx="11.25" cy="4.5" r="0.7" />
        <circle cx="2.5" cy="6.5" r="0.7" /><circle cx="5" cy="6.5" r="0.7" /><circle cx="7.5" cy="6.5" r="0.7" /><circle cx="10" cy="6.5" r="0.7" /><circle cx="12" cy="6.5" r="0.7" />
        <circle cx="3.75" cy="8.5" r="0.7" /><circle cx="6.25" cy="8.5" r="0.7" /><circle cx="8.75" cy="8.5" r="0.7" /><circle cx="11.25" cy="8.5" r="0.7" />
        <circle cx="2.5" cy="10.5" r="0.7" /><circle cx="5" cy="10.5" r="0.7" /><circle cx="7.5" cy="10.5" r="0.7" /><circle cx="10" cy="10.5" r="0.7" /><circle cx="12" cy="10.5" r="0.7" />
      </g>
    </svg>
  )
}

function FlagPH() {
  return (
    <svg className="lang-flag-svg" viewBox="0 0 32 24" width="28" height="21" style={{ borderRadius: '4px', overflow: 'hidden', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
      {/* Top Blue */}
      <rect width="32" height="12" fill="#0038a8" />
      {/* Bottom Red */}
      <rect y="12" width="32" height="12" fill="#ce1126" />
      {/* White Equilateral Triangle */}
      <polygon points="0,0 16,12 0,24" fill="#ffffff" />
      {/* Golden Sun */}
      <circle cx="5.5" cy="12" r="2.5" fill="#fcd116" />
      <g stroke="#fcd116" strokeWidth="0.9" strokeLinecap="round">
        <line x1="5.5" y1="8.5" x2="5.5" y2="7.5" />
        <line x1="5.5" y1="15.5" x2="5.5" y2="16.5" />
        <line x1="2" y1="12" x2="1" y2="12" />
        <line x1="9" y1="12" x2="10" y2="12" />
        <line x1="3" y1="9.5" x2="2.3" y2="8.8" />
        <line x1="8" y1="14.5" x2="8.7" y2="15.2" />
        <line x1="3" y1="14.5" x2="2.3" y2="15.2" />
        <line x1="8" y1="9.5" x2="8.7" y2="8.8" />
      </g>
      {/* 3 Stars */}
      <circle cx="2.2" cy="3.5" r="0.9" fill="#fcd116" />
      <circle cx="2.2" cy="20.5" r="0.9" fill="#fcd116" />
      <circle cx="13" cy="12" r="0.9" fill="#fcd116" />
    </svg>
  )
}

function ShieldLockIcon() {
  return (
    <svg className="shield-lock-icon" viewBox="0 0 100 100" width="80" height="80">
      {/* Shield Outline matching user mockup */}
      <path
        d="M50 14 C65 14, 84 20, 87 31 C89 54, 82 76, 50 91 C18 76, 11 54, 13 31 C16 20, 35 14, 50 14 Z"
        fill="rgba(46, 204, 113, 0.08)"
        stroke="#2ecc71"
        strokeWidth="4.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Padlock Shackle */}
      <path
        d="M39 46 V37 C39 30.5 44 25.5 50 25.5 C56 25.5 61 30.5 61 37 V46"
        fill="none"
        stroke="#2ecc71"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Padlock Body */}
      <rect x="32" y="44" width="36" height="28" rx="6" fill="#2ecc71" />
      {/* Keyhole */}
      <circle cx="50" cy="54" r="3.2" fill="#ffffff" />
      <path d="M48.2 54 L47.4 63 A 1 1 0 0 0 48.4 64 H51.6 A 1 1 0 0 0 52.6 63 L51.8 54 Z" fill="#ffffff" />
    </svg>
  )
}

export default function WelcomeIntro({ onLanguageSelect }) {
  const [step, setStep] = useState('language') // 'language' | 'tutorial'
  const [selectedLang, setSelectedLang] = useState('en')
  const [slideIndex, setSlideIndex] = useState(0)

  const slides = [
    // ── 0. Welcome ──────────────────────────────────────────────────────────
    {
      titleEn: "Welcome to CoinCubby",
      titleTl: "Maligayang Pagdating sa CoinCubby",
      descEn:  "Your smart, secure, coin-operated public locker system. Here's how to use the kiosk in just a few steps.",
      descTl:  "Ang iyong matalino at ligtas na coin-operated locker system. Narito ang paraan ng paggamit ng kiosk sa ilang hakbang.",
      visual: (
        <div className="tutorial-visual welcome-visual">
          <img className="intro-logo pulse-logo" src={logo} alt="CoinCubby Logo" />
          <div className="coin-drop-animation">
            <span className="coin">🪙</span>
          </div>
        </div>
      ),
    },

    // ── 1. Enter User ID ─────────────────────────────────────────────────────
    {
      titleEn: "Step 1 — Enter Your User ID",
      titleTl: "Hakbang 1 — Ilagay ang Iyong User ID",
      descEn:  "At the kiosk, type your 6-digit User ID. You can find this ID on the Profile screen of this app.",
      descTl:  "Sa kiosk, ilagay ang iyong 6-digit User ID. Makikita mo ito sa Profile screen ng app na ito.",
      visual: (
        <div className="tutorial-visual kiosk-login-visual">
          <div className="kiosk-screen-mock">
            <div className="kiosk-field-label">User ID</div>
            <div className="kiosk-input-row">
              {['1','2','3','4','5','6'].map((d,i) => (
                <span key={i} className={`kiosk-digit ${i < 4 ? 'filled' : 'cursor-blink'}`}>{i < 4 ? d : ''}</span>
              ))}
            </div>
            <div className="kiosk-field-hint">Your 6-digit profile ID</div>
          </div>
        </div>
      ),
    },

    // ── 2. Enter PIN ─────────────────────────────────────────────────────────
    {
      titleEn: "Step 2 — Enter Your 6-Digit PIN",
      titleTl: "Hakbang 2 — Ilagay ang Iyong 6-Digit PIN",
      descEn:  "After your User ID, enter your 6-digit account PIN. This is the same password you use in this app.",
      descTl:  "Pagkatapos ng User ID, ilagay ang iyong 6-digit PIN. Ito ang parehong password na ginagamit mo sa app na ito.",
      visual: (
        <div className="tutorial-visual pin-visual">
          <div className="pin-visual-card" style={{ minWidth: 180 }}>
            <div className="visual-pin-dots">
              <span>●</span><span>●</span><span>●</span>
              <span>●</span><span>●</span><span className="pin-dot-empty">○</span>
            </div>
            <div className="pin-visual-badge">6-Digit Account PIN</div>
          </div>
        </div>
      ),
    },

    // ── 3. Select a Locker ───────────────────────────────────────────────────
    {
      titleEn: "Step 3 — Select a Locker",
      titleTl: "Hakbang 3 — Pumili ng Locker",
      descEn:  "The kiosk shows all available lockers. Tap a green locker to select it. Green means it is empty and ready.",
      descTl:  "Ipinapakita ng kiosk ang lahat ng bakanteng locker. I-tap ang berdeng locker para piliin ito. Berde ang bakante.",
      visual: (
        <div className="tutorial-visual grid-visual">
          <div className="mini-grid">
            <div className="mini-tile occupied">L-01<br/><span>Occupied</span></div>
            <div className="mini-tile available pulse-tile">L-02<br/><span>Available</span></div>
            <div className="mini-tile occupied">L-03<br/><span>Occupied</span></div>
          </div>
        </div>
      ),
    },

    // ── 4. Choose Rental Type ────────────────────────────────────────────────
    {
      titleEn: "Step 4 — Choose Rental Type",
      titleTl: "Hakbang 4 — Piliin ang Uri ng Renta",
      descEn:  "Fixed Duration: pay upfront for a set number of hours. Open Time: the timer runs and you pay when you return the locker.",
      descTl:  "Fixed Duration: bayad muna para sa takdang oras. Open Time: tatakbo ang timer at babayaran mo kapag ibinalik mo na ang locker.",
      visual: (
        <div className="tutorial-visual type-visual">
          <div className="mini-types">
            <div className="mini-type-btn active">
              <strong>Fixed Duration</strong>
              <small>Pay Upfront</small>
            </div>
            <div className="mini-type-btn">
              <strong>Open Time</strong>
              <small>Pay on Return</small>
            </div>
          </div>
        </div>
      ),
    },

    // ── 5. Confirm Details ───────────────────────────────────────────────────
    {
      titleEn: "Step 5 — Confirm Your Details",
      titleTl: "Hakbang 5 — Kumpirmahin ang mga Detalye",
      descEn:  "Review your selected locker, rental type, duration, and total amount before you proceed. Tap Confirm when ready.",
      descTl:  "Suriin ang iyong piniling locker, uri ng renta, tagal, at kabuuang bayad bago magpatuloy. I-tap ang Kumpirmahin.",
      visual: (
        <div className="tutorial-visual confirm-visual">
          <div className="kiosk-confirm-card">
            <div className="kiosk-confirm-row"><span>Locker</span><strong>L-02</strong></div>
            <div className="kiosk-confirm-row"><span>Type</span><strong>Fixed</strong></div>
            <div className="kiosk-confirm-row"><span>Duration</span><strong>2 hrs</strong></div>
            <div className="kiosk-confirm-row total-row"><span>Total</span><strong>₱20.00</strong></div>
            <div className="kiosk-confirm-btn">Confirm ✓</div>
          </div>
        </div>
      ),
    },

    // ── 6. Pay at Device ─────────────────────────────────────────────────────
    {
      titleEn: "Step 6 — Pay at the Device",
      titleTl: "Hakbang 6 — Magbayad sa Device",
      descEn:  "For Fixed Duration, insert coins or bills into the coin slot until the total is reached. The locker will automatically open once fully paid.",
      descTl:  "Para sa Fixed Duration, ihulog ang barya o papel na pera sa coin slot hanggang maabot ang kabuuan. Awtomatikong magbubukas ang locker.",
      visual: (
        <div className="tutorial-visual pay-visual">
          <div className="kiosk-pay-mock">
            <div className="coin-slot-icon">🪙</div>
            <div className="pay-progress-bar">
              <div className="pay-progress-fill" style={{ width: '72%' }} />
            </div>
            <div className="pay-labels">
              <span>Inserted: ₱14</span>
              <span>Total: ₱20</span>
            </div>
          </div>
        </div>
      ),
    },

    // ── 7. Store & Lock ──────────────────────────────────────────────────────
    {
      titleEn: "Step 7 — Store & Lock Your Belongings",
      titleTl: "Hakbang 7 — Ilagay at I-lock ang Iyong mga Gamit",
      descEn:  "The locker door opens automatically. Place your items inside, then firmly close the door. It locks automatically — you're all set!",
      descTl:  "Awtomatikong magbubukas ang pinto ng locker. Ilagay ang iyong mga gamit, pagkatapos ay isara nang mahigpit ang pinto. Naka-lock na ito — tapos ka na!",
      visual: (
        <div className="tutorial-visual store-visual">
          <div className="shield-lock-container">
            <ShieldLockIcon />
            <div className="locker-done-label">
              <strong>{selectedLang === 'tl' ? 'Naka-lock ang Locker!' : 'Locker Locked!'}</strong>
              <small>{selectedLang === 'tl' ? 'Ligtas ang iyong mga gamit' : 'Your items are safe'}</small>
            </div>
          </div>
        </div>
      ),
    },
  ]

  function handleLangProceed() {
    setStep('tutorial')
    setSlideIndex(0)
  }

  function handleNext() {
    if (slideIndex < slides.length - 1) {
      setSlideIndex(slideIndex + 1)
    } else {
      // Last slide, complete onboarding
      onLanguageSelect(selectedLang)
    }
  }

  function handleBack() {
    if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1)
    } else {
      setStep('language')
    }
  }

  function handleSkip() {
    // Jump straight to login by finishing onboarding with currently selected lang
    onLanguageSelect(selectedLang)
  }

  const currentSlide = slides[slideIndex]

  if (step === 'language') {
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
                className={`lang-select-btn ${selectedLang === 'en' ? 'active' : ''}`}
                onClick={() => setSelectedLang('en')}
              >
                <span className="lang-flag">
                  <FlagUS />
                </span>
                <span className="lang-name">English</span>
              </button>

              <button
                type="button"
                className={`lang-select-btn ${selectedLang === 'tl' ? 'active' : ''}`}
                onClick={() => setSelectedLang('tl')}
              >
                <span className="lang-flag">
                  <FlagPH />
                </span>
                <span className="lang-name">Tagalog</span>
              </button>
            </div>

            <button
              className="primary-button xml-black-button intro-action-btn"
              type="button"
              onClick={handleLangProceed}
            >
              {selectedLang === 'en' ? 'Next' : 'Susunod'}
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page android-auth intro-page">
      <section className="auth-panel xml-register-panel intro-panel-card tutorial-panel">
        <div className="tutorial-header-bar">
          <button className="tutorial-back-btn" onClick={handleBack} aria-label="Back">
            ←
          </button>
          <button className="tutorial-skip-btn" onClick={handleSkip}>
            {selectedLang === 'en' ? 'Skip' : 'Laktawan'}
          </button>
        </div>

        <div className="tutorial-body">
          {currentSlide.visual}

          <h2 className="tutorial-slide-title">
            {selectedLang === 'en' ? currentSlide.titleEn : currentSlide.titleTl}
          </h2>
          
          <p className="tutorial-slide-desc">
            {selectedLang === 'en' ? currentSlide.descEn : currentSlide.descTl}
          </p>
        </div>

        <div className="tutorial-footer">
          <div className="tutorial-dots">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={`tutorial-dot ${idx === slideIndex ? 'active' : ''}`}
                onClick={() => setSlideIndex(idx)}
              />
            ))}
          </div>

          <button
            className="primary-button xml-black-button tutorial-action-btn"
            type="button"
            onClick={handleNext}
          >
            {slideIndex === slides.length - 1
              ? (selectedLang === 'en' ? 'Get Started' : 'Magsimula')
              : (selectedLang === 'en' ? 'Next' : 'Susunod')}
          </button>
        </div>
      </section>
    </main>
  )
}
