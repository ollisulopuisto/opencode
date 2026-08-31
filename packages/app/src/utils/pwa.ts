export type ClientManifest = {
  name: string
  short_name: string
  id: string
  start_url: string
  scope: string
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>
  theme_color: string
  background_color: string
  display: "standalone"
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function createInstallPromptController(target: EventTarget) {
  let deferred: InstallPromptEvent | undefined
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  const beforeInstallPrompt = (event: Event) => {
    if (!isInstallPromptEvent(event)) return
    event.preventDefault()
    deferred = event
    notify()
  }
  const installed = () => {
    deferred = undefined
    notify()
  }

  target.addEventListener("beforeinstallprompt", beforeInstallPrompt)
  target.addEventListener("appinstalled", installed)

  return {
    available: () => deferred !== undefined,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async install() {
      const event = deferred
      if (!event) return false
      deferred = undefined
      notify()
      try {
        await event.prompt()
        return (await event.userChoice).outcome === "accepted"
      } catch {
        return false
      }
    },
    dispose() {
      target.removeEventListener("beforeinstallprompt", beforeInstallPrompt)
      target.removeEventListener("appinstalled", installed)
      listeners.clear()
      deferred = undefined
    },
  }
}

export function manifestStartUrl(input: { pathname: string; search?: string; hash?: string }) {
  const route = new URL(input.pathname, "https://opencode.invalid")
  const pathname = route.pathname.startsWith("/") && !route.pathname.startsWith("//") ? route.pathname : "/"
  const search = new URLSearchParams(input.search ?? route.search)
  search.delete("auth_token")
  const query = search.toString()
  const hash = input.hash ?? route.hash
  return `${pathname}${query ? `?${query}` : ""}${hash}`
}

export function buildClientManifest(input: { pathname: string; search?: string; hash?: string }): ClientManifest {
  const startURL = manifestStartUrl(input)
  const id = startURL.split(/[?#]/, 1)[0] || "/"
  return {
    name: "OpenCode",
    short_name: "OpenCode",
    id,
    start_url: startURL,
    scope: "/",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    theme_color: "#080808",
    background_color: "#080808",
    display: "standalone",
  }
}

export function installClientManifest(manifest: ClientManifest, documentLike: Document = document) {
  const link = documentLike.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link || typeof URL.createObjectURL !== "function") return undefined
  const objectURL = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }))
  link.href = objectURL
  return () => URL.revokeObjectURL(objectURL)
}

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  if (!("prompt" in event) || typeof event.prompt !== "function") return false
  if (!("userChoice" in event)) return false
  return !!event.userChoice && typeof event.userChoice === "object" && "then" in event.userChoice
}
