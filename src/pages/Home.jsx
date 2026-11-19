import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../lib/supabase'
import { formatDuration } from '../lib/time'
import logo from '../assets/CoinCubby.png'

function statusClass(status) {
  return String(status || 'Available').toLowerCase().replaceAll(' ', '-')
}

function LockerIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <rect x="4" y="10" width="16" height="12" rx="2.5" ry="2.5" />
      <path d="M7 10V6.5a5 5 0 0 1 10 0V10" />
      <circle cx="12" cy="15" r="1.2" fill={color} />
      <path d="M12 16.2v2" strokeWidth="2" />
    </svg>
  )
}

export default function Home({
  modules,
  lockers,
  walletBalance,
  activeRentals,
  ratesMap,
  loadingData,
  t,
  lang,
}) {
  const lockerPanelRef = useRef(null)
  const [tick, setTick] = useState(() => Date.now())

  const balance = walletBalance
  const loading = loadingData

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className={`page xml-page xml-home neo-brutalist-home ${activeRentals.length === 0 ? 'no-active-rental' : ''}`}>
      <section className="page-header">
        <div className="home-logo-wrap">
          <img className="home-logo-img coin-logo-animated" src={logo} alt="CoinCubby" />
          <h1 className="xml-app-title">CoinCubby</h1>
        </div>
      </section>

      <section className="xml-welcome-card neo-card neo-welcome-card">
        <div className="neo-kiosk-tagline" style={{ margin: '0 0 10px 0', alignSelf: 'flex-start', background: '#FEF08A' }}>
          SMART LOCKER SYSTEM • SECURE STORAGE
        </div>
        <p className="neo-welcome-subtitle">{lang === 'tl' ? 'MALIGAYANG PAGDATING!' : 'WELCOME!'}</p>
        <h2>{lang === 'tl' ? 'Piliin ang iyong locker' : 'Pick your locker'}</h2>
        <span>
          {lang === 'tl'
            ? 'Ang asul ay nangangahulugang maaari itong gamitin. Tingnan ang indikasyon sa ibaba.'
            : "Blue means you're good to go. Check status indicator below."}
        </span>

        {/* Rate chips — from database */}
        <div className="welcome-rates">
          {ratesMap ? (
            <>
              <span className="rate-chip neo-rate-chip"><b>S</b> <strong>{formatMoney(ratesMap[1] ?? 10, false)}/hr</strong></span>
              <span className="rate-chip neo-rate-chip"><b>M</b> <strong>{formatMoney(ratesMap[2] ?? 20, false)}/hr</strong></span>
              <span className="rate-chip neo-rate-chip"><b>L</b> <strong>{formatMoney(ratesMap[3] ?? 30, false)}/hr</strong></span>
            </>
          ) : (
            <>
              <span className="rate-chip neo-rate-chip" style={{ opacity: 0.5 }}><b>S</b> <strong>...</strong></span>
              <span className="rate-chip neo-rate-chip" style={{ opacity: 0.5 }}><b>M</b> <strong>...</strong></span>
              <span className="rate-chip neo-rate-chip" style={{ opacity: 0.5 }}><b>L</b> <strong>...</strong></span>
            </>
          )}
        </div>

        {/* View Lockers button */}
        <button
          className="rent-now-button neo-view-lockers-btn"
          type="button"
          onClick={() => lockerPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {lang === 'tl' ? 'Tingnan ang mga Locker' : 'View Lockers'}
        </button>
      </section>

      {activeRentals.length > 0 && (
        <div className="home-rentals-container">
          {activeRentals.map((rental) => {
            const isOpen = rental.isOpenTime
            const startMs = rental.startMs
            const endMs   = rental.endMs
            const totalMs  = isOpen ? null : Math.max(1, endMs - startMs)
            const elapsedMs = Math.max(0, tick - startMs)
            const isOverdue = !isOpen && tick > endMs
            const overtimeMs = isOverdue ? Math.max(0, tick - endMs) : 0
            const remainMs  = isOpen ? 0 : Math.max(0, endMs - tick)
            const progress  = isOpen ? 100 : Math.min(100, (elapsedMs / totalMs) * 100)

            const ratePerHr    = rental.ratePerHr

            // Timer: elapsed for open, overtime elapsed for overdue, remaining for fixed-in-time
            const timerMs = isOpen ? elapsedMs : isOverdue ? overtimeMs : remainMs
            const timer   = formatDuration(timerMs)
            const timerLabel = isOpen 
              ? (lang === 'tl' ? 'NAKALIPAS' : 'ELAPSED') 
              : isOverdue 
                ? (lang === 'tl' ? 'LUMAMPAS NA' : 'OVERTIME') 
                : (lang === 'tl' ? 'NATITIRA' : 'REMAINING')

            // Bill: use half-hour step formula (matches what is actually charged)
            const prepaidCost = isOpen ? 0 : (totalMs / 3600000) * ratePerHr

            function calcOpenBill(elMs) {
              const mins = Math.floor(elMs / 60000)
              const hrs = Math.floor(mins / 60)
              const rem = mins % 60
              let mult = hrs
              if (rem > 0) mult += rem <= 30 ? 0.5 : 1.0
              return Math.floor(mult * ratePerHr)
            }

            function calcOvertimeBill(otMs) {
              const mins = Math.floor(otMs / 60000)
              const blocks = Math.floor(mins / 30)
              const rem = mins % 30
              let mult = blocks * 0.5
              if (rem > 10) {
                mult += 0.5
              }
              return Math.floor(mult * ratePerHr)
            }

            const overtimeCost = calcOvertimeBill(overtimeMs)
            const openCost     = calcOpenBill(elapsedMs)
            const billLabel = isOpen
              ? `${lang === 'tl' ? 'Kabayaran' : 'Bill'}: ${formatMoney(openCost, false)}`
              : isOverdue
                ? `${lang === 'tl' ? 'May Labis na Oras' : 'Overtime Due'}: ${formatMoney(overtimeCost, false)}`
                : `${lang === 'tl' ? 'Bayad' : 'Paid'}: ${formatMoney(prepaidCost, false)}`

            const rawLocker = rental.lockerNumber || ''
            const lockerLabel = String(rawLocker).toLowerCase().startsWith('locker') ? rawLocker : `Locker ${rawLocker}`
            const sizeLabel   = rental.sizeName
            return (
              <div
                className={`home-rental-bar-card neo-card${isOverdue ? ' home-rental-bar-card--overdue' : ''}`}
                key={rental.transactionId}
              >
                <div
                  className="neo-kiosk-tagline"
                  style={{
                    margin: '0 0 12px 0',
                    alignSelf: 'flex-start',
                    background: isOverdue ? '#FECACA' : '#BBF7D0',
                  }}
                >
                  {isOverdue
                    ? (lang === 'tl' ? 'MAY LABIS NA ORAS' : 'OVERDUE RENTAL')
                    : (lang === 'tl' ? 'KASALUKUYANG RENTA • AKTIBO' : 'CURRENT RENTAL • ACTIVE')}
                </div>

                {/* top row */}
                <div className="hbar-top">
                  <div className="hbar-info">
                    <span className="hbar-locker">{lockerLabel}</span>
                    <span className="hbar-size">{sizeLabel}</span>
                  </div>
                  <span className={`hbar-badge${isOverdue ? ' hbar-badge--overdue' : ''}`}>
                    <span className="hbar-dot" />
                    {isOverdue 
                      ? (lang === 'tl' ? 'Lampas sa Oras' : 'Overdue') 
                      : (lang === 'tl' ? 'Aktibo' : 'Active')}
                  </span>
                </div>
                {/* progress bar */}
                <div className="hbar-track">
                  <div
                    className={`hbar-fill${isOpen ? ' hbar-fill--open' : ''}${isOverdue ? ' hbar-fill--overdue' : ''}`}
                    style={isOpen || isOverdue ? {} : { width: `${progress}%` }}
                  />
                </div>
                {/* bottom row */}
                <div className="hbar-bottom">
                  <span className="hbar-label">{timerLabel}</span>
                  <span className="hbar-timer">{timer}</span>
                  <span className={`hbar-bill${isOverdue ? ' hbar-bill--overdue' : ''}`}>{billLabel}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <section className="xml-balance-card">
        <span>{t('available_balance')}</span>
        <strong>{formatMoney(balance)}</strong>
      </section>

      <section className="xml-stats-row">
        <div className="xml-stat-card">
          <span className="xml-icon-circle" aria-hidden="true">
            <LockerIcon size={20} color="#3B9EE8" />
          </span>
          <div>
            <strong>{lockers.length}</strong>
            <small>{lang === 'tl' ? 'Kabuuan ng Locker' : 'Total Locker'}</small>
          </div>
        </div>
        <div className="xml-legend-card">
          <span><i className="available"></i>{t('available')}</span>
          <span><i className="occupied"></i>{t('occupied')}</span>
          <span><i className="maintenance"></i>{t('maintenance')}</span>
        </div>
      </section>

      {/* Locker Panel */}
      <section className="home-modules-panel" ref={lockerPanelRef}>
        {loading ? (
          <div className="xml-loading">
            <span />
          </div>
        ) : modules.length === 0 ? (
          <div className="empty-state">{t('no_lockers')}</div>
        ) : (
          <div className="home-module-grid">
            {modules.map((moduleItem, moduleIndex) => {
              const moduleLockers = lockers
                .filter(
                  (locker) => String(locker.moduleId) === String(moduleItem.module_id),
                )
                .slice()
                .sort((a, b) => {
                  const sizeOrder = { Small: 1, Medium: 2, Large: 3 }
                  const sizeDifference =
                    (sizeOrder[a.size] || 99) - (sizeOrder[b.size] || 99)
                  if (sizeDifference !== 0) return sizeDifference
                  return String(a.id || '').localeCompare(String(b.id || ''), undefined, {
                    numeric: true,
                  })
                })
              const moduleAvailableCount = moduleLockers.filter(
                (locker) => locker.status === 'Available',
              ).length

              return (
                <section className="home-module-panel" key={moduleItem.module_id}>
                  <header className="home-module-heading">
                    <strong>{`Module ${moduleIndex + 1}`}</strong>
                    <span>{moduleAvailableCount} {lang === 'tl' ? 'Bakante' : 'Available'}</span>
                  </header>

                  {moduleLockers.length === 0 ? (
                    <div className="empty-state">{t('no_lockers')}</div>
                  ) : (
                    <div className="home-module-locker-grid">
                      {moduleLockers.map((locker) => {
                        const rawNum = locker.id || locker.lockerNumber || locker.locker_number || ''
                        const lockerName = String(rawNum).replace(/^Locker\s+/i, '') || 'Locker'
                        const sizeName = locker.size || locker.sizeName || locker.size_name || ''
                        const sizeClass = String(sizeName).toLowerCase()
                        const pricePerHr = locker.rate ?? (ratesMap && locker.sizeTypeId ? ratesMap[locker.sizeTypeId] : null)
                        const priceLabel = pricePerHr != null ? `₱${pricePerHr}/hr` : ''
                        const status = String(locker.status || 'Available')
                        const statusLabel = status.toLowerCase() === 'occupied' ? 'In Use' : status

                        return (
                          <article
                            key={locker.id}
                            className={`home-locker-card ${statusClass(status)} home-locker-card--${sizeClass}`}
                          >
                            <div className="home-locker-card-title">
                              <strong>{lockerName}</strong>
                              <span className={`home-locker-status ${statusClass(status)}`}>
                                <i />
                                {statusLabel}
                              </span>
                            </div>
                            <small>{sizeName} {lang === 'tl' ? 'SUKAT' : 'SIZE'}</small>
                            {priceLabel && <b>{priceLabel}</b>}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
