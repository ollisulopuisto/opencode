export type PushSubscriptionPayload = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export type PushApi = {
  publicKey: () => Promise<{ publicKey: string }>
  subscribe: (payload: PushSubscriptionPayload) => Promise<void>
  unsubscribe: (payload: { endpoint: string }) => Promise<void>
}

type PushManagerLike = {
  getSubscription: () => Promise<PushSubscriptionLike | null>
  subscribe: (options: PushSubscriptionOptionsInit) => Promise<PushSubscriptionLike>
}

type PushSubscriptionLike = {
  endpoint: string
  toJSON: () => {
    endpoint?: string
    expirationTime?: number | null
    keys?: {
      p256dh?: string
      auth?: string
    }
  }
  unsubscribe: () => Promise<boolean>
}

type ServiceWorkerRegistrationLike = {
  pushManager?: PushManagerLike
}

type ServiceWorkerContainerLike = {
  ready: Promise<ServiceWorkerRegistrationLike>
}

type NotificationLike = {
  permission: NotificationPermission
  requestPermission: () => Promise<NotificationPermission>
}

export async function enablePushNotifications(input: {
  api: PushApi
  serviceWorker?: ServiceWorkerContainerLike
  notification?: NotificationLike
}) {
  if (!input.serviceWorker?.ready || !input.notification) throw new Error("Web Push is unavailable")
  const permission =
    input.notification.permission === "default"
      ? await input.notification.requestPermission()
      : input.notification.permission
  if (permission !== "granted") throw new Error("Notification permission was not granted")

  const registration = await input.serviceWorker.ready
  if (!registration.pushManager) throw new Error("Web Push is unavailable")
  const key = await input.api.publicKey()
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(key.publicKey),
    }))
  const payload = subscription.toJSON()
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys.auth) throw new Error("Invalid Web Push subscription")
  await input.api.subscribe({
    endpoint: payload.endpoint,
    ...(payload.expirationTime === undefined ? {} : { expirationTime: payload.expirationTime }),
    keys: {
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
  })
  return subscription
}

export async function disablePushNotifications(input: { api: PushApi; serviceWorker?: ServiceWorkerContainerLike }) {
  if (!input.serviceWorker?.ready) return
  const registration = await input.serviceWorker.ready
  const subscription = await registration.pushManager?.getSubscription()
  if (!subscription) return
  await input.api.unsubscribe({ endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

export function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
