export * as HostConfig from "./host-config"

export type HostSecurity = {
  hostname: string
  auth: boolean
  password?: string
  generated: boolean
  warning?: string
}

export type HostSecurityInput = {
  tailscale: boolean
  socket?: boolean
  hostnameExplicit: boolean
  hostname: string
  password?: string
}

// Decides the bind address and auth posture for `opencode host`:
// - With Tailscale Serve the server is only reachable from the tailnet, so it
//   binds loopback and runs without a password unless one is supplied — the
//   tailnet is the auth boundary.
// - Without Tailscale the server would have to bind all interfaces for remote
//   clients, so password auth is mandatory (generated when not supplied).
// - A unix socket is local-only by filesystem permissions: no password.
export function resolveHostConfig(input: HostSecurityInput): HostSecurity {
  if (input.socket) {
    return { hostname: input.hostname, auth: !!input.password, password: input.password, generated: false }
  }

  if (input.tailscale) {
    return {
      hostname: input.hostnameExplicit ? input.hostname : "127.0.0.1",
      auth: !!input.password,
      password: input.password,
      generated: false,
    }
  }

  return {
    hostname: input.hostnameExplicit || input.hostname !== "127.0.0.1" ? input.hostname : "0.0.0.0",
    auth: true,
    password: input.password ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    generated: !input.password,
    warning: "Tailscale Serve unavailable — binding to all interfaces with password auth enabled.",
  }
}
