/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  activateRental,
  cancelPaymentSession,
  createRental,
  fetchPaymentSession,
  fetchTransactionPayments,
  formatMoney,
  parseTimestamp,
  sizeFromType,
  syncWalletBalance,
  updateLockerStatus,
} from '../lib/supabase'
import { formatDuration } from '../lib/time'
import AlertDialog from '../components/AlertDialog'

function statusClass(status) {
  return String(status || 'Available').toLowerCase().replaceAll(' ', '-')
}

export default function Home({
  session,
  onNavigate,
  addNotification,
  modules,
  selectedModuleId,
  setSelectedModuleId,
  lockers,
  walletBalance,
  activeRentals,
  ratesMap,
  loadingData,
  refreshAllData,
  t,
  lang,
}) {
  const lockerPanelRef = useRef(null)
  const [selectedLocker, setSelectedLocker] = useState(null)
  const [duration, setDuration] = useState('1')
  const [rentalType, setRentalType] = useState('fixed')
  const [paymentMethod, setPaymentMethod] = useState('Wallet')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [paymentTx, setPaymentTx] = useState(null)
  const [insertedAmount, setInsertedAmount] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [hasTimedOut, setHasTimedOut] = useState(false)
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
          await refreshAllData()
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

  function returnActiveRental() {
    onNavigate('rent')
  }

  function openRental(locker) {
    if (locker.status !== 'Available') {
      setMessage(lang === 'tl' ? `Hindi bakante ang Locker ${locker.id}.` : `Locker ${locker.id} is not available.`)
      return
    }

    setSelectedLocker(locker)
    setDuration('1')
    setRentalType('fixed')
    setPaymentMethod('Wallet')
  }

  function handleQuickRent() {
    const firstAvailable = filteredLockers.find((locker) => locker.status === 'Available')
    if (firstAvailable) {
      openRental(firstAvailable)
    } else {
      setMessage(lang === 'tl' ? 'Walang bakanteng mga locker sa kasalukuyan.' : 'No lockers are currently available.')
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
            title: lang === 'tl' ? 'Locker na Narentahan' : 'Locker Rented',
            content: lang === 'tl'
              ? `Ang locker ${selectedLocker.id} (${selectedLocker.size}) ay aktibo na. PIN: ${qrToken}`
              : `Locker ${selectedLocker.id} (${selectedLocker.size}) is active. PIN: ${qrToken}`,
            type: 'rental_start',
          })
        }

        // Deduct from wallet if paid via Wallet
        if (paymentMethod === 'Wallet' && !isOpenTime) {
          const finalBalance = Math.max(0, balance - total)
          await syncWalletBalance(session, finalBalance)
        }

        setSelectedLocker(null)
        await refreshAllData()
        onNavigate('rent')
      }
    } catch (err) {
      setMessage(lang === 'tl' ? 'Hindi mai-save ang renta. Pakisuri kung may device na nakakonekta.' : (err.message || 'Could not save rental.'))
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

        {/* Rent Now button */}
        <button
          className="rent-now-button"
          type="button"
          onClick={() => lockerPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {lang === 'tl' ? 'Rentahan Na' : 'Rent Now'}
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
            const ratePerHr    = sizeInfo.rate

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
              ? `${lang === 'tl' ? 'Kabayaran' : 'Bill'}: ${formatMoney(openCost, false)}`
              : isOverdue
                ? `${lang === 'tl' ? 'May Labis na Oras' : 'Overtime Due'}: ${formatMoney(overtimeCost, false)}`
                : `${lang === 'tl' ? 'Bayad' : 'Paid'}: ${formatMoney(prepaidCost, false)}`

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
                {/* return button */}
                <button
                  className="hbar-return-btn"
                  type="button"
                  onClick={() => returnActiveRental(rental)}
                >
                  {t('return_locker')}
                </button>
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

      {message && <AlertDialog type="error" message={message} onClose={() => setMessage('')} />}
      {loading ? (
        <p className="muted">{t('loading_lockers')}</p>
      ) : (
        <div className="locker-grid">
          {filteredLockers.map((locker) => (
            <button
              key={locker.dbId}
              className={`locker-tile ${statusClass(locker.status)}`}
              type="button"
              onClick={() => openRental(locker)}
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
                <h2>{lang === 'tl' ? 'Rentahan ang Locker' : 'Rent Locker'} {selectedLocker.id}</h2>
                <p className="muted">
                  {t('size_label')}: {selectedLocker.size} | {t('rate_label')}: {formatMoney(selectedLocker.rate, false)}/hr
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedLocker(null)}>
                X
              </button>
            </div>

            <p className="xml-section-label">{lang === 'tl' ? 'Uri ng Renta' : 'Rental Type'}</p>
            <div className="segmented xml-radio-row">
              <button
                type="button"
                className={rentalType === 'fixed' ? 'active' : ''}
                onClick={() => {
                  setRentalType('fixed')
                  setPaymentMethod('Wallet')
                }}
              >
                {lang === 'tl' ? 'Takdang Oras' : 'Fixed Duration'}
              </button>
              <button
                type="button"
                className={rentalType === 'open' ? 'active' : ''}
                onClick={() => {
                  setRentalType('open')
                  setPaymentMethod('Device')
                }}
              >
                {t('open_time')}
              </button>
            </div>

            {rentalType === 'fixed' && (
              <label className="xml-field plain">
                <span>{lang === 'tl' ? 'Tagal' : 'Duration'}</span>
                <input
                  min="1"
                  type="number"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </label>
            )}

            {rentalType === 'fixed' ? (
              <>
                <p className="xml-section-label">{t('payment_method')}</p>
                <div className="payment-options xml-payment-options">
                  <button
                    type="button"
                    className={paymentMethod === 'Wallet' ? 'selected' : ''}
                    onClick={() => setPaymentMethod('Wallet')}
                  >
                    {t('wallet')} ({formatMoney(total || selectedLocker.rate)})
                  </button>
                  <button
                    type="button"
                    className={paymentMethod === 'Device' ? 'selected' : ''}
                    onClick={() => setPaymentMethod('Device')}
                  >
                    {t('pay_at_device')}
                  </button>
                </div>

                <div className="total-row">
                  <span>{lang === 'tl' ? 'Kabuuan' : 'Total Amount'}</span>
                  <strong>{formatMoney(total)}</strong>
                </div>
              </>
            ) : (
              <div style={{ background: 'var(--label-green, #e8f5e9)', border: '1px solid #a5d6a7', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#2e7d32', lineHeight: '1.5' }}>
                💡 <strong>{lang === 'tl' ? 'Magbayad pagbalik.' : 'Pay on return.'}</strong> {lang === 'tl' ? 'Sisingilin ka ng kalahati ng halaga bawat oras kapag ibinalik mo ang locker.' : 'You will be billed at half the hourly rate when you return the locker.'}
              </div>
            )}

            <div className="action-row">
              <button className="secondary-button" type="button" onClick={() => setSelectedLocker(null)}>
                {t('cancel')}
              </button>
              <button className="primary-button xml-black-button" type="submit" disabled={saving}>
                {saving ? t('processing') : rentalType === 'open' ? (lang === 'tl' ? 'Simulan ang Renta' : 'Start Rental') : (lang === 'tl' ? 'Kumpirmahin ang Renta' : 'Confirm Rental')}
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
                <h2>{lang === 'tl' ? 'Ihulog ang Pera sa Kiosk' : 'Insert Money at Device'}</h2>
                <p className="muted">{lang === 'tl' ? 'Locker' : 'Locker'} {paymentTx.lockerNumber} · {lang === 'tl' ? 'Naghihintay ng Bayad' : 'Payment Pending'}</p>
              </div>
              <button 
                className="icon-button" 
                type="button" 
                onClick={async () => {
                  try {
                    await cancelPaymentSession(paymentTx.paymentSessionId, session.accessToken)
                    await updateLockerStatus(paymentTx.lockerId, 'Available', session.accessToken)
                    await refreshAllData()
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
                <span>{lang === 'tl' ? 'Dapat Bayaran' : 'Total Due'}</span>
                <strong>{formatMoney(paymentTx.totalAmount)}</strong>
              </div>
              <div className="amount-stat">
                <span>{t('inserted')}</span>
                <strong className="inserted-text">{formatMoney(insertedAmount)}</strong>
              </div>
              <div className="amount-stat">
                <span>{t('remaining')}</span>
                <strong className="remaining-text">
                  {formatMoney(Math.max(0, paymentTx.totalAmount - insertedAmount))}
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

            <div className="action-row">
              <button 
                className="secondary-button" 
                type="button" 
                onClick={async () => {
                  try {
                    await cancelPaymentSession(paymentTx.paymentSessionId, session.accessToken)
                    await updateLockerStatus(paymentTx.lockerId, 'Available', session.accessToken)
                    await refreshAllData()
                  } catch (err) {
                    console.error('Error cancelling rental payment:', err)
                  }
                  setPaymentTx(null)
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
