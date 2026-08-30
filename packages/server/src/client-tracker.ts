export * as ClientTracker from "./client-tracker"

export type Options = {
  graceMs: number
  onIdle: () => void
}

// Counts live client connections (SSE event streams, WebSockets) and reports
// when the last one has been gone for `graceMs`. Used to keep a hosted server
// alive while any client (TUI, PWA, script) is attached and exit it once the
// last client goes away.
export class Tracker {
  #connections = 0
  #timer: ReturnType<typeof setTimeout> | undefined
  #suspended = false

  constructor(private readonly options: Options) {
    this.#arm()
  }

  get count() {
    return this.#connections
  }

  connect() {
    this.#connections++
    this.#disarm()
  }

  disconnect() {
    this.#connections = Math.max(0, this.#connections - 1)
    if (this.#connections === 0 && !this.#suspended) this.#arm()
  }

  // Pauses idle exit (e.g. while a command waits for the user to pair a
  // client). Connections are still counted; resume() re-arms the timer.
  suspend() {
    this.#suspended = true
    this.#disarm()
  }

  resume() {
    this.#suspended = false
    if (this.#connections === 0) this.#arm()
  }

  dispose() {
    this.#disarm()
  }

  #arm() {
    this.#disarm()
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      this.options.onIdle()
    }, this.options.graceMs)
    this.#timer.unref?.()
  }

  #disarm() {
    if (this.#timer === undefined) return
    clearTimeout(this.#timer)
    this.#timer = undefined
  }
}

let current: Tracker | undefined

export function configure(options: Options): Tracker {
  current?.dispose()
  current = new Tracker(options)
  return current
}

export function reset() {
  current?.dispose()
  current = undefined
}

export function connect() {
  current?.connect()
}

export function disconnect() {
  current?.disconnect()
}

export function suspend() {
  current?.suspend()
}

export function resume() {
  current?.resume()
}

export function count() {
  return current?.count ?? 0
}
