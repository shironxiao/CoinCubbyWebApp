import logo from '../assets/CoinCubby.png'

export default function LoadingScreen({ message = 'Loading...', subMessage }) {
  const waveDotCount = 12

  return (
    <div className="neo-loading-overlay" role="status" aria-live="polite">
      <div className="neo-loading-card">
        <div className="neo-loading-logo-box">
          <img className="neo-loading-logo" src={logo} alt="CoinCubby Logo" />
        </div>

        <div className="neo-loading-brand">
          <h2 className="neo-loading-title">CoinCubby</h2>
          <span className="neo-loading-tagline">Smart &amp; Secure Storage</span>
        </div>

        <div className="neo-loading-wave" aria-hidden="true">
          {Array.from({ length: waveDotCount }).map((_, i) => (
            <span
              key={i}
              className="neo-wave-dot"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>

        <p className="neo-loading-message">{message}</p>
        {subMessage && <small className="neo-loading-submessage">{subMessage}</small>}
      </div>
    </div>
  )
}
