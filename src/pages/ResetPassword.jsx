import { useState } from 'react'
import { changePassword } from '../lib/supabase'
import logo from '../assets/coin_logo.png'
import AlertDialog from '../components/AlertDialog'

export default function ResetPassword({ accessToken, onNavigate, t, lang }) {
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.password) return setError(lang === 'tl' ? 'Kailangan ang PIN.' : 'PIN is required.')
    if (!/^\d{6}$/.test(form.password)) return setError(lang === 'tl' ? 'Ang PIN ay dapat na eksaktong 6 na digit.' : 'PIN must be exactly 6 digits.')
    if (form.password !== form.confirmPassword) return setError(lang === 'tl' ? 'Hindi magkatugma ang PIN.' : 'PINs do not match.')

    setLoading(true)
    try {
      await changePassword(form.password, accessToken)
      setNotice(lang === 'tl' ? 'Matagumpay na na-update ang PIN! Nagreredirekt sa login...' : 'PIN updated successfully! Redirecting to login...')
      setTimeout(() => onNavigate('login'), 2000)
    } catch (err) {
      setError(lang === 'tl' ? 'Nabigo ang pag-reset ng PIN. Maaaring expired na ang link.' : (err.message || 'Failed to reset PIN. The link may have expired.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page android-auth">
      <section className="auth-panel xml-login-panel">
        <img className="auth-logo" src={logo} alt="CoinCubby logo" />
        <div>
          <h1>{t('set_new_pin')}</h1>
          <p className="muted">{t('enter_new_pin')}</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="xml-field">
            <span>{t('new_pin_label')}</span>
            <input
              name="password"
              type="password"
              inputMode="numeric"
              maxLength="6"
              value={form.password}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setForm((current) => ({ ...current, password: val }))
              }}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>
          <label className="xml-field">
            <span>{t('confirm_new_pin')}</span>
            <input
              name="confirmPassword"
              type="password"
              inputMode="numeric"
              maxLength="6"
              value={form.confirmPassword}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setForm((current) => ({ ...current, confirmPassword: val }))
              }}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>

          {error && <AlertDialog type="error" message={error} onClose={() => setError('')} />}
          {notice && <AlertDialog type="success" message={notice} onClose={() => setNotice('')} />}

          <button className="primary-button xml-black-button" type="submit" disabled={loading}>
            {loading ? t('updating') : t('set_new_pin')}
          </button>
        </form>

        <p className="auth-switch">
          <button type="button" onClick={() => onNavigate('login')}>
            {t('back_to_login')}
          </button>
        </p>
      </section>
    </main>
  )
}
