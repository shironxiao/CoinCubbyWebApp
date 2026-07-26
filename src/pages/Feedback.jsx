import { useEffect, useRef, useState } from 'react'
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
  const [activeTab, setActiveTab] = useState('my-feedback')
  const [pending, setPending] = useState([])
  const [submitted, setSubmitted] = useState([])
  const [globalFeedback, setGlobalFeedback] = useState([])
  const [loadingFb, setLoadingFb] = useState(true)
  const [loadingGlobal, setLoadingGlobal] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [genRating, setGenRating] = useState(5)
  const [genComment, setGenComment] = useState('')
  const [submittingGen, setSubmittingGen] = useState(false)

  // Per-row state: { [transactionId]: { rating, comment, saving, done } }
  const [rowState, setRowState] = useState({})

  // Keep a ref to rentalHistory so the effect can read the latest value
  // without rentalHistory being a dependency (avoids re-triggering on every
  // parent re-render which causes the typing-interruption bug).
  const rentalHistoryRef = useRef(rentalHistory)
  useEffect(() => {
    rentalHistoryRef.current = rentalHistory
  }, [rentalHistory])

  function setRow(txId, patch) {
    setRowState((prev) => ({ ...prev, [txId]: { ...prev[txId], ...patch } }))
  }

  // Use stable primitive values (userId, token, loadingData) as dependencies
  // instead of the session object or rentalHistory array, which get new
  // references on every parent re-render and would reset the form mid-typing.
  const userId = session?.userId
  const accessToken = session?.accessToken

  useEffect(() => {
    if (!accessToken || !userId || loadingData) return

    async function loadFeedback() {
      setLoadingFb(true)
      try {
        const fbRows = await fetchUserFeedback(userId, accessToken)
        setSubmitted(fbRows || [])
        const submittedTxIds = new Set((fbRows || []).map((r) => r.transaction_id))

        const completedPending = (rentalHistoryRef.current || []).filter(
          (item) => item.status === 'Completed' && !submittedTxIds.has(item.id),
        )
        setPending(completedPending)

        // Initialise row state only for items that don't have state yet
        // so that anything the user is currently typing is NOT overwritten.
        setRowState((prev) => {
          const next = { ...prev }
          completedPending.forEach((item) => {
            if (!next[item.id]) {
              next[item.id] = { rating: 5, comment: '', saving: false, done: false }
            }
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
  }, [userId, accessToken, loadingData])

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

  async function handleGeneralSubmit(e) {
    if (e) e.preventDefault()
    if (!genRating || genRating < 1) {
      setError(lang === 'tl' ? 'Mangyaring pumili ng rating.' : 'Please select a rating.')
      return
    }

    setSubmittingGen(true)
    setError('')
    try {
      await submitFeedback({
        transactionId: null,
        customerId: session.userId,
        rating: genRating,
        comment: genComment || '',
        token: session.accessToken,
      })

      setMessage(
        t('general_review_success') ||
          (lang === 'tl' ? 'Salamat sa iyong pangkalahatang puna!' : 'Thank you for your general review!'),
      )
      setGenComment('')
      setGenRating(5)

      // Refresh global feedback list
      const rows = await fetchGlobalFeedback(session.accessToken)
      setGlobalFeedback(rows || [])
    } catch (err) {
      setError(err.message || (lang === 'tl' ? 'Nabigo ang pagsumite.' : 'Submission failed.'))
    } finally {
      setSubmittingGen(false)
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
          {/* General Review Form for any user */}
          <div className="fb-card" style={{ marginBottom: '20px', border: '1px solid var(--line)', background: 'var(--white)' }}>
            <div className="fb-card-header">
              <span className="fb-locker-badge" style={{ fontSize: '15px' }}>
                ✏️ {t('general_review_title')}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--gray)', margin: '-4px 0 4px 0' }}>
              {t('general_review_sub')}
            </p>

            <StarPicker
              value={genRating}
              onChange={(v) => setGenRating(v)}
            />
            {genRating > 0 && (
              <p className="fb-rating-label">{ratingLabel(genRating, lang)}</p>
            )}

            <textarea
              className="fb-textarea"
              rows={3}
              maxLength={500}
              placeholder={t('feedback_comment_placeholder')}
              value={genComment}
              onChange={(e) => setGenComment(e.target.value)}
            />

            <button
              type="button"
              className="primary-button xml-black-button fb-submit-btn"
              disabled={submittingGen}
              onClick={handleGeneralSubmit}
            >
              {submittingGen ? t('processing') : t('submit_general_review')}
            </button>
          </div>

          <p className="fb-section-label">{t('feedback_global_label')}</p>

          {/* Rating Summary Widget */}
          {!loadingGlobal && globalFeedback.length > 0 && (
            <div className="fb-summary-widget">
              <div className="fb-summary-score">
                <span className="fb-big-score">
                  {(globalFeedback.reduce((sum, f) => sum + f.rating, 0) / globalFeedback.length).toFixed(1)}
                </span>
                <div className="fb-summary-stars">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const avg = globalFeedback.reduce((sum, f) => sum + f.rating, 0) / globalFeedback.length
                    const filled = n <= Math.round(avg)
                    return <span key={n} className={`fb-summary-star ${filled ? 'active' : ''}`}>{STAR}</span>
                  })}
                </div>
                <span className="fb-summary-count">
                  {globalFeedback.length} {lang === 'tl' ? 'mga puna' : 'reviews'}
                </span>
              </div>
              <div className="fb-summary-bars">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = globalFeedback.filter(f => f.rating === stars).length
                  const percent = (count / globalFeedback.length) * 100
                  return (
                    <div key={stars} className="fb-summary-bar-row">
                      <span className="fb-summary-bar-label">{stars}★</span>
                      <div className="fb-summary-bar-track">
                        <div className="fb-summary-bar-fill" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="fb-summary-bar-count">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loadingGlobal ? (
            <div className="fb-empty">{t('loading')}</div>
          ) : globalFeedback.length === 0 ? (
            <div className="fb-empty">{t('feedback_no_global')}</div>
          ) : (
            <div className="fb-cards">
              {globalFeedback.map((fb) => {
                const reviewerName = fb.customers?.full_name || (lang === 'tl' ? 'Gagamit' : 'Verified Customer')
                const initials = reviewerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'
                
                // Deterministic gradient color based on name length/hash
                const colors = ['grad-blue', 'grad-purple', 'grad-teal', 'grad-orange', 'grad-pink']
                const colorClass = colors[reviewerName.length % colors.length]

                return (
                  <div key={fb.feedback_id} className="fb-global-card">
                    <div className="fb-global-card-userinfo">
                      <div className={`fb-avatar ${colorClass}`}>
                        {initials}
                      </div>
                      <div className="fb-user-details">
                        <div className="fb-user-name-row">
                          <span className="fb-global-reviewer-name">{reviewerName}</span>
                          <span className="fb-verified-badge">
                            <span className="fb-verified-icon">✓</span>
                            {lang === 'tl' ? 'Beripikado' : 'Verified'}
                          </span>
                        </div>
                        <div className="fb-sub-header-row">
                          <div className="fb-global-stars">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={`fb-star-mini ${n <= fb.rating ? 'active' : ''}`}>{STAR}</span>
                            ))}
                          </div>
                          <span className="fb-global-date">
                            {new Date(fb.created_at).toLocaleDateString(
                              lang === 'tl' ? 'fil-PH' : 'en-US',
                              { year: 'numeric', month: 'short', day: 'numeric' },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    {fb.comment && <p className="fb-global-comment">{fb.comment}</p>}
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
