self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = typeof payload.title === 'string' ? payload.title : 'TenAceIQ Team Chat'
  const body = typeof payload.body === 'string' ? payload.body : 'Your team has an update.'
  const href = typeof payload.href === 'string' && payload.href.startsWith('/') ? payload.href : '/team-room'
  const tag = typeof payload.tag === 'string' ? payload.tag : 'tenaceiq-team-room'
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/tenaceiq-icon-192.png',
    badge: '/tenaceiq-icon-192.png',
    tag,
    data: { href },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/team-room'
  const destination = new URL(href, self.location.origin).toString()
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        if ('navigate' in client) await client.navigate(destination)
        return client.focus()
      }
    }
    return self.clients.openWindow(destination)
  })())
})
