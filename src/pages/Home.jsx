import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../lib/supabase'
import { formatDuration } from '../lib/time'
import logo from '../assets/CoinCubby.png'

function statusClass(status) {
  return String(status || 'Available').toLowerCase().replaceAll(' ', '-')
}

export default function Home({
  modules,
  selectedModuleId,
  setSelectedModuleId,
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

  const filteredLockers = useMemo(() => {
    return lockers.filter((locker) => String(locker.moduleId) === String(selectedModuleId))
  }, [lockers, selectedModuleId])

  const availableCount = useMemo(
    () => filteredLockers.filter((locker) => locker.status === 'Available').length,
    [filteredLockers],
  )

  const selectedModule = useMemo(
    () => modules.find((moduleItem) => String(moduleItem.module_id) === String(selectedModuleId)),
    [modules, selectedModuleId],
  )

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className={`page xml-page xml-home ${activeRentals.length === 0 ? 'no-active-rental' : ''}`}>
      <section className="page-header">
        <div className="home-logo-wrap">
          <img className="home-logo-img" src={logo} alt="CoinCubby" />
          <h1 className="xml-app-title">CoinCubby</h1>
        </div>
      </section>

      <section className="xml-welcome-card">
        <p>{lang === 'tl' ? 'MALIGAYANG PAGDATING!' : 'WELCOME!'}</p>
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
              <span className="rate-chip"><b>S</b> {formatMoney(ratesMap[1] ?? 10, false)}/hr</span>
              <span className="rate-chip"><b>M</b> {formatMoney(ratesMap[2] ?? 20, false)}/hr</span>
              <span className="rate-chip"><b>L</b> {formatMoney(ratesMap[3] ?? 30, false)}/hr</span>
            </>
          ) : (
            <>
              <span className="rate-chip" style={{ opacity: 0.5 }}><b>S</b> ...</span>
              <span className="rate-chip" style={{ opacity: 0.5 }}><b>M</b> ...</span>
              <span className="rate-chip" style={{ opacity: 0.5 }}><b>L</b> ...</span>
            </>
          )}
        </div>

        {/* View Lockers button */}
        <button
          className="rent-now-button"
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

            const lockerLabel = rental.lockerNumber
            const sizeLabel   = rental.sizeName
            return (
              <div
                className={`home-rental-bar-card${isOverdue ? ' home-rental-bar-card--overdue' : ''}`}
                key={rental.transactionId}
              >
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
          <span className="xml-icon-circle locker-glyph" aria-hidden="true"></span>
          <div>
            <strong>{filteredLockers.length}</strong>
            <small>{lang === 'tl' ? 'Kabuuan ng Locker' : 'Total Locker'}</small>
          </div>
        </div>
        <div className="xml-legend-card">
          <span><i className="available"></i>{t('available')}</span>
          <span><i className="occupied"></i>{t('occupied')}</span>
          <span><i className="maintenance"></i>{t('maintenance')}</span>
        </div>
      </section>

      {/* Module Selector */}
      {modules.length > 1 && (
        <div className="module-selector">
          {modules.map((mod) => (
            <button
              key={mod.module_id}
              className={String(mod.module_id) === String(selectedModuleId) ? 'active' : ''}
              onClick={() => setSelectedModuleId(mod.module_id)}
            >
              {mod.module_name || `Module ${mod.module_id}`}
            </button>
          ))}
        </div>
      )}

      {/* Locker Panel */}
      <section className="xml-locker-panel" ref={lockerPanelRef}>
        <div className="xml-locker-panel-head">
          <div>
            <strong style={{ fontSize: '14px', fontWeight: 800 }}>
              {selectedModule?.module_name || (lang === 'tl' ? 'Mga Locker' : 'Lockers')}
            </strong>
            <div className="xml-location">
              <strong>{availableCount} {lang === 'tl' ? 'Bakante' : 'Available'}</strong>
              <small>{selectedModule?.location || ''}</small>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="xml-loading">
            <span />
          </div>
        ) : filteredLockers.length === 0 ? (
          <div className="empty-state">{t('no_lockers')}</div>
        ) : (
          <div className="locker-grid">
            {filteredLockers.map((locker) => (
              <div
                key={locker.id}
                className={`locker-tile ${statusClass(locker.status)}`}
              >
                <span className="locker-icon" aria-hidden="true">
                  <span className="locker-glyph" />
                </span>
                <div>
                  <strong>{locker.lockerNumber || locker.locker_number}</strong>
                  <small>{locker.sizeName || locker.size_name}</small>
                </div>
                <span className={`locker-dot ${statusClass(locker.status)}`} />
                <b>{locker.status}</b>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
