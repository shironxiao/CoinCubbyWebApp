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
    qrToken: row.qr_token || '-',
    amount,
    paymentMethod: payments[0]?.payment_method || 'Device',
    status: row.status || 'Active',
    startTime: row.start_time,
    durationMinutes: row.duration_minutes || 0,
  }
}

export default function History({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [timeFilter, setTimeFilter] = useState('all') // 'all', 'today', 'week', 'month'
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'completed'

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

  return (
    <main className="page xml-page xml-history">
      <section className="xml-screen-header">
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
        <span>Token</span>
        <span>Amount</span>
        <span>Status</span>
      </section>

      {message && <p className="alert">{message}</p>}
      {loading && <div className="xml-loading"><span></span><p>Loading history...</p></div>}
      {!loading && items.length === 0 && <p className="empty-state">No rental history yet.</p>}
      {!loading && items.length > 0 && filteredItems.length === 0 && <p className="empty-state">No matching rentals found.</p>}

      <section className="history-list">
        {filteredItems.map((item) => (
          <article className="history-row" key={item.id}>
            <div>
              <strong>{item.lockerNumber}</strong>
            </div>
            <div>
              <span>{item.qrToken}</span>
            </div>
            <div>
              <strong>{item.amount > 0 ? formatMoney(item.amount) : '-'}</strong>
            </div>
            <div>
              <strong className={`status-badge ${item.status.toLowerCase()}`}>{item.status}</strong>
            </div>
            <p>Start: {formatDateTime(item.startTime)} <b>Size: {item.sizeName}</b> {item.durationMinutes ? formatMinutes(item.durationMinutes) : item.paymentMethod}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
