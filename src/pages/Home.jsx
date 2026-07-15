import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../lib/supabase'
import { formatDuration } from '../lib/time'

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
        <div>
          <h1 className="xml-app-title">CoinCubby</h1>
        </div>
      </section>

      <section className="xml-welcome-card">
        <p>{lang === 'tl' ? 'MALIGAYANG PAGDATING!' : 'WELCOME!'}</p>
        <h2>{lang === 'tl' ? 'Piliin ang iyong locker' : 'Pick your locker'}</h2>
        <span>
          {lang === 'tl'
            ? 'Ang berde ay nangangahulugang maaari itong gamitin. Tingnan ang indikasyon sa ibaba.'
            : "Green means you're good to go. Check status indicator below."}
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
          <span><i className="payment-required"></i>{lang === 'tl' ? 'Kailangang Magbayad' : 'Payment Required'}</span>
          <span><i className="occupied"></i>{t('occupied')}</span>
          <span><i className="maintenance"></i>{lang === 'tl' ? 'Kumpunihin' : 'Maintenance'}</span>
        </div>
      </section>

      <section className="xml-locker-panel" ref={lockerPanelRef}>
        <div className="xml-locker-panel-head">
          <span className="xml-dark-circle locker-glyph light" aria-hidden="true"></span>
          <div>
            <strong>CoinCubby</strong>
            <small>{selectedModule?.name || (lang === 'tl' ? 'Pumili ng module' : 'Select a module')} · {availableCount} {lang === 'tl' ? 'bakante' : 'available'}</small>
          </div>
          <div className="xml-location">
            <small>{t('location')}</small>
            <strong>{t('location_name')}</strong>
          </div>
        </div>

        <div className="module-selector" aria-label="Module selector">
          {modules.map((moduleItem) => (
            <button
              key={moduleItem.module_id}
              className={String(moduleItem.module_id) === String(selectedModuleId) ? 'active' : ''}
              type="button"
              onClick={() => setSelectedModuleId(String(moduleItem.module_id))}
            >
              {moduleItem.name || `Module ${moduleItem.module_id}`}
            </button>
          ))}
        </div>

      {loading ? (
        <p className="muted">{t('loading_lockers')}</p>
      ) : (
        <div className="locker-grid">
          {filteredLockers.map((locker) => (
            <div
              key={locker.dbId}
              className={`locker-tile ${statusClass(locker.status)}`}
              style={{ cursor: 'default' }}
            >
              <span className="locker-icon locker-glyph" aria-hidden="true"></span>
              <strong>{locker.id}</strong>
              <span className="locker-dot"></span>
              <small>
                {locker.status === 'Available' ? t('available')
                  : locker.status === 'Occupied' ? t('occupied')
                  : locker.status === 'Unavailable' ? t('unavailable')
                  : locker.status}
              </small>
              <b>{locker.size} S</b>
            </div>
          ))}
        </div>
      )}
      </section>
    </main>
  )
}
