export default function AlertDialog({
  type = 'error',
  title,
  message,
  onClose,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel',
}) {
  if (!message) return null

  const config = {
    error: {
      icon: '✕',
      defaultTitle: 'Something went wrong',
      btnClass: 'alert-dialog-btn alert-dialog-btn--error',
    },
    success: {
      icon: '✓',
      defaultTitle: 'Success',
      btnClass: 'alert-dialog-btn alert-dialog-btn--success',
    },
    warning: {
      icon: '!',
      defaultTitle: 'Heads up',
      btnClass: 'alert-dialog-btn alert-dialog-btn--warning',
    },
    confirm: {
      icon: '🚪',
      defaultTitle: 'Are you sure?',
      btnClass: 'alert-dialog-btn alert-dialog-btn--danger',
    },
  }

  const { icon, defaultTitle, btnClass } = config[type] || config.error
  const dialogTitle = title || defaultTitle

  return (
    <div className="alert-dialog-backdrop" role="dialog" aria-modal="true" aria-live="assertive">
      <div className={`alert-dialog alert-dialog--${type} neo-dialog-card`}>
        <div className="alert-dialog-icon">{icon}</div>
        <h3 className="alert-dialog-title">{dialogTitle}</h3>
        <p className="alert-dialog-message">{message}</p>

        {type === 'confirm' ? (
          <div className="alert-dialog-actions">
            <button
              className="alert-dialog-btn alert-dialog-btn--cancel"
              type="button"
              onClick={onClose}
            >
              {cancelText}
            </button>
            <button
              className={btnClass}
              type="button"
              onClick={onConfirm || onClose}
              autoFocus
            >
              {confirmText}
            </button>
          </div>
        ) : (
          <div className="alert-dialog-actions single">
            <button className={btnClass} type="button" onClick={onClose} autoFocus>
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
