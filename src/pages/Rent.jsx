/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react'
import {
  completeRental,
  createReturnPaymentSession,
  fetchActiveRentals,
  fetchPaymentSession,
  formatMoney,
  parseTimestamp,
  sizeFromType,
  verifyPinAsPassword,
} from '../lib/supabase'
import { formatDateTime, formatDuration } from '../lib/time'
import AlertDialog from '../components/AlertDialog'

function mapRental(row) {
  const size = sizeFromType(row.lockers?.size_type_id)
  const startMs = parseTimestamp(row.start_time)
  const endMs = parseTimestamp(row.end_time)
  const isOpenTime = !row.end_time
  const ratePerHr = size.rate

  return {
    transactionId: row.transaction_id,
    lockerId: row.locker_id,
    lockerNumber: row.lockers?.locker_number || '?',
    deviceId: row.lockers?.device_id,
    sizeName: size.label,
    startMs,
    endMs,
    isOpenTime,
    ratePerHr,
    qrToken: row.qr_token || '-',
    durationMinutes: row.duration_minutes || 0,
  }
}

function calculateOvertimeFee(item, currentTick) {
  if (item.isOpenTime) {
    const durationMs = Math.max(0, currentTick - item.startMs)
    const durationMins = Math.floor(durationMs / 60000)
    return Math.floor((durationMins / 60) * item.ratePerHr)
  } else {
    if (currentTick <= item.endMs) return 0
    const overtimeMs = currentTick - item.endMs
    const overtimeMins = Math.floor(overtimeMs / 60000)
    return Math.floor((overtimeMins / 60) * item.ratePerHr)
  }
}

