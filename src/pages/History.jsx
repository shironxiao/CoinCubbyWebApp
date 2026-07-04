/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchRentalHistory, formatMoney, sizeFromType } from '../lib/supabase'
import { formatDateTime, formatMinutes } from '../lib/time'

function mapHistory(row) {
  const payments = row.payments || []
  const amount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const size = sizeFromType(row.lockers?.size_type_id)

  return {
    id: row.transaction_id,
    lockerNumber: row.lockers?.locker_number || '?',
    sizeName: size.label,
    amount,
    paymentMethod: payments[0]?.payment_method || 'Device',
    status: row.status || 'Active',
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes || 0,
    paymentsList: payments,
  }
}

export default function History({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
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

  const loadHistory = useCallback(async () => {
    if (!session?.userId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const rows = await fetchRentalHistory(session.userId, session.accessToken)
      setItems((rows || []).map(mapHistory))
    } catch (err) {
      setMessage(err.message || 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [session?.accessToken, session?.userId])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

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
        <h1>Rental History</h1>
      </section>

      <section className="history-summary">
        <div>
          <strong>{filteredItems.length}</strong>
          <span>Total Rentals</span>
        </div>
        <div>
          <strong>{formatMoney(summary.totalSpent)}</strong>
          <span>Total Spent</span>
        </div>
        <div>
          <strong>{summary.completed}</strong>
          <span>Completed</span>
        </div>
      </section>

      <section className="history-filters">
        <div className="filter-group">
          <label>Time Period</label>
          <div className="filter-options">
            <button
              className={`filter-pill ${timeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTimeFilter('all')}
            >
              All Time
            </button>
            <button
              className={`filter-pill ${timeFilter === 'today' ? 'active' : ''}`}
              onClick={() => setTimeFilter('today')}
            >
              Today
            </button>
            <button
              className={`filter-pill ${timeFilter === 'week' ? 'active' : ''}`}
              onClick={() => setTimeFilter('week')}
            >
              This Week
            </button>
            <button
              className={`filter-pill ${timeFilter === 'month' ? 'active' : ''}`}
              onClick={() => setTimeFilter('month')}
            >
              This Month
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <div className="filter-options">
            <button
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-pill ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              className={`filter-pill ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              Completed
            </button>
          </div>
        </div>
      </section>

      <section className="xml-table-head">
        <span>Locker</span>
        <span>Amount</span>
        <span>Status</span>
      </section>

      {message && <p className="alert">{message}</p>}
      {loading && <div className="xml-loading"><span></span><p>Loading history...</p></div>}
      {!loading && items.length === 0 && <p className="empty-state">No rental history yet.</p>}
      {!loading && items.length > 0 && filteredItems.length === 0 && <p className="empty-state">No matching rentals found.</p>}

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
              <strong className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</strong>
            </div>
            <p style={{ gridColumn: 'span 3', textAlign: 'left', paddingLeft: '12px' }}>
              Start: {formatDateTime(item.startTime)} <b>Size: {item.sizeName}</b> {item.durationMinutes ? formatMinutes(item.durationMinutes) : item.paymentMethod}
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
            &larr; Prev
          </button>
          <span className="pagination-info">
            Page <strong>{currentPage}</strong> of {totalPages}
          </span>
          <button
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            aria-label="Next page"
          >
            Next &rarr;
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
              <h2>{isConfirmingDelete ? 'Delete Record?' : 'Transaction Details'}</h2>
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
                  <span style={{ color: '#888', fontSize: '13px' }}>Locker</span>
                  <strong style={{ fontSize: '15px' }}>Locker #{selectedItem.lockerNumber} ({selectedItem.sizeName})</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Status</span>
                  <span className={`status-badge ${selectedItem.status.toLowerCase()}`} style={{ margin: 0, padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold' }}>
                    {selectedItem.status}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Start Time</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{formatDateTime(selectedItem.startTime)}</span>
                </div>

                {selectedItem.endTime && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '13px' }}>End Time</span>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{formatDateTime(selectedItem.endTime)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Duration</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>
                    {selectedItem.durationMinutes ? formatMinutes(selectedItem.durationMinutes) : 'Open-Ended'}
                  </span>
                </div>

                <div style={{ borderTop: '1px dashed rgba(0, 0, 0, 0.08)', marginTop: '8px', paddingTop: '12px' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Payment Method</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{selectedItem.paymentMethod}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '13px', fontWeight: '600' }}>Total Amount Paid</span>
                  <strong style={{ fontSize: '16px', color: '#4cd964' }}>{formatMoney(selectedItem.amount)}</strong>
                </div>

                {selectedItem.paymentsList && selectedItem.paymentsList.length > 1 && (
                  <div style={{ marginTop: '4px', background: 'rgba(0, 0, 0, 0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.05)' }}>
                    <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Payment Breakdown</span>
                    {selectedItem.paymentsList.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#555' }}>
                        <span>Payment #{idx + 1} ({p.payment_method || 'Device'})</span>
                        <strong>{formatMoney(p.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                  <button className="secondary-button" type="button" onClick={() => setSelectedItem(null)}>
                    Close
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Delete Record
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px', textAlign: 'center', color: 'var(--dark)', padding: '10px 0' }}>
                <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                <p className="muted" style={{ fontSize: '13px', lineHeight: '1.4' }}>
                  Are you sure you want to remove this transaction from your history view?
                  <br />
                  <strong style={{ color: '#ff3b30' }}>This will only hide it from your view and does not delete the database record.</strong>
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Yes, Delete
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
