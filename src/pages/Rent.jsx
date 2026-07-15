import { useEffect, useState } from 'react'
import { formatMoney } from '../lib/supabase'
import { formatDateTime, formatDuration } from '../lib/time'

function calculateOvertimeFee(item, currentTick) {
  let mins = 0
  if (item.isOpenTime) {
    const durationMs = Math.max(0, currentTick - item.startMs)
    mins = Math.floor(durationMs / 60000)
    const hours = Math.floor(mins / 60)
    const rem = mins % 60
    let multiplier = hours
    if (rem > 0) {
      if (rem <= 30) {
        multiplier += 0.5
      } else {
        multiplier += 1.0
      }
    }
    return Math.floor(multiplier * item.ratePerHr)
  } else {
    if (currentTick <= item.endMs) return 0
    const overtimeMs = currentTick - item.endMs
    mins = Math.floor(overtimeMs / 60000)
    const blocks = Math.floor(mins / 30)
    const rem = mins % 30
    let multiplier = blocks * 0.5
    if (rem > 10) {
      multiplier += 0.5
    }
    return Math.floor(multiplier * item.ratePerHr)
  }
}

export default function Rent({
  activeRentals,
  loadingData,
  t,
  lang,
}) {
  const rentals = activeRentals
  const loading = loadingData

  const [tick, setTick] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  function currentCost(item) {
    if (!item.isOpenTime) {
      const prepaidHours = Math.max(0, item.endMs - item.startMs) / 3600000
      const prepaid = prepaidHours * item.ratePerHr

      // Past end time → show accumulating overtime using half-hour step billing
      if (tick > item.endMs) {
        const overtimeCost = calculateOvertimeFee(item, tick)
        return `${lang === 'tl' ? 'May Labis na Oras' : 'Overtime Due'}: ${formatMoney(overtimeCost, false)}`
      }

      return `${lang === 'tl' ? 'Bayad Na' : 'Prepaid'}: ${formatMoney(prepaid, false)}`
    }

    // Open time: bill using the same half-hour step formula as calculateOvertimeFee
    // (matches exactly what will be charged on return)
    const openCost = calculateOvertimeFee(item, tick)
    return `${lang === 'tl' ? 'Kabayaran' : 'Bill'}: ${formatMoney(openCost, false)}`
  }

  return (
    <main className="page xml-page xml-rentals">
      <section className="xml-screen-header">
        <h1>{t('my_rentals')}</h1>
      </section>

      <section className="xml-active-banner">
        <div>
          <small>{t('active_rentals_label')}</small>
          <strong>{rentals.length} {lang === 'tl' ? 'locker ang narentahan' : 'locker(s) rented'}</strong>
        </div>
        <span className="locker-glyph banner-locker" aria-hidden="true"></span>
      </section>

      {loading && <div className="xml-loading"><span></span><p>{lang === 'tl' ? 'Naglo-load ng mga renta...' : 'Loading rentals...'}</p></div>}
      {!loading && rentals.length === 0 && <p className="empty-state">{lang === 'tl' ? 'Wala pang aktibong mga renta.' : 'No active rentals yet.'}</p>}

      <section className="rental-list">
        {rentals.map((item) => {
          const isOverdue = !item.isOpenTime && tick > item.endMs

          // Timer display: elapsed for open/overdue, remaining for fixed-within-time
          const timerMs = item.isOpenTime
            ? tick - item.startMs
            : isOverdue
              ? tick - item.endMs   // overtime elapsed
              : item.endMs - tick   // time remaining
          const timer = formatDuration(timerMs)
          const timerLabel = item.isOpenTime
            ? (lang === 'tl' ? 'NAKALIPAS NA ORAS' : 'ELAPSED TIME')
            : isOverdue
              ? (lang === 'tl' ? 'LUMAMPAS NA ORAS' : 'OVERTIME')
              : (lang === 'tl' ? 'NATITIRANG ORAS' : 'TIME REMAINING')

          return (
            <article className={`rental-card${isOverdue ? ' rental-card--overdue' : ''}`} key={item.transactionId}>
              <div className="card-heading">
                <div>
                  <small>{lang === 'tl' ? 'Locker' : 'Locker'}</small>
                  <h2>{item.lockerNumber}</h2>
                  <p>{item.sizeName}</p>
                </div>
                <span className={isOverdue ? 'badge-overdue' : ''}>
                  {isOverdue 
                    ? (lang === 'tl' ? 'Lampas sa Oras' : 'Overdue') 
                    : (lang === 'tl' ? 'Aktibo' : 'Active')}
                </span>
              </div>

              <div className="timer-box">
                <small>{timerLabel}</small>
                <strong>{timer}</strong>
                <span>{currentCost(item)}</span>
              </div>

              <dl className="detail-grid">
                <div>
                  <dt>{lang === 'tl' ? 'Nagsimula' : 'Started'}</dt>
                  <dd>{formatDateTime(item.startMs)}</dd>
                </div>
                <div>
                  <dt>{lang === 'tl' ? 'Magtatapos' : 'Expires'}</dt>
                  <dd>{item.isOpenTime ? (lang === 'tl' ? 'N/A (Bukas na Oras)' : 'N/A (Open Time)') : formatDateTime(item.endMs)}</dd>
                </div>
              </dl>
            </article>
          )
        })}
      </section>
    </main>
  )
}
