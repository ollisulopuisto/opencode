const PUSH_CLICK_MESSAGE = "opencode:push-click"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  const payload = readPayload(event.data)
  if (!payload) return
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/web-app-manifest-192x192.png",
      badge: "/web-app-manifest-192x192.png",
      data: payload.data,
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  const target = safeTarget(event.notification.data?.path)
  event.notification.close()
  if (!target) return
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const client = windows.find((item) => "focus" in item)
      if (client) {
        await client.focus()
        client.postMessage({ type: PUSH_CLICK_MESSAGE })
        await client.navigate(target)
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})

function readPayload(data) {
  if (!data) return undefined
  try {
    const value = data.json()
    if (!value || typeof value !== "object") return undefined
    if (typeof value.title !== "string" || typeof value.body !== "string") return undefined
    if (!value.data || typeof value.data !== "object") return undefined
    return { title: value.title, body: value.body, data: value.data }
  } catch {
    return undefined
  }
}

function safeTarget(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return undefined
  const target = new URL(path, self.location.origin)
  if (target.origin !== self.location.origin || target.searchParams.has("auth_token")) return undefined
  return target.href
}
