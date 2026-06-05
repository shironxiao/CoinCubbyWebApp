import { useEffect, useMemo } from 'react'

export default function NotificationsDrawer({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigate,
}) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Group notifications into Today, Yesterday, and Earlier
  const groupedNotifications = useMemo(() => {
    const today = []
    const yesterday = []
    const earlier = []

    const now = new Date()
    const todayDate = now.toDateString()

    const yesterdayDateObj = new Date()
    yesterdayDateObj.setDate(now.getDate() - 1)
    const yesterdayDate = yesterdayDateObj.toDateString()

    notifications.forEach((notif) => {
      const notifDate = new Date(notif.timestamp).toDateString()
      if (notifDate === todayDate) {
        today.push(notif)
      } else if (notifDate === yesterdayDate) {
        yesterday.push(notif)
      } else {
        earlier.push(notif)
      }
    })

    return { today, yesterday, earlier }
  }, [notifications])

  if (!isOpen) return null

  // Helpers to render notification type icons
  function getIcon(type) {
    switch (type) {
      case 'rental_start':
        return (
          <svg className="notif-type-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )
      case 'rental_end':
        return (
          <svg className="notif-type-icon gray" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        )
      case 'wallet':
        return (
          <svg className="notif-type-icon blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="12" y1="10" x2="12" y2="10" />
            <line x1="16" y1="10" x2="18" y2="10" />
          </svg>
        )
      case 'security':
        return (
          <svg className="notif-type-icon orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1" />
          </svg>
        )
      default:
        return (
          <svg className="notif-type-icon info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )
    }
  }

  function formatTime(timestamp) {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  function handleNotificationClick(notif) {
    if (!notif.isRead) {
      onMarkAsRead(notif.id)
    }
    if (onNavigate) {
      switch (notif.type) {
        case 'rental_start':
          onNavigate('rent')
          break
        case 'rental_end':
          onNavigate('history')
          break
        case 'security':
        case 'wallet':
          onNavigate('profile')
          break
        case 'info':
        default:
          onNavigate('home')
          break
      }
    }
  }

  const hasNotifications = notifications.length > 0
  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <>
      <div className="notif-drawer-backdrop" onClick={onClose} role="presentation" />
      <div className="notif-drawer" role="dialog" aria-modal="true" aria-label="Notifications Panel">
        <div className="notif-header">
          <div className="notif-header-title">
            <h2>Notifications</h2>
            {unreadCount > 0 && <span className="notif-unread-tag">{unreadCount} new</span>}
          </div>
          <button className="notif-close-btn" onClick={onClose} aria-label="Close notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="notif-actions-bar">
          {hasNotifications && (
            <>
              <button 
                className="notif-action-link" 
                onClick={onMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                Mark all as read
              </button>
              <button className="notif-action-link danger" onClick={onClearAll}>
                Clear all
              </button>
            </>
          )}
        </div>

        <div className="notif-body">
          {!hasNotifications ? (
            <div className="notif-empty-state">
              <div className="notif-empty-bell">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <h3>No Notifications Yet</h3>
              <p>We'll notify you here when locker status changes or events occur.</p>
            </div>
          ) : (
            <div className="notif-list">
              {/* Today Group */}
              {groupedNotifications.today.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group-title">Today</div>
                  {groupedNotifications.today.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                      onClick={() => handleNotificationClick(notif)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleNotificationClick(notif)
                        }
                      }}
                    >
                      {getIcon(notif.type)}
                      <div className="notif-item-content">
                        <div className="notif-item-header">
                          <h4>{notif.title}</h4>
                          <span className="notif-item-time">{formatTime(notif.timestamp)}</span>
                        </div>
                        <p>{notif.content}</p>
                      </div>
                      {!notif.isRead && <span className="notif-item-dot" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Yesterday Group */}
              {groupedNotifications.yesterday.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group-title">Yesterday</div>
                  {groupedNotifications.yesterday.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                      onClick={() => handleNotificationClick(notif)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleNotificationClick(notif)
                        }
                      }}
                    >
                      {getIcon(notif.type)}
                      <div className="notif-item-content">
                        <div className="notif-item-header">
                          <h4>{notif.title}</h4>
                          <span className="notif-item-time">{formatTime(notif.timestamp)}</span>
                        </div>
                        <p>{notif.content}</p>
                      </div>
                      {!notif.isRead && <span className="notif-item-dot" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Earlier Group */}
              {groupedNotifications.earlier.length > 0 && (
                <div className="notif-group">
                  <div className="notif-group-title">Earlier</div>
                  {groupedNotifications.earlier.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                      onClick={() => handleNotificationClick(notif)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleNotificationClick(notif)
                        }
                      }}
                    >
                      {getIcon(notif.type)}
                      <div className="notif-item-content">
                        <div className="notif-item-header">
                          <h4>{notif.title}</h4>
                          <span className="notif-item-time">
                            {new Date(notif.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p>{notif.content}</p>
                      </div>
                      {!notif.isRead && <span className="notif-item-dot" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
