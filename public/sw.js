self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/#/rent'
  const absoluteUrl = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(absoluteUrl)
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl)
      }

      return null
    }),
  )
})
