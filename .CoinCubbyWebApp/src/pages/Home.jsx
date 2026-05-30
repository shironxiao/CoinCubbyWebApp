import { useEffect, useMemo, useState } from 'react'
import { createRental, fetchLockers, formatMoney } from '../lib/supabase'

function statusClass(status) {
  return String(status || 'Available').toLowerCase().replaceAll(' ', '-')
}

export default function Home({ session, onNavigate }) {
  const [lockers, setLockers] = useState([])
  const [selectedLocker, setSelectedLocker] = useState(null)
  const [duration, setDuration] = useState('1')
  const [rentalType, setRentalType] = useState('fixed')
  const [paymentMethod, setPaymentMethod] = useState('Wallet')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const availableCount = useMemo(
    () => lockers.filter((locker) => locker.status === 'Available').length,
    [lockers],
  )

  useEffect(() => {
    loadLockers()
  }, [])

  async function loadLockers() {
    setLoading(true)
    setMessage('')
    try {
      setLockers(await fetchLockers())
    } catch (err) {
      setMessage(err.message || 'Failed to load lockers.')
    } finally {
      setLoading(false)
    }
  }

  function openRental(locker) {
    if (locker.status !== 'Available') {
      setMessage(`Locker ${locker.id} is not available.`)
      return
    }

    setSelectedLocker(locker)
    setDuration('1')
    setRentalType('fixed')
    setPaymentMethod('Wallet')
  }

  async function confirmRental(event) {
    event.preventDefault()
    if (!selectedLocker) return

    const isOpenTime = rentalType === 'open'
    if (!isOpenTime && (!duration || Number(duration) <= 0)) {
      setMessage('Duration must be at least 1 hour.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      await createRental({
        locker: selectedLocker,
        duration,
        isOpenTime,
        paymentMethod: isOpenTime ? 'Device' : paymentMethod,
        session,
      })
      setSelectedLocker(null)
      await loadLockers()
      onNavigate('rent')
    } catch (err) {
      setMessage(err.message || 'Could not save rental.')
    } finally {
      setSaving(false)
    }
  }

  const total = selectedLocker ? Number(duration || 0) * selectedLocker.rate : 0

  return (
    <main className="page xml-page xml-home">
      <section className="page-header">
        <div>
          <h1 className="xml-app-title">CoinCubby</h1>
        </div>
      </section>

      <section className="xml-welcome-card">
        <p>WELCOME!</p>
        <h2>Pick your locker</h2>
        <span>Green means you're good to go.<br />Check status indicator below.</span>
      </section>

      <section className="xml-balance-card">
        <span>Available Balance</span>
        <strong>₱ 50.00</strong>
      </section>

      <section className="xml-stats-row">
        <div className="xml-stat-card">
          <span className="xml-icon-circle locker-glyph" aria-hidden="true"></span>
          <div>
            <strong>{lockers.length}</strong>
            <small>Total Locker</small>
          </div>
        </div>
        <div className="xml-legend-card">
          <span><i className="available"></i>Available</span>
          <span><i className="payment-required"></i>Payment Required</span>
          <span><i className="occupied"></i>Occupied</span>
          <span><i className="maintenance"></i>Maintenance</span>
        </div>
      </section>

      <section className="xml-locker-panel">
        <div className="xml-locker-panel-head">
          <span className="xml-dark-circle locker-glyph light" aria-hidden="true"></span>
          <div>
            <strong>CoinCubby</strong>
            <small>{availableCount} available</small>
          </div>
          <div className="xml-location">
            <small>Location</small>
            <strong>Hannah's Shop</strong>
          </div>
        </div>

      {message && <p className="alert">{message}</p>}
      {loading ? (
        <p className="muted">Loading lockers...</p>
      ) : (
        <div className="locker-grid">
          {lockers.map((locker) => (
            <button
              key={locker.dbId}
              className={`locker-tile ${statusClass(locker.status)}`}
              type="button"
              onClick={() => openRental(locker)}
            >
              <span className="locker-icon locker-glyph" aria-hidden="true"></span>
              <strong>{locker.id}</strong>
              <span className="locker-dot"></span>
              <small>{locker.status}</small>
              <b>{locker.size} S</b>
            </button>
          ))}
        </div>
      )}
      </section>

      {selectedLocker && (
        <div className="modal-backdrop" role="presentation">
          <form className="rent-sheet xml-rent-sheet" onSubmit={confirmRental}>
            <div className="sheet-title">
              <div>
                <h2>Rent Locker {selectedLocker.id}</h2>
                <p className="muted">
                  Size: {selectedLocker.size} | Rate: {formatMoney(selectedLocker.rate)}/hr
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedLocker(null)}>
                X
              </button>
            </div>

            <p className="xml-section-label">Rental Type</p>
            <div className="segmented xml-radio-row">
              <button
                type="button"
                className={rentalType === 'fixed' ? 'active' : ''}
                onClick={() => {
                  setRentalType('fixed')
                  setPaymentMethod('Wallet')
                }}
              >
                Fixed Duration
              </button>
              <button
                type="button"
                className={rentalType === 'open' ? 'active' : ''}
                onClick={() => {
                  setRentalType('open')
                  setPaymentMethod('Device')
                }}
              >
                Open Time
              </button>
            </div>

            {rentalType === 'fixed' && (
              <label className="xml-field plain">
                <span>Duration</span>
                <input
                  min="1"
                  type="number"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </label>
            )}

            <p className="xml-section-label">Payment Method</p>
            <div className="payment-options xml-payment-options">
              {rentalType === 'fixed' && (
                <button
                  type="button"
                  className={paymentMethod === 'Wallet' ? 'selected' : ''}
                  onClick={() => setPaymentMethod('Wallet')}
                >
                  Wallet ({formatMoney(total || selectedLocker.rate)})
                </button>
              )}
              <button
                type="button"
                className={paymentMethod === 'Device' ? 'selected' : ''}
                onClick={() => setPaymentMethod('Device')}
              >
                Pay at Device
              </button>
            </div>

            <div className="total-row">
              <span>Total Amount</span>
              <strong>{rentalType === 'open' ? 'Running...' : formatMoney(total)}</strong>
            </div>

            <div className="action-row">
              <button className="secondary-button" type="button" onClick={() => setSelectedLocker(null)}>
                Cancel
              </button>
              <button className="primary-button xml-black-button" type="submit" disabled={saving}>
                {saving ? 'Saving...' : rentalType === 'open' ? 'Start Rental' : 'Confirm Rental'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
