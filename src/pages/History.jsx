import { useEffect, useMemo, useState } from 'react'
import { formatMoney, sizeFromType, mapHistory } from '../lib/supabase'
import { formatDateTime, formatMinutes } from '../lib/time'
import AlertDialog from '../components/AlertDialog'
import coinLogo from '../assets/coin_logo.png'

export default function History({
  session,
  rentalHistory,
  loadingData,
  refreshAllData,
  t,
  lang,
  onNavigate,
}) {
  const items = rentalHistory
  const loading = loadingData
  const [message, setMessage] = useState('')
  const [timeFilter, setTimeFilter] = useState('all') // 'all', 'today', 'week', 'month'
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'completed'
  const [selectedItem, setSelectedItem] = useState(null)
  const [receiptView, setReceiptView] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    setCurrentPage(1)
  }, [timeFilter, statusFilter])

  const filteredItems = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    // Current week's Sunday
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
    // 1st of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    return items.filter((item) => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        if (item.status.toLowerCase() !== statusFilter.toLowerCase()) {
          return false
        }
      }

      // 2. Time Filter
      if (timeFilter !== 'all') {
        const itemTime = new Date(item.startTime).getTime()
        if (Number.isNaN(itemTime)) return false

        if (timeFilter === 'today' && itemTime < todayStart) {
          return false
        }
        if (timeFilter === 'week' && itemTime < weekStart) {
          return false
        }
        if (timeFilter === 'month' && itemTime < monthStart) {
          return false
        }
      }

      return true
    })
  }, [items, timeFilter, statusFilter])

  const summary = useMemo(
    () => ({
      totalSpent: filteredItems.reduce((sum, item) => sum + item.amount, 0),
      completed: filteredItems.filter((item) => item.status === 'Completed').length,
    }),
    [filteredItems],
  )

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, currentPage])

  function closeModal() {
    setSelectedItem(null)
    setReceiptView(false)
  }

  return (
    <main className="page xml-page xml-history">
      <section className="xml-screen-header" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', width: '100%', flexWrap: 'wrap' }}>
        <h1>{t('rental_history')}</h1>
      </section>

      <section className="history-summary">
        <div>
          <strong>{filteredItems.length}</strong>
          <span>{lang === 'tl' ? 'Kabuuan ng Renta' : 'Total Rentals'}</span>
        </div>
        <div>
          <strong>{formatMoney(summary.totalSpent)}</strong>
          <span>{lang === 'tl' ? 'Kabuuan ng Gastos' : 'Total Spent'}</span>
        </div>
        <div>
          <strong>{summary.completed}</strong>
          <span>{t('completed')}</span>
        </div>
      </section>

      <section className="history-filters">
        <div className="filter-group">
          <label>{lang === 'tl' ? 'Panahon' : 'Time Period'}</label>
          <div className="filter-options">
            <button
              className={`filter-pill ${timeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTimeFilter('all')}
            >
              {lang === 'tl' ? 'Lahat ng Oras' : 'All Time'}
            </button>
            <button
              className={`filter-pill ${timeFilter === 'today' ? 'active' : ''}`}
              onClick={() => setTimeFilter('today')}
            >
              {lang === 'tl' ? 'Ngayong Araw' : 'Today'}
            </button>
            <button
              className={`filter-pill ${timeFilter === 'week' ? 'active' : ''}`}
              onClick={() => setTimeFilter('week')}
            >
              {lang === 'tl' ? 'Ngayong Linggo' : 'This Week'}
            </button>
            <button
              className={`filter-pill ${timeFilter === 'month' ? 'active' : ''}`}
              onClick={() => setTimeFilter('month')}
            >
              {lang === 'tl' ? 'Ngayong Buwan' : 'This Month'}
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>{t('status')}</label>
          <div className="filter-options">
            <button
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              {t('filter_all')}
            </button>
            <button
              className={`filter-pill ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              {t('filter_active')}
            </button>
            <button
              className={`filter-pill ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              {t('filter_completed')}
            </button>
          </div>
        </div>
      </section>

      <section className="xml-table-head">
        <span>{t('locker_label')}</span>
        <span>{t('amount')}</span>
        <span>{t('status')}</span>
      </section>

      {message && <AlertDialog type="error" message={message} onClose={() => setMessage('')} />}
      {loading && <div className="xml-loading"><span></span><p>{lang === 'tl' ? 'Naglo-load ng kasaysayan...' : 'Loading history...'}</p></div>}
      {!loading && items.length === 0 && <p className="empty-state">{t('no_history')}</p>}
      {!loading && items.length > 0 && filteredItems.length === 0 && <p className="empty-state">{t('no_matching_rentals')}</p>}

      <section className="history-list">
        {paginatedItems.map((item) => (
          <article
            className="history-row"
            key={item.id}
            onClick={() => { setSelectedItem(item); setReceiptView(false) }}
            style={{ cursor: 'pointer' }}
          >
            <div>
              <strong>{item.lockerNumber}</strong>
            </div>
            <div>
              <strong>{item.amount > 0 ? formatMoney(item.amount) : '-'}</strong>
            </div>
            <div>
              <strong className={`status-badge ${item.status.toLowerCase()}`}>{item.status === 'Active' ? t('filter_active') : item.status === 'Completed' ? t('completed') : item.status}</strong>
            </div>
            <p style={{ gridColumn: 'span 3', textAlign: 'left', paddingLeft: '12px' }}>
              {lang === 'tl' ? 'Simula: ' : 'Start: '} {formatDateTime(item.startTime)} <b>{lang === 'tl' ? 'Laki: ' : 'Size: '} {item.sizeName}</b> {item.durationMinutes ? formatMinutes(item.durationMinutes) : item.paymentMethod}
            </p>
          </article>
        ))}
      </section>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            aria-label="Previous page"
          >
            {lang === 'tl' ? '← Nakaraan' : '← Prev'}
          </button>
          <span className="pagination-info">
            {lang === 'tl' ? <>Pahina <strong>{currentPage}</strong> ng {totalPages}</> : <>Page <strong>{currentPage}</strong> of {totalPages}</>}
          </span>
          <button
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            aria-label="Next page"
          >
            {lang === 'tl' ? 'Susunod →' : 'Next →'}
          </button>
        </div>
      )}

      {selectedItem && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div className="rent-sheet xml-rent-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '0', gap: '0', overflow: 'hidden' }}>

            {!receiptView ? (
              /* ── Details view ── */
              <div style={{ padding: '24px', display: 'grid', gap: '16px' }}>
                <div className="sheet-title" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '12px', marginBottom: '0' }}>
                  <h2>{t('details')}</h2>
                  <p className="muted" style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px' }}>ID: {selectedItem.id}</p>
                  <button className="icon-button" type="button" onClick={closeModal}>X</button>
                </div>

                <div style={{ display: 'grid', gap: '14px', color: 'var(--dark)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '13px' }}>{t('locker_label')}</span>
                    <strong style={{ fontSize: '15px' }}>{lang === 'tl' ? 'Locker' : 'Locker'} #{selectedItem.lockerNumber} ({selectedItem.sizeName})</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '13px' }}>{t('status')}</span>
                    <span className={`status-badge ${selectedItem.status.toLowerCase()}`} style={{ margin: 0, padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold' }}>
                      {selectedItem.status === 'Active' ? t('filter_active') : selectedItem.status === 'Completed' ? t('completed') : selectedItem.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '13px' }}>{t('start_time')}</span>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{formatDateTime(selectedItem.startTime)}</span>
                  </div>

                  {selectedItem.endTime && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: '13px' }}>{t('end_time')}</span>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{formatDateTime(selectedItem.endTime)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '13px' }}>{t('duration')}</span>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>
                      {selectedItem.durationMinutes ? formatMinutes(selectedItem.durationMinutes) : (lang === 'tl' ? 'Walang Takdang Oras' : 'Open-Ended')}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px dashed rgba(0,0,0,0.08)', marginTop: '8px', paddingTop: '12px' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '13px' }}>{t('payment_method')}</span>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{selectedItem.paymentMethod === 'Wallet' ? t('wallet') : t('pay_at_device')}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '13px', fontWeight: '600' }}>{lang === 'tl' ? 'Kabuuan ng Bayad' : 'Total Amount Paid'}</span>
                    <strong style={{ fontSize: '16px', color: '#4cd964' }}>{formatMoney(selectedItem.amount)}</strong>
                  </div>

                  {selectedItem.paymentsList && selectedItem.paymentsList.length > 1 && (
                    <div style={{ marginTop: '4px', background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>{lang === 'tl' ? 'Detalye ng Pagbabayad' : 'Payment Breakdown'}</span>
                      {selectedItem.paymentsList.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#555' }}>
                          <span>{lang === 'tl' ? 'Pagbabayad' : 'Payment'} #{idx + 1} ({p.payment_method === 'Wallet' ? t('wallet') : t('pay_at_device')})</span>
                          <strong>{formatMoney(p.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* View Receipt — available for both Active and Completed */}
                  <button
                    className="primary-button xml-black-button"
                    style={{ width: '100%', marginTop: '4px' }}
                    type="button"
                    onClick={() => setReceiptView(true)}
                  >
                    {lang === 'tl' ? '🧾 Tingnan ang Resibo' : '🧾 View Receipt'}
                  </button>

                  {selectedItem.status === 'Completed' && (
                    <button
                      className="primary-button xml-black-button"
                      style={{ width: '100%', marginTop: '0' }}
                      type="button"
                      onClick={() => {
                        closeModal()
                        onNavigate('feedback')
                      }}
                    >
                      {lang === 'tl' ? 'Magbigay ng Feedback' : 'Give Feedback'}
                    </button>
                  )}

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={closeModal}
                    style={{ width: '100%', marginTop: '0' }}
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Receipt view ── */
              <div style={{ display: 'grid', gap: '0' }}>
                {/* Receipt header */}
                <div style={{
                  background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                  padding: '28px 24px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <img
                    src={coinLogo}
                    alt="CoinCubby"
                    style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '12px' }}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#fff', fontWeight: '800', fontSize: '18px', margin: 0, letterSpacing: '-0.3px' }}>CoinCubby</p>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '2px 0 0' }}>
                      {lang === 'tl' ? 'Opisyal na Resibo ng Renta' : 'Official Rental Receipt'}
                    </p>
                  </div>
                  <span className={`status-badge ${selectedItem.status.toLowerCase()}`} style={{ margin: 0, padding: '4px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {selectedItem.status === 'Active' ? t('filter_active') : selectedItem.status === 'Completed' ? t('completed') : selectedItem.status}
                  </span>
                </div>

                {/* Tear line */}
                <div style={{ position: 'relative', height: '20px', background: '#f5f5f5', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: '-10px', left: '-5px', right: '-5px',
                    borderTop: '2px dashed rgba(0,0,0,0.15)',
                  }} />
                  {/* Semicircle notches */}
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} style={{
                      position: 'absolute', top: '-8px', left: `${6 + i * 7}%`,
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: 'var(--card-bg, #fff)',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }} />
                  ))}
                </div>

                {/* Receipt body */}
                <div style={{ background: '#f5f5f5', padding: '20px 24px 0' }}>
                  {/* Transaction ID */}
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <p style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
                      {lang === 'tl' ? 'ID ng Transaksyon' : 'Transaction ID'}
                    </p>
                    <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#555', wordBreak: 'break-all', margin: 0 }}>{selectedItem.id}</p>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    {/* Locker */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>{t('locker_label')}</span>
                      <strong style={{ color: '#1a1a1a' }}>#{selectedItem.lockerNumber} · {selectedItem.sizeName}</strong>
                    </div>

                    {/* Start time */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>{t('start_time')}</span>
                      <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{formatDateTime(selectedItem.startTime)}</span>
                    </div>

                    {/* End time */}
                    {selectedItem.endTime && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#777' }}>{t('end_time')}</span>
                        <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{formatDateTime(selectedItem.endTime)}</span>
                      </div>
                    )}

                    {/* Duration */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>{t('duration')}</span>
                      <span style={{ color: '#1a1a1a', fontWeight: '500' }}>
                        {selectedItem.durationMinutes ? formatMinutes(selectedItem.durationMinutes) : (lang === 'tl' ? 'Walang Takdang Oras' : 'Open-Ended')}
                      </span>
                    </div>

                    {/* Payment method */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#777' }}>{t('payment_method')}</span>
                      <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{selectedItem.paymentMethod === 'Wallet' ? t('wallet') : t('pay_at_device')}</span>
                    </div>

                    {/* Payment breakdown */}
                    {selectedItem.paymentsList && selectedItem.paymentsList.length > 1 && (
                      <div style={{ background: 'rgba(0,0,0,0.04)', padding: '10px', borderRadius: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>{lang === 'tl' ? 'Detalye ng Pagbabayad' : 'Payment Breakdown'}</span>
                        {selectedItem.paymentsList.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#555' }}>
                            <span>{lang === 'tl' ? 'Pagbabayad' : 'Payment'} #{idx + 1} ({p.payment_method === 'Wallet' ? t('wallet') : t('pay_at_device')})</span>
                            <strong>{formatMoney(p.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div style={{
                    marginTop: '16px',
                    borderTop: '2px dashed rgba(0,0,0,0.12)',
                    paddingTop: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#1a1a1a' }}>
                      {lang === 'tl' ? 'KABUUANG BAYAD' : 'TOTAL PAID'}
                    </span>
                    <strong style={{ fontSize: '22px', color: '#1a1a1a', letterSpacing: '-0.5px' }}>
                      {formatMoney(selectedItem.amount)}
                    </strong>
                  </div>

                  {/* Footer */}
                  <div style={{ textAlign: 'center', padding: '16px 0 20px', marginTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.10)' }}>
                    <p style={{ fontSize: '11px', color: '#aaa', margin: 0 }}>
                      {lang === 'tl' ? 'Salamat sa paggamit ng CoinCubby!' : 'Thank you for using CoinCubby!'}
                    </p>
                    <p style={{ fontSize: '10px', color: '#bbb', margin: '4px 0 0' }}>Hannah's Shop</p>
                  </div>
                </div>

                {/* Tear line bottom */}
                <div style={{ position: 'relative', height: '20px', background: '#f5f5f5', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', bottom: '-10px', left: '-5px', right: '-5px', borderTop: '2px dashed rgba(0,0,0,0.15)' }} />
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} style={{
                      position: 'absolute', bottom: '-8px', left: `${6 + i * 7}%`,
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: 'var(--card-bg, #fff)',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }} />
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ padding: '16px 24px 24px', display: 'grid', gap: '10px' }}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setReceiptView(false)}
                    style={{ width: '100%' }}
                  >
                    ← {lang === 'tl' ? 'Bumalik sa Mga Detalye' : 'Back to Details'}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={closeModal}
                    style={{ width: '100%' }}
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
