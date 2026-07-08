import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatMoney, sizeFromType, mapHistory } from '../lib/supabase'
import { formatDateTime, formatMinutes } from '../lib/time'
import AlertDialog from '../components/AlertDialog'

export default function History({
  session,
  rentalHistory,
  loadingData,
  refreshAllData,
  t,
  lang,
}) {
  const items = rentalHistory
  const loading = loadingData
  const [message, setMessage] = useState('')
  const [timeFilter, setTimeFilter] = useState('all') // 'all', 'today', 'week', 'month'
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'completed'
  const [selectedItem, setSelectedItem] = useState(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8
  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`coincubby.deleted_transactions.${session?.userId}`)) || []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (session?.userId) {
      try {
        const stored = JSON.parse(localStorage.getItem(`coincubby.deleted_transactions.${session.userId}`)) || []
        setDeletedIds(stored)
      } catch {
        setDeletedIds([])
      }
    } else {
      setDeletedIds([])
    }
  }, [session?.userId])

  function handleDeleteItem(id) {
    const updated = [...deletedIds, id]
    setDeletedIds(updated)
    if (session?.userId) {
      localStorage.setItem(`coincubby.deleted_transactions.${session.userId}`, JSON.stringify(updated))
    }
    setSelectedItem(null)
    setIsConfirmingDelete(false)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [timeFilter, statusFilter])

  // Data is loaded and synced globally

  const filteredItems = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    // Current week's Sunday
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
    // 1st of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    return items.filter((item) => {
      // Exclude soft-deleted transactions
      if (deletedIds.includes(item.id)) {
        return false
      }

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
  }, [items, timeFilter, statusFilter, deletedIds])

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
            onClick={() => setSelectedItem(item)}
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
        <div className="modal-backdrop" role="presentation" onClick={() => {
          setSelectedItem(null)
          setIsConfirmingDelete(false)
        }}>
          <div className="rent-sheet xml-rent-sheet" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', gap: '16px' }}>
            <div className="sheet-title" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', paddingBottom: '12px', marginBottom: '8px' }}>
              <h2>{isConfirmingDelete ? (lang === 'tl' ? 'Burahin ang Record?' : 'Delete Record?') : t('details')}</h2>
              <p className="muted" style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px' }}>ID: {selectedItem.id}</p>
              <button className="icon-button" type="button" onClick={() => {
                setSelectedItem(null)
                setIsConfirmingDelete(false)
              }}>
                X
              </button>
            </div>

            {!isConfirmingDelete ? (
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

                <div style={{ borderTop: '1px dashed rgba(0, 0, 0, 0.08)', marginTop: '8px', paddingTop: '12px' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>{t('payment_method')}</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{selectedItem.paymentMethod === 'Wallet' ? t('wallet') : t('pay_at_device')}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px', fontWeight: '600' }}>{lang === 'tl' ? 'Kabuuan ng Bayad' : 'Total Amount Paid'}</span>
                  <strong style={{ fontSize: '16px', color: '#4cd964' }}>{formatMoney(selectedItem.amount)}</strong>
                </div>

                {selectedItem.paymentsList && selectedItem.paymentsList.length > 1 && (
                  <div style={{ marginTop: '4px', background: 'rgba(0, 0, 0, 0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.05)' }}>
                    <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>{lang === 'tl' ? 'Detalye ng Pagbabayad' : 'Payment Breakdown'}</span>
                    {selectedItem.paymentsList.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#555' }}>
                        <span>{lang === 'tl' ? 'Pagbabayad' : 'Payment'} #{idx + 1} ({p.payment_method === 'Wallet' ? t('wallet') : t('pay_at_device')})</span>
                        <strong>{formatMoney(p.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                  <button className="secondary-button" type="button" onClick={() => setSelectedItem(null)}>
                    {t('close')}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {lang === 'tl' ? 'Burahin ang Record' : 'Delete Record'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px', textAlign: 'center', color: 'var(--dark)', padding: '10px 0' }}>
                <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                <p className="muted" style={{ fontSize: '13px', lineHeight: '1.4' }}>
                  {lang === 'tl' ? 'Sigurado ka bang gusto mong alisin ang transaksyong ito sa iyong history view?' : 'Are you sure you want to remove this transaction from your history view?'}
                  <br />
                  <strong style={{ color: '#ff3b30' }}>{lang === 'tl' ? 'Itatago lamang nito ang transaksyon mula sa iyong view at hindi buburahin ang tala sa database.' : 'This will only hide it from your view and does not delete the database record.'}</strong>
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {lang === 'tl' ? 'Oo, Burahin' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear All Modal has been removed as pagination was added instead */}
    </main>
  )
}
