/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react'
import { completeRental, fetchActiveRentals, formatMoney, parseTimestamp, sizeFromType } from '../lib/supabase'
import { formatDateTime, formatDuration } from '../lib/time'

function mapRental(row) {
  const size = sizeFromType(row.lockers?.size_type_id)
  const startMs = parseTimestamp(row.start_time)
  const endMs = parseTimestamp(row.end_time)
  const isOpenTime = !row.end_time
  const ratePerHr = Number(row.rates?.price_per_minute || 0.17) * 60

  return {
    transactionId: row.transaction_id,
    lockerId: row.locker_id,
    lockerNumber: row.lockers?.locker_number || '?',
    sizeName: size.label,
    startMs,
    endMs,
    isOpenTime,
    ratePerHr,
    qrToken: row.qr_token || '-',
    durationMinutes: row.duration_minutes || 0,
  }
}

export default function Rent({ session, addNotification }) {
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(() => Date.now())
  const [confirmItem, setConfirmItem] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const loadRentals = useCallback(async () => {
    if (!session?.userId) {
      setRentals([])
      setLoading(false)
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const rows = await fetchActiveRentals(session.userId, session.accessToken)
      setRentals((rows || []).map(mapRental))
    } catch (err) {
      setMessage(err.message || 'Failed to load rentals.')
    } finally {
      setLoading(false)
    }
  }, [session?.accessToken, session?.userId])

  useEffect(() => {
    loadRentals()
  }, [loadRentals])

  async function returnLocker(item) {
    setMessage('')
    try {
      await completeRental(item, session.accessToken)
      
      // Trigger notification
      if (addNotification) {
        addNotification({
          title: 'Locker Returned',
          content: `Locker ${item.lockerNumber} has been successfully returned.`,
          type: 'rental_end',
        })
      }

      setMessage(`Locker ${item.lockerNumber} returned.`)
      await loadRentals()
    } catch (err) {
      setMessage(err.message || 'Could not return locker.')
    }
  }

  function currentCost(item) {
    if (!item.isOpenTime) {
      const hours = Math.max(0, item.endMs - item.startMs) / 3600000
      return `Prepaid: ${formatMoney(hours * item.ratePerHr)}`
    }

    const hours = Math.max(tick - item.startMs, 3600000) / 3600000
    return `Current Bill: ${formatMoney(hours * item.ratePerHr)}`
  }

  return (
    <main className="page xml-page xml-rentals">
      <section className="xml-screen-header">
        <h1>My Rentals</h1>
      </section>

      <section className="xml-active-banner">
        <div>
          <small>ACTIVE RENTALS</small>
          <strong>{rentals.length} locker(s) rented</strong>
        </div>
        <span className="locker-glyph banner-locker" aria-hidden="true"></span>
      </section>

      {message && <p className={message.includes('returned') ? 'success' : 'alert'}>{message}</p>}
      {loading && <div className="xml-loading"><span></span><p>Loading rentals...</p></div>}
      {!loading && rentals.length === 0 && <p className="empty-state">No active rentals yet.</p>}

      <section className="rental-list">
        {rentals.map((item) => {
          const timer = item.isOpenTime
            ? formatDuration(tick - item.startMs)
            : formatDuration(item.endMs - tick)

          return (
            <article className="rental-card" key={item.transactionId}>
              <div className="card-heading">
                <div>
                  <small>Locker</small>
                  <h2>{item.lockerNumber}</h2>
                  <p>{item.sizeName}</p>
                </div>
                <span>Active</span>
              </div>

              <div className="timer-box">
                <small>{item.isOpenTime ? 'ELAPSED TIME' : 'TIME REMAINING'}</small>
                <strong>{timer}</strong>
                <span>{currentCost(item)}</span>
              </div>

              <dl className="detail-grid">
                <div>
                  <dt>Started</dt>
                  <dd>{formatDateTime(item.startMs)}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{item.isOpenTime ? 'N/A (Open Time)' : formatDateTime(item.endMs)}</dd>
                </div>
                <div>
                  <dt>Access Token</dt>
                  <dd>{item.qrToken}</dd>
                </div>
              </dl>

              <button className="primary-button xml-black-button" type="button" onClick={() => setConfirmItem(item)}>
                Return Locker
              </button>
            </article>
          )
        })}
      </section>

      {confirmItem && (
        <div className="modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setConfirmItem(null)}>
          <div className="rent-sheet xml-rent-sheet">
            <div className="sheet-title">
              <div>
                <h2>Return Locker {confirmItem.lockerNumber}?</h2>
                <p className="muted">
                  Size: {confirmItem.sizeName} | {currentCost(confirmItem)}
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setConfirmItem(null)}>
                X
              </button>
            </div>

            <p style={{ textAlign: 'center', margin: '14px 0', fontSize: '13px', color: '#555555', lineHeight: '1.5' }}>
              Are you sure you want to return this locker? 
              <br />
              This will deactivate your access token and end your rental session.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <button 
                className="secondary-button" 
                type="button" 
                onClick={() => setConfirmItem(null)}
              >
                Cancel
              </button>
              <button 
                className="primary-button xml-black-button" 
                type="button" 
                onClick={() => {
                  returnLocker(confirmItem)
                  setConfirmItem(null)
                }}
              >
                Yes, Return
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
