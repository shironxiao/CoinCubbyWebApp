/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  activateRental,
  cancelPaymentSession,
  createRental,
  fetchActiveRentals,
  fetchLockers,
  fetchModules,
  fetchPaymentSession,
  fetchTransactionPayments,
  formatMoney,
  getOrCreateWallet,
  parseTimestamp,
  sizeFromType,
  syncWalletBalance,
  updateLockerStatus,
} from '../lib/supabase'
import { formatDuration } from '../lib/time'

function statusClass(status) {
  return String(status || 'Available').toLowerCase().replaceAll(' ', '-')
}

export default function Home({ session, onNavigate, addNotification }) {
  const lockerPanelRef = useRef(null)
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
  const [activeRentals, setActiveRentals] = useState([])
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
    if (session?.userId) {
      getOrCreateWallet(session).then((val) => {
        if (val !== null) setBalance(val)
      })
    }
  }, [session])

  useEffect(() => {
    if (selectedModuleId) {
      loadLockers(selectedModuleId)
    }
  }, [selectedModuleId])

  useEffect(() => {
    if (!session?.userId || !session?.accessToken) {
      setActiveRentals([])
      return
    }

    let isMounted = true
    async function loadActiveRentals() {
      try {
        const rows = await fetchActiveRentals(session.userId, session.accessToken)
        if (!isMounted) return
        setActiveRentals(rows || [])
      } catch (err) {
        if (isMounted) {
          setActiveRentals([])
        }
        console.error('Failed to load active rentals:', err)
      }
    }

    loadActiveRentals()
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
        const paymentSession = paymentTx.paymentSessionId
          ? await fetchPaymentSession(paymentTx.paymentSessionId, session.accessToken)
          : null
        const payments = paymentSession
          ? [{ amount: paymentSession.amount_paid }]
          : await fetchTransactionPayments(paymentTx.transactionId, session.accessToken)
        if (!isMounted) return

        const sum = (payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0)
        
        setInsertedAmount((prev) => {
          if (sum > prev) {
            setSecondsLeft(60) // reset the timer back to 60!
          }
          return sum
        })

        if (sum >= paymentTx.totalAmount || paymentSession?.status === 'Paid') {
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
  }, [paymentTx, hasTimedOut, session?.accessToken, selectedModuleId, addNotification, onNavigate])

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

  function returnActiveRental() {
    onNavigate('rent')
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

  function handleQuickRent() {
    const firstAvailable = lockers.find((locker) => locker.status === 'Available')
    if (firstAvailable) {
      openRental(firstAvailable)
    } else {
      setMessage('No lockers are currently available.')
    }
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
      const { transactionId, qrToken, paymentSession } = await createRental({
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
          paymentSessionId: paymentSession?.payment_session_id,
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
          setBalance(finalBalance)
          await syncWalletBalance(session, finalBalance)
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
    <main className={`page xml-page xml-home ${activeRentals.length === 0 ? 'no-active-rental' : ''}`}>
      <section className="page-header">
        <div>
          <h1 className="xml-app-title">CoinCubby</h1>
        </div>
      </section>

      <section className="xml-welcome-card">
        <p>WELCOME!</p>
        <h2>Pick your locker</h2>
        <span>Green means you're good to go.<br />Check status indicator below.</span>

        {/* Rate chips */}
        <div className="welcome-rates">
          <span className="rate-chip"><b>S</b> ₱10/hr</span>
          <span className="rate-chip"><b>M</b> ₱20/hr</span>
          <span className="rate-chip"><b>L</b> ₱30/hr</span>
        </div>

        {/* Rent Now button */}
        <button
          className="rent-now-button"
          type="button"
          onClick={() => lockerPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Rent Now
        </button>
      </section>

      {activeRentals.length > 0 && (
        <div className="home-rentals-container">
          {activeRentals.map((rental) => {
            const isOpen = !rental.end_time
            const startMs = parseTimestamp(rental.start_time)
            const endMs   = parseTimestamp(rental.end_time)
            const totalMs  = isOpen ? null : Math.max(1, endMs - startMs)
            const elapsedMs = Math.max(0, tick - startMs)
            const isOverdue = !isOpen && tick > endMs
            const overtimeMs = isOverdue ? Math.max(0, tick - endMs) : 0
            const remainMs  = isOpen ? 0 : Math.max(0, endMs - tick)
            const progress  = isOpen ? 100 : Math.min(100, (elapsedMs / totalMs) * 100)

            const sizeInfo     = sizeFromType(rental.lockers?.size_type_id)
            // Open time and overtime are billed at HALF the database rate
            const ratePerHr    = (Number(rental.rates?.price_per_hour) || sizeInfo.rate) / 2

            // Timer: elapsed for open, overtime elapsed for overdue, remaining for fixed-in-time
            const timerMs = isOpen ? elapsedMs : isOverdue ? overtimeMs : remainMs
            const timer   = formatDuration(timerMs)
            const timerLabel = isOpen ? 'ELAPSED' : isOverdue ? 'OVERTIME' : 'REMAINING'

            // Bill: use half-hour step formula (matches what is actually charged)
            const prepaidCost = isOpen ? 0 : (totalMs / 3600000) * ratePerHr

            function calcStepBill(elMs) {
              const mins = Math.floor(elMs / 60000)
              const hrs = Math.floor(mins / 60)
              const rem = mins % 60
              let mult = hrs
              if (rem > 0) mult += rem <= 30 ? 0.5 : 1.0
              return Math.floor(mult * ratePerHr)
            }

            const overtimeCost = calcStepBill(overtimeMs)
            const openCost     = calcStepBill(elapsedMs)
            const billLabel = isOpen
              ? `Bill: ${formatMoney(openCost, false)}`
              : isOverdue
                ? `Overtime Due: ${formatMoney(overtimeCost, false)}`
                : `Paid: ${formatMoney(prepaidCost, false)}`

            const lockerLabel = rental.lockers?.locker_number || rental.locker_id
            const sizeLabel   = sizeInfo.label
            return (
              <div
                className={`home-rental-bar-card${isOverdue ? ' home-rental-bar-card--overdue' : ''}`}
                key={rental.transaction_id}
              >
                {/* top row */}
                <div className="hbar-top">
                  <div className="hbar-info">
                    <span className="hbar-locker">{lockerLabel}</span>
                    <span className="hbar-size">{sizeLabel}</span>
                  </div>
                  <span className={`hbar-badge${isOverdue ? ' hbar-badge--overdue' : ''}`}>
                    <span className="hbar-dot" />
                    {isOverdue ? 'Overdue' : 'Active'}
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
                {/* return button */}
                <button
                  className="hbar-return-btn"
                  type="button"
                  onClick={() => returnActiveRental(rental)}
                >
                  Return Locker
                </button>
              </div>
            )
          })}
        </div>
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

      <section className="xml-locker-panel" ref={lockerPanelRef}>
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
                  Size: {selectedLocker.size} | Rate: {formatMoney(selectedLocker.rate, false)}/hr
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
                    await cancelPaymentSession(paymentTx.paymentSessionId, session.accessToken)
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
                    await cancelPaymentSession(paymentTx.paymentSessionId, session.accessToken)
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
