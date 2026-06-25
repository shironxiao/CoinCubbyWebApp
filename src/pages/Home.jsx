/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import {
  activateRental,
  completeRental,
  createRental,
  fetchActiveRentals,
  fetchLockers,
  fetchModules,
  fetchTransactionPayments,
  formatMoney,
  parseTimestamp,
  sizeFromType,
  updateLockerStatus,
} from '../lib/supabase'
import { formatDateTime, formatDuration } from '../lib/time'

function statusClass(status) {
  return String(status || 'Available').toLowerCase().replaceAll(' ', '-')
}

export default function Home({ session, onNavigate, addNotification }) {
  const [modules, setModules] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [lockers, setLockers] = useState([])
  const [selectedLocker, setSelectedLocker] = useState(null)
  const [duration, setDuration] = useState('1')
  const [rentalType, setRentalType] = useState('fixed')
  const [paymentMethod, setPaymentMethod] = useState('Wallet')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [paymentTx, setPaymentTx] = useState(null)
  const [insertedAmount, setInsertedAmount] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [balance, setBalance] = useState(() => {
    try {
      const key = `coincubby.balance.${session?.userId}`
      const stored = localStorage.getItem(key)
      if (stored !== null) return Number(stored)
      localStorage.setItem(key, '50.00')
      return 50.00
    } catch {
      return 50.00
    }
  })
  const [activeRental, setActiveRental] = useState(null)
  const [tick, setTick] = useState(() => Date.now())

  const availableCount = useMemo(
    () => lockers.filter((locker) => locker.status === 'Available').length,
    [lockers],
  )

  const selectedModule = useMemo(
    () => modules.find((moduleItem) => String(moduleItem.module_id) === String(selectedModuleId)),
    [modules, selectedModuleId],
  )

  useEffect(() => {
    loadModules()
  }, [])

  useEffect(() => {
    if (selectedModuleId) {
      loadLockers(selectedModuleId)
    }
  }, [selectedModuleId])

  useEffect(() => {
    if (!session?.userId || !session?.accessToken) {
      setActiveRental(null)
      return
    }

    let isMounted = true
    async function loadActiveRental() {
      try {
        const rows = await fetchActiveRentals(session.userId, session.accessToken)
        if (!isMounted) return
        const rental = (rows || [])[0] || null
        setActiveRental(rental)
      } catch (err) {
        setActiveRental(null)
        console.error('Failed to load active rental:', err)
      }
    }

    loadActiveRental()
    return () => {
      isMounted = false
    }
  }, [session?.accessToken, session?.userId])

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Countdown timer for Pay at Device
  useEffect(() => {
    if (!paymentTx || hasTimedOut || secondsLeft <= 0) return

    const timer = setTimeout(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setHasTimedOut(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [paymentTx, secondsLeft, hasTimedOut])

  // Polling for cash insertions at the device
  useEffect(() => {
    if (!paymentTx || hasTimedOut) return

    let isMounted = true
    const interval = setInterval(async () => {
      try {
        const payments = await fetchTransactionPayments(paymentTx.transactionId, session.accessToken)
        if (!isMounted) return

        const sum = (payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0)
        
        setInsertedAmount((prev) => {
          if (sum > prev) {
            setSecondsLeft(60) // reset the timer back to 60!
          }
          return sum
        })

        if (sum >= paymentTx.totalAmount) {
          clearInterval(interval)
          await activateRental(paymentTx.transactionId, paymentTx.lockerId, session.accessToken)
          
          if (addNotification) {
            addNotification({
              title: 'Locker Rented',
              content: `Locker ${paymentTx.lockerNumber} is active. PIN: ${paymentTx.qrToken}`,
              type: 'rental_start',
            })
          }

          setPaymentTx(null)
          await loadLockers(selectedModuleId)
          onNavigate('rent')
        }
      } catch (err) {
        console.error('Error polling payments:', err)
      }
    }, 1500)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [paymentTx, hasTimedOut, session?.accessToken, session?.userId, selectedModuleId, addNotification, onNavigate])

  function handleContinuePayment() {
    setSecondsLeft(60)
    setHasTimedOut(false)
  }

  async function loadModules() {
    setLoading(true)
    setMessage('')
    try {
      const rows = await fetchModules()
      setModules(rows || [])
      if (rows?.length) {
        setSelectedModuleId(String(rows[0].module_id))
      } else {
        setLockers([])
        setMessage('No active modules found.')
      }
    } catch (err) {
      setMessage(err.message || 'Failed to load modules.')
    } finally {
      setLoading(false)
    }
  }

  async function loadLockers(moduleId) {
    setLoading(true)
    setMessage('')
    try {
      setLockers(await fetchLockers(moduleId))
    } catch (err) {
      setMessage(err.message || 'Failed to load lockers.')
    } finally {
      setLoading(false)
    }
  }

  async function returnActiveRental() {
    if (!activeRental) return
    setMessage('')

    const startMs = parseTimestamp(activeRental.start_time)
    const ratePerHr = Number(activeRental.rates?.price_per_minute || 0.17) * 60
    const item = {
      transactionId: activeRental.transaction_id,
      lockerId: activeRental.locker_id,
      lockerNumber: activeRental.lockers?.locker_number || activeRental.locker_id,
      durationMinutes: activeRental.duration_minutes || 0,
      isOpenTime: !activeRental.end_time,
      ratePerHr,
      startMs,
    }

    try {
      await completeRental(item, session.accessToken)

      if (addNotification) {
        addNotification({
          title: 'Locker Returned',
          content: `Locker ${item.lockerNumber} has been returned successfully.`,
          type: 'rental_end',
        })
      }

      setMessage(`Locker ${item.lockerNumber} returned.`)
      setActiveRental(null)
      await loadLockers(selectedModuleId)
    } catch (err) {
      setMessage(err.message || 'Could not return locker.')
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

    // Check if wallet has sufficient balance
    if (paymentMethod === 'Wallet' && !isOpenTime && balance < total) {
      setMessage('Insufficient wallet balance to start rental.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const { transactionId, qrToken } = await createRental({
        locker: selectedLocker,
        duration,
        isOpenTime,
        paymentMethod: isOpenTime ? 'Device' : paymentMethod,
        session,
      })
      
      const isDevicePending = !isOpenTime && paymentMethod === 'Device'

      if (isDevicePending) {
        setPaymentTx({
          transactionId,
          qrToken,
          lockerId: selectedLocker.dbId,
          lockerNumber: selectedLocker.id,
          totalAmount: total,
        })
        setInsertedAmount(0)
        setSecondsLeft(60)
        setHasTimedOut(false)
        setSelectedLocker(null)
      } else {
        // Trigger notification
        if (addNotification) {
          addNotification({
            title: 'Locker Rented',
            content: `Locker ${selectedLocker.id} (${selectedLocker.size}) is active. PIN: ${qrToken}`,
            type: 'rental_start',
          })
        }

        // Deduct from wallet if paid via Wallet
        if (paymentMethod === 'Wallet' && !isOpenTime) {
          const finalBalance = Math.max(0, balance - total)
          localStorage.setItem(`coincubby.balance.${session.userId}`, finalBalance.toFixed(2))
          setBalance(finalBalance)
        }

        setSelectedLocker(null)
        await loadLockers(selectedModuleId)
        onNavigate('rent')
      }
    } catch (err) {
      setMessage(err.message || 'Could not save rental.')
    } finally {
      setSaving(false)
    }
  }

  const total = selectedLocker ? Number(duration || 0) * selectedLocker.rate : 0

  return (
    <main className={`page xml-page xml-home ${!activeRental ? 'no-active-rental' : ''}`}>
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

      {activeRental && (
          <section className="rental-card home-rental-card">
          <div className="card-heading">
            <div>
              <small>Locker</small>
              <h2>{activeRental.lockers?.locker_number || activeRental.locker_id}</h2>
              <p>{sizeFromType(activeRental.lockers?.size_type_id).label}</p>
            </div>
            <span>Active</span>
          </div>

          <div className="timer-box">
            <small>{activeRental.end_time ? 'TIME REMAINING' : 'ELAPSED TIME'}</small>
            <strong>
              {activeRental.end_time
                ? formatDuration(Math.max(0, parseTimestamp(activeRental.end_time) - tick))
                : formatDuration(Math.max(0, tick - parseTimestamp(activeRental.start_time)))}
            </strong>
            <span>
              {activeRental.end_time
                ? `Prepaid: ${formatMoney(
                    (Math.max(0, parseTimestamp(activeRental.end_time) - parseTimestamp(activeRental.start_time)) / 3600000) *
                      (Number(activeRental.rates?.price_per_minute || 0.17) * 60)
                  )}`
                : `Current Bill: ${formatMoney(
                    (Math.max(0, tick - parseTimestamp(activeRental.start_time)) / 3600000) *
                      (Number(activeRental.rates?.price_per_minute || 0.17) * 60)
                  )}`}
            </span>
          </div>

          <dl className="detail-grid">
            <div>
              <dt>Started</dt>
              <dd>{formatDateTime(parseTimestamp(activeRental.start_time))}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{activeRental.end_time ? formatDateTime(parseTimestamp(activeRental.end_time)) : 'N/A (Open Time)'}</dd>
            </div>
            <div>
              <dt>Access Token</dt>
              <dd>{activeRental.qr_token || 'COIN-XXXXXX'}</dd>
            </div>
          </dl>

          <button className="primary-button xml-black-button" type="button" onClick={returnActiveRental}>
            Return Locker
          </button>
        </section>
      )}

      <section className="xml-balance-card">
        <span>Available Balance</span>
        <strong>{formatMoney(balance)}</strong>
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
            <small>{selectedModule?.name || 'Select a module'} · {availableCount} available</small>
          </div>
          <div className="xml-location">
            <small>Location</small>
            <strong>Hannah's Shop</strong>
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

      {paymentTx && (
        <div className="modal-backdrop" role="presentation">
          <div className="rent-sheet xml-rent-sheet">
            <div className="sheet-title">
              <div>
                <h2>Insert Money at Device</h2>
                <p className="muted">Locker {paymentTx.lockerNumber} · Payment Pending</p>
              </div>
              <button 
                className="icon-button" 
                type="button" 
                onClick={async () => {
                  try {
                    await updateLockerStatus(paymentTx.lockerId, 'Available', session.accessToken)
                    await loadLockers(selectedModuleId)
                  } catch (err) {
                    console.error('Error cancelling rental payment:', err)
                  }
                  setPaymentTx(null)
                }}
              >
                X
              </button>
            </div>

            <div className="payment-status-card">
              <div className="amount-stat">
                <span>Total Due</span>
                <strong>{formatMoney(paymentTx.totalAmount)}</strong>
              </div>
              <div className="amount-stat">
                <span>Inserted</span>
                <strong className="inserted-text">{formatMoney(insertedAmount)}</strong>
              </div>
              <div className="amount-stat">
                <span>Remaining</span>
                <strong className="remaining-text">
                  {formatMoney(Math.max(0, paymentTx.totalAmount - insertedAmount))}
                </strong>
              </div>
            </div>

            {hasTimedOut ? (
              <div className="timeout-container">
                <p className="alert">Payment session timed out. No cash was detected.</p>
                <button
                  className="primary-button xml-black-button continue-payment-btn"
                  type="button"
                  onClick={handleContinuePayment}
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="timer-container">
                <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${(secondsLeft / 60) * 100}%` }}
                  ></div>
                </div>
                <p className="timer-text">
                  Please insert cash. Time remaining: <strong>{secondsLeft}s</strong>
                </p>
              </div>
            )}

            <div className="action-row">
              <button 
                className="secondary-button" 
                type="button" 
                onClick={async () => {
                  try {
                    await updateLockerStatus(paymentTx.lockerId, 'Available', session.accessToken)
                    await loadLockers(selectedModuleId)
                  } catch (err) {
                    console.error('Error cancelling rental payment:', err)
                  }
                  setPaymentTx(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
