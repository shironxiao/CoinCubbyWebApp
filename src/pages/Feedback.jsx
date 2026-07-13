import { useEffect, useState } from 'react'
import { submitFeedback, fetchUserFeedback, fetchGlobalFeedback, hasFeedbackForTransaction } from '../lib/supabase'
import AlertDialog from '../components/AlertDialog'

const STAR = '★'
const STAR_EMPTY = '☆'

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="fb-stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`fb-star ${n <= (hovered || value) ? 'fb-star--on' : ''}`}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
        >
          {n <= (hovered || value) ? STAR : STAR_EMPTY}
        </button>
      ))}
    </div>
  )
}

function ratingLabel(r, lang) {
  const labels = {
    en: ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'],
    tl: ['', 'Napakasama', 'Masama', 'Pwede na', 'Mabuti', 'Napakagaling'],
  }
  return (labels[lang] || labels.en)[r] || ''
}

export default function FeedbackPage({ session, rentalHistory, loadingData, t, lang }) {
  const [activeTab, setActiveTab] = useState('my-feedback') // 'my-feedback' or 'global'
  const [pending, setPending] = useState([]) // completed rentals without feedback yet
  const [submitted, setSubmitted] = useState([]) // previously submitted feedback rows
  const [globalFeedback, setGlobalFeedback] = useState([]) // all feedback from all users
  const [loadingFb, setLoadingFb] = useState(true)
  const [loadingGlobal, setLoadingGlobal] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Per-row state: { [transactionId]: { rating, comment, saving, done } }
  const [rowState, setRowState] = useState({})

  function setRow(txId, patch) {
    setRowState((prev) => ({ ...prev, [txId]: { ...prev[txId], ...patch } }))
  }

  // Load User Feedback (Pending and Submitted)
  useEffect(() => {
    if (!session?.accessToken || !session?.userId || loadingData) return

    async function loadFeedback() {
      setLoadingFb(true)
      try {
        const fbRows = await fetchUserFeedback(session.userId, session.accessToken)
        setSubmitted(fbRows || [])
        const submittedTxIds = new Set((fbRows || []).map((r) => r.transaction_id))

        const completedPending = (rentalHistory || []).filter(
          (item) => item.status === 'Completed' && !submittedTxIds.has(item.id),
        )
        setPending(completedPending)

        setRowState((prev) => {
          const next = { ...prev }
          completedPending.forEach((item) => {
            if (!next[item.id]) next[item.id] = { rating: 5, comment: '', saving: false, done: false }
          })
          return next
        })
      } catch (err) {
        console.error('Failed to load feedback data:', err)
      } finally {
        setLoadingFb(false)
      }
    }

    loadFeedback()
  }, [session, rentalHistory, loadingData])

  // Load Global Feedback
  useEffect(() => {
    if (activeTab !== 'global' || !session?.accessToken) return

    async function loadGlobal() {
      setLoadingGlobal(true)
      try {
        const rows = await fetchGlobalFeedback(session.accessToken)
        setGlobalFeedback(rows || [])
      } catch (err) {
        console.error('Failed to load global feedback:', err)
      } finally {
        setLoadingGlobal(false)
      }
    }

    loadGlobal()
  }, [activeTab, session])

  async function handleSubmit(item) {
    const rs = rowState[item.id] || {}
    if (!rs.rating || rs.rating < 1) {
      setError(lang === 'tl' ? 'Mangyaring pumili ng rating.' : 'Please select a rating.')
      return
    }

    setRow(item.id, { saving: true })
    setError('')
    try {
      const already = await hasFeedbackForTransaction(item.id, session.accessToken)
      if (already) {
        setRow(item.id, { saving: false, done: true })
        return
      }

      await submitFeedback({
        transactionId: item.id,
        customerId: session.userId,
        rating: rs.rating,
        comment: rs.comment || '',
        token: session.accessToken,
      })

      setRow(item.id, { saving: false, done: true })
      setMessage(
        lang === 'tl'
          ? 'Salamat sa iyong feedback!'
          : 'Thank you for your feedback!',
      )
      setSubmitted((prev) => [
        {
          feedback_id: Date.now(),
          transaction_id: item.id,
          rating: rs.rating,
          comment: rs.comment || null,
          created_at: new Date().toISOString(),
          transactions: { lockers: { locker_number: item.lockerNumber } },
        },
        ...prev,
      ])
      setPending((prev) => prev.filter((p) => p.id !== item.id))
    } catch (err) {
      setRow(item.id, { saving: false })
      setError(err.message || (lang === 'tl' ? 'Nabigo ang pagsumite.' : 'Submission failed.'))
    }
  }

  const isLoadingUser = loadingData || loadingFb

  return (
    <main className="page xml-page feedback-page">
      <header className="xml-topbar">
        <strong>{t('feedback_title')}</strong>
      </header>

      {error && <AlertDialog type="error" message={error} onClose={() => setError('')} />}
      {message && <AlertDialog type="success" message={message} onClose={() => setMessage('')} />}

      {/* Navigation tabs */}
      <div className="fb-tabs">
        <button
          type="button"
          className={`fb-tab-btn ${activeTab === 'my-feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-feedback')}
        >
          {t('feedback_tab_my')}
        </button>
        <button
          type="button"
          className={`fb-tab-btn ${activeTab === 'global' ? 'active' : ''}`}
          onClick={() => setActiveTab('global')}
        >
          {t('feedback_tab_global')}
        </button>
      </div>

      {activeTab === 'my-feedback' ? (
        <>
          {/* ── PENDING FEEDBACK ────────────────────────────────── */}
          <section className="fb-section">
            <p className="fb-section-label">{t('feedback_pending_label')}</p>

            {isLoadingUser ? (
              <div className="fb-empty">{t('loading')}</div>
            ) : pending.length === 0 ? (
              <div className="fb-empty">{t('feedback_no_pending')}</div>
            ) : (
              <div className="fb-cards">
                {pending.map((item) => {
                  const rs = rowState[item.id] || { rating: 5, comment: '', saving: false, done: false }
                  if (rs.done) return null
                  return (
                    <div key={item.id} className="fb-card">
                      <div className="fb-card-header">
                        <span className="fb-locker-badge">
                          {lang === 'tl' ? 'Locker' : 'Locker'} {item.lockerNumber}
                        </span>
                        <span className="fb-status-badge">{item.sizeName}</span>
                      </div>

                      <StarPicker
                        value={rs.rating}
                        onChange={(v) => setRow(item.id, { rating: v })}
                      />
                      {rs.rating > 0 && (
                        <p className="fb-rating-label">{ratingLabel(rs.rating, lang)}</p>
                      )}

                      <textarea
                        className="fb-textarea"
                        rows={3}
                        maxLength={500}
                        placeholder={t('feedback_comment_placeholder')}
                        value={rs.comment}
                        onChange={(e) => setRow(item.id, { comment: e.target.value })}
                      />

                      <button
                        type="button"
                        className="primary-button xml-black-button fb-submit-btn"
                        disabled={rs.saving}
                        onClick={() => handleSubmit(item)}
                      >
                        {rs.saving ? t('processing') : t('feedback_submit')}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── SUBMITTED FEEDBACK ──────────────────────────────── */}
          {submitted.length > 0 && (
            <section className="fb-section">
              <p className="fb-section-label">{t('feedback_submitted_label')}</p>
              <div className="fb-cards">
                {submitted.map((fb) => {
                  const lockerNum = fb.transactions?.lockers?.locker_number || '?'
                  return (
                    <div key={fb.feedback_id} className="fb-card fb-card--done">
                      <div className="fb-card-header">
                        <span className="fb-locker-badge">
                          {lang === 'tl' ? 'Locker' : 'Locker'} {lockerNum}
                        </span>
                        <span className="fb-done-stars">
                          {[1, 2, 3, 4, 5].map((n) =>
                            n <= fb.rating ? (
                              <span key={n} className="fb-star fb-star--on">{STAR}</span>
                            ) : (
                              <span key={n} className="fb-star">{STAR_EMPTY}</span>
                            ),
                          )}
                        </span>
                      </div>
                      {fb.comment && <p className="fb-done-comment">{fb.comment}</p>}
                      <p className="fb-done-date">
                        {new Date(fb.created_at).toLocaleDateString(
                          lang === 'tl' ? 'fil-PH' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' },
                        )}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      ) : (
        /* ── GLOBAL FEEDBACK ─────────────────────────────────── */
        <section className="fb-section">
          <p className="fb-section-label">{t('feedback_global_label')}</p>

          {loadingGlobal ? (
            <div className="fb-empty">{t('loading')}</div>
          ) : globalFeedback.length === 0 ? (
            <div className="fb-empty">{t('feedback_no_global')}</div>
          ) : (
            <div className="fb-cards">
              {globalFeedback.map((fb) => {
                const reviewerName = fb.customers?.full_name || (lang === 'tl' ? 'Gagamit' : 'Verified Customer')
                return (
                  <div key={fb.feedback_id} className="fb-card fb-card--done">
                    <div className="fb-card-header">
                      <span className="fb-reviewer-name">{reviewerName}</span>
                      <span className="fb-done-stars">
                        {[1, 2, 3, 4, 5].map((n) =>
                          n <= fb.rating ? (
                            <span key={n} className="fb-star fb-star--on">{STAR}</span>
                          ) : (
                            <span key={n} className="fb-star">{STAR_EMPTY}</span>
                          ),
                        )}
                      </span>
                    </div>
                    {fb.comment && <p className="fb-done-comment">{fb.comment}</p>}
                    <p className="fb-done-date">
                      {new Date(fb.created_at).toLocaleDateString(
                        lang === 'tl' ? 'fil-PH' : 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' },
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