export default function Rent({ session, addNotification }) {
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(() => Date.now())
  const [activeReturnItem, setActiveReturnItem] = useState(null)
  const [payMethod, setPayMethod] = useState('Wallet')
  const [walletBalance, setWalletBalance] = useState(50)
  const [insertedAmount, setInsertedAmount] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [hasTimedOut, setHasTimedOut] = useState(false)

  const [isPasskeyVerified, setIsPasskeyVerified] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [pinVerificationError, setPinVerificationError] = useState('')
  const [verifyingPin, setVerifyingPin] = useState(false)

  function closeReturnModal() {
    setActiveReturnItem(null)
    setIsPasskeyVerified(false)
    setEnteredPin('')
    setPinVerificationError('')
    setVerifyingPin(false)
  }

  async function handleVerifyPinSubmit(event) {
    event.preventDefault()
    setPinVerificationError('')
    if (enteredPin.length !== 6) {
      return setPinVerificationError('PIN must be exactly 6 digits.')
    }

    setVerifyingPin(true)
    try {
      await verifyPinAsPassword(session.email, enteredPin)
      setIsPasskeyVerified(true)
    } catch {
      setPinVerificationError('Incorrect PIN. Please try again.')
    } finally {
      setVerifyingPin(false)
    }
  }

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

  // Countdown timer for return overtime pay at device
  useEffect(() => {
    if (!activeReturnItem || payMethod !== 'Device' || hasTimedOut || secondsLeft <= 0) return

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
  }, [activeReturnItem, payMethod, secondsLeft, hasTimedOut])

  useEffect(() => {
    if (
      !activeReturnItem ||
      !isPasskeyVerified ||
      payMethod !== 'Device' ||
      activeReturnItem.paymentSessionId ||
      activeReturnItem.paymentSessionStarting
    ) {
      return
    }

    let isMounted = true

    async function startDeviceReturnPayment() {
      const fee = calculateOvertimeFee(activeReturnItem, Date.now())
      if (fee <= 0) return

      setActiveReturnItem((current) =>
        current?.transactionId === activeReturnItem.transactionId
          ? { ...current, paymentSessionStarting: true }
          : current,
      )

      try {
        const paymentSession = await createReturnPaymentSession(
          { ...activeReturnItem, userId: session.userId },
          session.accessToken,
          fee,
        )

        if (!isMounted) return

        setActiveReturnItem((current) =>
          current?.transactionId === activeReturnItem.transactionId
            ? {
                ...current,
                paymentSessionId: paymentSession?.payment_session_id,
                paymentSessionStarting: false,
              }
            : current,
        )
      } catch (err) {
        if (!isMounted) return
        setMessage(err.message || 'Could not start device payment.')
        setPayMethod('Wallet')
        setActiveReturnItem((current) =>
          current?.transactionId === activeReturnItem.transactionId
            ? { ...current, paymentSessionStarting: false }
            : current,
        )
      }
    }

    startDeviceReturnPayment()

    return () => {
      isMounted = false
    }
  }, [activeReturnItem, isPasskeyVerified, payMethod, session?.accessToken, session?.userId])

  // Polling for cash insertions at the device during return
  useEffect(() => {
    if (!activeReturnItem || payMethod !== 'Device' || hasTimedOut || !activeReturnItem.paymentSessionId) return

    let isMounted = true
    const interval = setInterval(async () => {
      try {
        const paymentSession = await fetchPaymentSession(activeReturnItem.paymentSessionId, session.accessToken)
        if (!isMounted) return

        const sum = Number(paymentSession?.amount_paid || 0)
        
        setInsertedAmount((prev) => {
          if (sum > prev) {
            setSecondsLeft(60) // reset timer
          }
          return sum
        })

        const fee = calculateOvertimeFee(activeReturnItem, Date.now())
        if (sum >= fee || paymentSession?.status === 'Paid') {
          clearInterval(interval)

          // Reload wallet balance state from localStorage
          if (session?.userId) {
            const balanceKey = `coincubby.balance.${session.userId}`
            const stored = localStorage.getItem(balanceKey)
            if (stored !== null) setWalletBalance(Number(stored))
          }

          closeReturnModal()
          await loadRentals()
        }
      } catch (err) {
        console.error('Error polling return payments:', err)
      }
    }, 1500)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [activeReturnItem, payMethod, hasTimedOut, session?.accessToken, session?.userId, loadRentals])

  function handleContinuePayment() {
    setSecondsLeft(60)
    setHasTimedOut(false)
  }

  function initiateReturn(item) {
    setMessage('')
    const fee = calculateOvertimeFee(item, tick)
    setActiveReturnItem({
      ...item,
      overtimeFee: fee,
    })
    setPayMethod('Wallet')
    setInsertedAmount(0)
    setSecondsLeft(60)
    setHasTimedOut(false)

    try {
      const key = `coincubby.balance.${session?.userId}`
      const stored = localStorage.getItem(key)
      setWalletBalance(stored ? Number(stored) : 50.00)
    } catch {
      setWalletBalance(50.00)
    }
  }

  async function handleConfirmReturn() {
    if (!activeReturnItem) return
    setMessage('')

    const fee = calculateOvertimeFee(activeReturnItem, tick)
    if (fee > 0 && payMethod === 'Wallet') {
      if (walletBalance < fee) {
        return
      }

      try {
        const finalBalance = Math.max(0, walletBalance - fee)
        localStorage.setItem(`coincubby.balance.${session.userId}`, finalBalance.toFixed(2))
        setWalletBalance(finalBalance)

        await completeRental({ ...activeReturnItem, userId: session.userId }, session.accessToken, fee, 'Wallet')

        // Reload wallet balance state from localStorage
        if (session?.userId) {
          const balanceKey = `coincubby.balance.${session.userId}`
          const stored = localStorage.getItem(balanceKey)
          if (stored !== null) setWalletBalance(Number(stored))
        }

        closeReturnModal()
        await loadRentals()
      } catch (err) {
        setMessage(err.message || 'Failed to complete wallet payment return.')
      }
    } else if (fee === 0) {
      try {
        await completeRental({ ...activeReturnItem, userId: session.userId }, session.accessToken, 0, 'Device')

        if (addNotification) {
          addNotification({
            title: 'Locker Returned',
            content: `Locker ${activeReturnItem.lockerNumber} has been successfully returned.`,
            type: 'rental_end',
          })
        }

        // Reload wallet balance state from localStorage
        if (session?.userId) {
          const balanceKey = `coincubby.balance.${session.userId}`
          const stored = localStorage.getItem(balanceKey)
          if (stored !== null) setWalletBalance(Number(stored))
        }

        closeReturnModal()
        await loadRentals()
      } catch (err) {
        setMessage(err.message || 'Failed to complete return.')
      }
    }
  }

  function currentCost(item) {
    if (!item.isOpenTime) {
      const prepaidHours = Math.max(0, item.endMs - item.startMs) / 3600000
      const prepaid = prepaidHours * item.ratePerHr

      // Past end time → show accumulating overtime on top of prepaid
      if (tick > item.endMs) {
        const overtimeMs = Math.max(0, tick - item.endMs)
        const overtimeCost = Math.floor((overtimeMs / 3600000) * item.ratePerHr)
        return `Overtime Due: ${formatMoney(overtimeCost, false)}`
      }

      return `Prepaid: ${formatMoney(prepaid, false)}`
    }

    // Open time: accumulate live every second based on elapsed time
    const elapsedMs = Math.max(0, tick - item.startMs)
    const cost = Math.floor((elapsedMs / 3600000) * item.ratePerHr)
    return `Current Bill: ${formatMoney(cost, false)}`
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

      {message && (
        <AlertDialog
          type={message.includes('returned') ? 'success' : 'error'}
          message={message}
          onClose={() => setMessage('')}
        />
      )}
      {loading && <div className="xml-loading"><span></span><p>Loading rentals...</p></div>}
      {!loading && rentals.length === 0 && <p className="empty-state">No active rentals yet.</p>}

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
            ? 'ELAPSED TIME'
            : isOverdue
              ? 'OVERTIME'
              : 'TIME REMAINING'

          return (
            <article className={`rental-card${isOverdue ? ' rental-card--overdue' : ''}`} key={item.transactionId}>
              <div className="card-heading">
                <div>
                  <small>Locker</small>
                  <h2>{item.lockerNumber}</h2>
                  <p>{item.sizeName}</p>
                </div>
                <span className={isOverdue ? 'badge-overdue' : ''}>{isOverdue ? 'Overdue' : 'Active'}</span>
              </div>

              <div className="timer-box">
                <small>{timerLabel}</small>
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
              </dl>

              <button className="primary-button xml-black-button" type="button" onClick={() => initiateReturn(item)}>
                Return Locker
              </button>
            </article>
          )
        })}
        </section>

      {activeReturnItem && (() => {
        const overtimeMs = activeReturnItem.isOpenTime 
          ? Math.max(0, tick - activeReturnItem.startMs)
          : Math.max(0, tick - activeReturnItem.endMs)
        const overtimeFee = calculateOvertimeFee(activeReturnItem, tick)
        const hasOvertime = overtimeFee > 0

        return (
          <div className="modal-backdrop" role="presentation">
            <div className="rent-sheet xml-rent-sheet">
              <div className="sheet-title">
                <div>
                  <h2>Return Locker {activeReturnItem.lockerNumber}</h2>
                  <p className="muted">Size: {activeReturnItem.sizeName}</p>
                </div>
                <button className="icon-button" type="button" onClick={closeReturnModal}>
                  X
                </button>
              </div>

              {!isPasskeyVerified ? (
                <form onSubmit={handleVerifyPinSubmit} className="form-stack" style={{ display: 'grid', gap: '14px', marginTop: '8px' }}>
                  <p style={{ fontSize: '13px', color: '#666', textAlign: 'center', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                    For security, please enter your 6-digit Account PIN to confirm returning Locker #{activeReturnItem.lockerNumber}.
                  </p>
                  
                  <label className="xml-field">
                    <span>6-Digit Account PIN</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="6"
                      value={enteredPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setEnteredPin(val)
                      }}
                      placeholder="••••••"
                      autoFocus
                      disabled={verifyingPin}
                      required
                      style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2rem' }}
                    />
                  </label>

                  {pinVerificationError && (
                    <p className="alert" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>{pinVerificationError}</p>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                    <button className="secondary-button" type="button" onClick={closeReturnModal} disabled={verifyingPin}>
                      Cancel
                    </button>
                    <button className="primary-button xml-black-button" type="submit" disabled={verifyingPin || enteredPin.length !== 6}>
                      {verifyingPin ? 'Verifying...' : 'Verify PIN'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="return-details-card" style={{ display: 'grid', gap: '8px', padding: '14px', background: 'var(--white)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--gray)' }}>Prepaid Period:</span>
                      <strong>{activeReturnItem.isOpenTime ? 'None (Open Time)' : `${formatDuration(activeReturnItem.endMs - activeReturnItem.startMs)} prepaid`}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--gray)' }}>Status:</span>
                      <strong style={{ color: hasOvertime ? '#c62828' : '#2e7d32' }}>
                        {hasOvertime ? 'Payment Due' : activeReturnItem.isOpenTime ? 'No Charge' : 'Within Prepaid Time'}
                      </strong>
                    </div>
                    {hasOvertime && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: 'var(--gray)' }}>{activeReturnItem.isOpenTime ? 'Elapsed Duration' : 'Overtime Duration'}:</span>
                          <strong>{formatDuration(overtimeMs)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: 'var(--gray)' }}>Amount Due:</span>
                          <strong style={{ color: '#c62828' }}>{formatMoney(overtimeFee, false)}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  {hasOvertime ? (
                    <>
                      <p className="xml-section-label">Payment Method</p>
                      <div className="payment-options xml-payment-options">
                        <button
                          type="button"
                          className={`payment-opt-btn ${payMethod === 'Wallet' ? 'selected' : ''}`}
                          onClick={() => setPayMethod('Wallet')}
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: payMethod === 'Wallet' ? '2px solid var(--dark)' : '1px solid var(--line)',
                            background: payMethod === 'Wallet' ? 'var(--label-green)' : 'var(--white)',
                            fontWeight: '700',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          Pay via Wallet (Balance: {formatMoney(walletBalance)})
                        </button>
                        <button
                          type="button"
                          className={`payment-opt-btn ${payMethod === 'Device' ? 'selected' : ''}`}
                          onClick={() => {
                            setPayMethod('Device')
                            setInsertedAmount(0)
                            setSecondsLeft(60)
                            setHasTimedOut(false)
                          }}
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: payMethod === 'Device' ? '2px solid var(--dark)' : '1px solid var(--line)',
                            background: payMethod === 'Device' ? 'var(--label-green)' : 'var(--white)',
                            fontWeight: '700',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          Pay at Device
                        </button>
                      </div>

                      {payMethod === 'Wallet' && (
                        <>
                          {walletBalance < overtimeFee ? (
                            <div className="alert alert-danger" style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', textAlign: 'center', marginTop: '12px' }}>
                              Insufficient wallet balance. Please insert coins at the device to pay.
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                              <button className="secondary-button" type="button" onClick={closeReturnModal}>
                                Cancel
                              </button>
                              <button className="primary-button xml-black-button" type="button" onClick={handleConfirmReturn}>
                                Pay & Return
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {payMethod === 'Device' && (
                        <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
                          <div className="payment-status-card" style={{ margin: '0' }}>
                            <div className="amount-stat">
                              <span>Amount Due</span>
                              <strong>{formatMoney(overtimeFee, false)}</strong>
                            </div>
                            <div className="amount-stat">
                              <span>Inserted</span>
                              <strong className="inserted-text">{formatMoney(insertedAmount, false)}</strong>
                            </div>
                            <div className="amount-stat">
                              <span>Remaining</span>
                              <strong className="remaining-text">
                                {formatMoney(Math.max(0, overtimeFee - insertedAmount), false)}
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
                              {activeReturnItem.paymentSessionStarting && (
                                <p className="timer-text">Preparing the device payment screen...</p>
                              )}
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

                          <div className="action-row" style={{ marginTop: '8px' }}>
                            <button className="secondary-button" style={{ width: '100%' }} type="button" onClick={closeReturnModal}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                      <button className="secondary-button" type="button" onClick={closeReturnModal}>
                        Cancel
                      </button>
                      <button className="primary-button xml-black-button" type="button" onClick={handleConfirmReturn}>
                        Confirm Free Return
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })()}
    </main>
  )
}
