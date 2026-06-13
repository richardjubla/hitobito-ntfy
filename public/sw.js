self.addEventListener('push', (event) => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { return }

  const title = data.title || data.topic || 'Neue Mitteilung'
  const options = {
    body: data.message || '',
    icon: self.registration.scope + 'icon.png',
    badge: self.registration.scope + 'icon.png',
    tag: data.id,
    data: { url: self.registration.scope },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? self.registration.scope))
})
