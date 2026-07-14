/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react'
import {
  completeRental,
  createReturnPaymentSession,
  fetchPaymentSession,
  fetchTransactionPayments,
  formatMoney,
  sizeFromType,
  syncWalletBalance,
  verifyPinAsPassword,
  mapRental,
} from '../lib/supabase'
import { formatDateTime, formatDuration } from '../lib/time'
import AlertDialog from '../components/AlertDialog'

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
  session,
  addNotification,
  activeRentals,
  walletBalance: balanceProp,
  loadingData,
  refreshAllData,
  t,
  lang,
}) {
  const rentals = activeRentals
  const walletBalance = balanceProp
  const loading = loadingData

  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(() => Date.now())
  const [activeReturnItem, setActiveReturnItem] = useState(null)
  const [payMethod, setPayMethod] = useState('Wallet')
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

  // Local data loader is no longer needed since it is polled globally

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
        const payments = paymentSession
          ? [{ amount: paymentSession.amount_paid }]
          : await fetchTransactionPayments(activeReturnItem.transactionId, session.accessToken)
        if (!isMounted) return

        const sum = (payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0)
        
        setInsertedAmount((prev) => {
          if (sum > prev) {
            setSecondsLeft(60) // reset timer
          }
          return sum
        })

        const fee = calculateOvertimeFee(activeReturnItem, Date.now())
        if (sum >= fee) {
          clearInterval(interval)
          closeReturnModal()
          await refreshAllData()
        }
      } catch (err) {
        console.error('Error polling return payments:', err)
      }
    }, 1500)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [activeReturnItem, payMethod, hasTimedOut, session?.accessToken, session?.userId, refreshAllData])

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
    if (session?.userId) {
      getOrCreateWallet(session).then((val) => {
        if (val !== null) setWalletBalance(val)
      })
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
        await syncWalletBalance(session, finalBalance)

        await completeRental({ ...activeReturnItem, userId: session.userId }, session.accessToken, fee, 'Wallet')

        closeReturnModal()
        await refreshAllData()
      } catch (err) {
        setMessage(lang === 'tl' ? 'Bigo sa pagkumpleto ng pagbabalik gamit ang wallet.' : (err.message || 'Failed to complete wallet payment return.'))
      }
    } else if (fee === 0) {
      try {
        await completeRental({ ...activeReturnItem, userId: session.userId }, session.accessToken, 0, 'Device')

        if (addNotification) {
          addNotification({
            title: lang === 'tl' ? 'Naibalik ang Locker' : 'Locker Returned',
            content: lang === 'tl'
              ? `Ang locker ${activeReturnItem.lockerNumber} ay matagumpay na naibalik.`
              : `Locker ${activeReturnItem.lockerNumber} has been successfully returned.`,
            type: 'rental_end',
          })
        }

        closeReturnModal()
        await refreshAllData()
      } catch (err) {
        setMessage(lang === 'tl' ? 'Bigo sa pagkumpleto ng pagbabalik.' : (err.message || 'Failed to complete return.'))
      }
    }
  }

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

      {message && (
        <AlertDialog
          type={message.includes('returned') ? 'success' : 'error'}
          message={message}
          onClose={() => setMessage('')}
        />
      )}
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

              <button className="primary-button xml-black-button" type="button" onClick={() => initiateReturn(item)}>
                {t('return_locker')}
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
                  <h2>{lang === 'tl' ? 'Ibalik ang Locker' : 'Return Locker'} {activeReturnItem.lockerNumber}</h2>
                  <p className="muted">{lang === 'tl' ? 'Laki' : 'Size'}: {activeReturnItem.sizeName}</p>
                </div>
                <button className="icon-button" type="button" onClick={closeReturnModal}>
                  X
                </button>
              </div>

              {!isPasskeyVerified ? (
                <form onSubmit={handleVerifyPinSubmit} className="form-stack" style={{ display: 'grid', gap: '14px', marginTop: '8px' }}>
                  <p style={{ fontSize: '13px', color: '#666', textAlign: 'center', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                    {t('security_pin_confirm')}
                  </p>
                  
                  <label className="xml-field">
                    <span>{lang === 'tl' ? '6-Digit na PIN ng Account' : '6-Digit Account PIN'}</span>
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
                      {t('cancel')}
                    </button>
                    <button className="primary-button xml-black-button" type="submit" disabled={verifyingPin || enteredPin.length !== 6}>
                      {verifyingPin ? t('verifying_pin') : t('confirm_pin_btn')}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="return-details-card" style={{ display: 'grid', gap: '8px', padding: '14px', background: 'var(--white)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--gray)' }}>{lang === 'tl' ? 'Bayad na Oras:' : 'Prepaid Period:'}</span>
                      <strong>{activeReturnItem.isOpenTime ? (lang === 'tl' ? 'Wala (Bukas na Oras)' : 'None (Open Time)') : `${formatDuration(activeReturnItem.endMs - activeReturnItem.startMs)} ${lang === 'tl' ? 'bayad na' : 'prepaid'}`}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--gray)' }}>{lang === 'tl' ? 'Katayuan:' : 'Status:'}</span>
                      <strong style={{ color: hasOvertime ? '#c62828' : '#2e7d32' }}>
                        {hasOvertime ? (lang === 'tl' ? 'Kailangang Bayaran' : 'Payment Due') : activeReturnItem.isOpenTime ? (lang === 'tl' ? 'Walang Bayad' : 'No Charge') : (lang === 'tl' ? 'Nasa Bayad na Oras' : 'Within Prepaid Time')}
                      </strong>
                    </div>
                    {hasOvertime && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: 'var(--gray)' }}>{activeReturnItem.isOpenTime ? (lang === 'tl' ? 'Nakalipas na Oras:' : 'Elapsed Duration:') : (lang === 'tl' ? 'Lumampas na Oras:' : 'Overtime Duration:')}</span>
                          <strong>{formatDuration(overtimeMs)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: 'var(--gray)' }}>{lang === 'tl' ? 'Halagang Dapat Bayaran:' : 'Amount Due:'}</span>
                          <strong style={{ color: '#c62828' }}>{formatMoney(overtimeFee, false)}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  {hasOvertime ? (
                    <>
                      <p className="xml-section-label">{t('payment_method')}</p>
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
                          {lang === 'tl' ? `Magbayad gamit ang Wallet (Balanse: ${formatMoney(walletBalance)})` : `Pay via Wallet (Balance: ${formatMoney(walletBalance)})`}
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
                          {t('pay_at_device')}
                        </button>
                      </div>

                      {payMethod === 'Wallet' && (
                        <>
                          {walletBalance < overtimeFee ? (
                            <div className="alert alert-danger" style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', textAlign: 'center', marginTop: '12px' }}>
                              {t('insufficient_wallet_overtime')}
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                              <button className="secondary-button" type="button" onClick={closeReturnModal}>
                                {t('cancel')}
                              </button>
                              <button className="primary-button xml-black-button" type="button" onClick={handleConfirmReturn}>
                                {lang === 'tl' ? 'Magbayad at Ibalik' : 'Pay & Return'}
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {payMethod === 'Device' && (
                        <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
                          <div className="payment-status-card" style={{ margin: '0' }}>
                            <div className="amount-stat">
                              <span>{lang === 'tl' ? 'Dapat Bayaran' : 'Amount Due'}</span>
                              <strong>{formatMoney(overtimeFee, false)}</strong>
                            </div>
                            <div className="amount-stat">
                              <span>{t('inserted')}</span>
                              <strong className="inserted-text">{formatMoney(insertedAmount, false)}</strong>
                            </div>
                            <div className="amount-stat">
                              <span>{t('remaining')}</span>
                              <strong className="remaining-text">
                                {formatMoney(Math.max(0, overtimeFee - insertedAmount), false)}
                              </strong>
                            </div>
                          </div>

                          {hasTimedOut ? (
                            <div className="timeout-container">
                              <p className="alert">{t('timeout_title')}</p>
                              <button
                                className="primary-button xml-black-button continue-payment-btn"
                                type="button"
                                onClick={handleContinuePayment}
                              >
                                {t('continue_payment')}
                              </button>
                            </div>
                          ) : (
                            <div className="timer-container">
                              {activeReturnItem.paymentSessionStarting && (
                                <p className="timer-text">{lang === 'tl' ? 'Inihahanda ang screen ng pagbabayad...' : 'Preparing the device payment screen...'}</p>
                              )}
                              <div className="progress-bar-bg">
                                <div 
                                  className="progress-bar-fill" 
                                  style={{ width: `${(secondsLeft / 60) * 100}%` }}
                                ></div>
                              </div>
                              <p className="timer-text">
                                {lang === 'tl' ? 'Mangyaring ihulog ang barya. Natitirang oras:' : 'Please insert cash. Time remaining:'} <strong>{secondsLeft}s</strong>
                              </p>
                            </div>
                          )}

                          <div className="action-row" style={{ marginTop: '8px' }}>
                            <button className="secondary-button" style={{ width: '100%' }} type="button" onClick={closeReturnModal}>
                              {t('cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                      <button className="secondary-button" type="button" onClick={closeReturnModal}>
                        {t('cancel')}
                      </button>
                      <button className="primary-button xml-black-button" type="button" onClick={handleConfirmReturn}>
                        {lang === 'tl' ? 'Kumpirmahin ang Libreng Pagbabalik' : 'Confirm Free Return'}
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
