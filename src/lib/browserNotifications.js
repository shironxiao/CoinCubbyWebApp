export function getBrowserNotificationStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

export async function registerNotificationWorker() {
  if (!('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    return registration
  } catch (err) {
    console.warn('Notification service worker registration failed:', err)
    return null
  }
}

export async function requestBrowserNotificationPermission() {
  if (getBrowserNotificationStatus() === 'unsupported') {
    return 'unsupported'
  }

  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    await registerNotificationWorker()
  }

  return permission
}

export async function showBrowserNotification({ title, body, tag, url = '#/rent' }) {
  if (getBrowserNotificationStatus() !== 'granted') return false

  const options = {
    body,
    tag,
    renotify: true,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url },
  }

  const registration = await registerNotificationWorker()
  if (registration?.showNotification) {
    await registration.showNotification(title, options)
    return true
  }

  new Notification(title, options)
  return true
}
