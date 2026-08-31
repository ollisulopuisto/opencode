export type HapticTarget = {
  vibrate?: (pattern: number | number[]) => boolean
}

const PUSH_CLICK_MESSAGE = "opencode:push-click"

export function vibrate(target?: HapticTarget, duration = 10) {
  const current = target ?? (typeof navigator === "object" ? navigator : undefined)
  if (!current || typeof current.vibrate !== "function") return false
  try {
    return current.vibrate.call(current, duration)
  } catch {
    return false
  }
}

export function handleServiceWorkerMessage(event: { data?: unknown }, target?: HapticTarget) {
  if (!event.data || typeof event.data !== "object" || !("type" in event.data)) return false
  if (event.data.type !== PUSH_CLICK_MESSAGE) return false
  return vibrate(target)
}

export function installPushClickHapticListener(
  serviceWorker: Pick<ServiceWorkerContainer, "addEventListener" | "removeEventListener">,
  target?: HapticTarget,
) {
  const listener = (event: MessageEvent) => {
    handleServiceWorkerMessage(event, target)
  }
  serviceWorker.addEventListener("message", listener)
  return () => serviceWorker.removeEventListener("message", listener)
}
