export default function AlertDialog({ type = 'error', message, onClose }) {
  if (!message) return null

  const config = {
    error: {
      icon: '❌',
      title: 'Something went wrong',
      btnClass: 'alert-dialog-btn alert-dialog-btn--error',
    },
    success: {
      icon: '✅',
      title: 'Success',
      btnClass: 'alert-dialog-btn alert-dialog-btn--success',
    },
    warning: {
      icon: '⚠️',
      title: 'Heads up',
      btnClass: 'alert-dialog-btn alert-dialog-btn--warning',
    },
  }

  const { icon, title, btnClass } = config[type] || config.error

  return (
    <div className="alert-dialog-backdrop" role="dialog" aria-modal="true" aria-live="assertive">
      <div className={`alert-dialog alert-dialog--${type}`}>
        <div className="alert-dialog-icon">{icon}</div>
        <h3 className="alert-dialog-title">{title}</h3>
        <p className="alert-dialog-message">{message}</p>
        <button className={btnClass} type="button" onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </div>
  )
}
