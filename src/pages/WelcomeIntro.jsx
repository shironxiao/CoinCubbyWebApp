import { useState } from 'react'
import logo from '../assets/coin_logo.png'

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
          <div className="locker-door-mock">
            <div className="locker-body">
              <div className="locker-handle" />
              <div className="locker-status-light locked" />
            </div>
            <div className="locker-done-label">
              <span className="success-icon">✓</span>
              <strong>Locker Locked!</strong>
              <small>Your items are safe</small>
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
                <span className="lang-flag">🇺🇸</span>
                <span className="lang-name">English</span>
              </button>

              <button
                type="button"
                className={`lang-select-btn ${selectedLang === 'tl' ? 'active' : ''}`}
                onClick={() => setSelectedLang('tl')}
              >
                <span className="lang-flag">🇵🇭</span>
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
