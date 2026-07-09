import { useState } from 'react'
import logo from '../assets/coin_logo.png'

export default function WelcomeIntro({ onLanguageSelect }) {
  const [step, setStep] = useState('language') // 'language' | 'tutorial'
  const [selectedLang, setSelectedLang] = useState('en')
  const [slideIndex, setSlideIndex] = useState(0)

  const slides = [
    {
      titleEn: "Welcome to CoinCubby",
      titleTl: "Maligayang Pagdating sa CoinCubby",
      descEn: "Your smart, secure, and easy-to-use coin-operated public locker system.",
      descTl: "Ang iyong matalino, ligtas, at madaling-gamiting locker na hulugan ng barya.",
      icon: "📦",
      visual: (
        <div className="tutorial-visual welcome-visual">
          <img className="intro-logo pulse-logo" src={logo} alt="CoinCubby Logo" />
          <div className="coin-drop-animation">
            <span className="coin">🪙</span>
          </div>
        </div>
      )
    },
    {
      titleEn: "1. Choose Your Locker",
      titleTl: "1. Pumili ng Iyong Locker",
      descEn: "Find an available locker on the home screen. Green tiles mean the locker is empty and ready for you to rent.",
      descTl: "Humanap ng bakanteng locker sa home screen. Ang berdeng tiles ay nangangahulugang bakante ito at maaari mong rentahan.",
      icon: "🟩",
      visual: (
        <div className="tutorial-visual grid-visual">
          <div className="mini-grid">
            <div className="mini-tile occupied">L-01<br/><span>Occupied</span></div>
            <div className="mini-tile available pulse-tile">L-02<br/><span>Available</span></div>
            <div className="mini-tile occupied">L-03<br/><span>Occupied</span></div>
          </div>
        </div>
      )
    },
    {
      titleEn: "2. Pick a Rental Type",
      titleTl: "2. Piliin ang Uri ng Renta",
      descEn: "Select Fixed Duration to rent for a set number of hours, or choose Open Time if you prefer to pay when returning the locker.",
      descTl: "Pumili ng Takdang Oras para sa partikular na oras, o Bukas na Oras kung nais mong magbayad kapag ibinalik mo na ang locker.",
      icon: "⏰",
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
      )
    },
    {
      titleEn: "3. Pay & Verify PIN",
      titleTl: "3. Magbayad at I-verify ang PIN",
      descEn: "Pay using your online CoinCubby Wallet or insert cash directly at the locker device. Your account's 6-digit password PIN is used for secure return verification.",
      descTl: "Magbayad gamit ang iyong CoinCubby Wallet o maghulog ng barya sa mismong device. Ang iyong 6-digit password PIN ang gagamitin para sa ligtas na pagbabalik.",
      icon: "🔑",
      visual: (
        <div className="tutorial-visual pin-visual">
          <div className="pin-visual-card">
            <div className="visual-pin-dots">
              <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
            </div>
            <div className="pin-visual-badge">6-Digit Password PIN</div>
          </div>
        </div>
      )
    },
    {
      titleEn: "4. Return When Done",
      titleTl: "4. Ibalik Kapag Tapos Na",
      descEn: "When you are ready to get your items, go to the Rent tab, click Return Locker, verify your PIN, and lock it back up safely.",
      descTl: "Kapag kukunin mo na ang iyong mga gamit, pumunta sa tab na Renta, i-click ang Ibalik ang Locker, ilagay ang PIN, at i-lock ito nang maayos.",
      icon: "↩️",
      visual: (
        <div className="tutorial-visual return-visual">
          <div className="return-success-badge">
            <span className="success-icon">✓</span>
            <strong>Rental Completed</strong>
            <small>Locker Safely Locked</small>
          </div>
        </div>
      )
    }
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
