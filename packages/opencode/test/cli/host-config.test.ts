import { describe, expect, test } from "bun:test"
import { resolveHostConfig } from "../../src/cli/host-config"

describe("resolveHostConfig", () => {
  test("tailscale available: loopback bind, no password generated", () => {
    const config = resolveHostConfig({
      tailscale: true,
      hostnameExplicit: false,
      hostname: "127.0.0.1",
      password: undefined,
    })
    expect(config.hostname).toBe("127.0.0.1")
    expect(config.auth).toBe(false)
    expect(config.password).toBeUndefined()
    expect(config.generated).toBe(false)
  })

  test("tailscale available: explicit hostname is respected", () => {
    const config = resolveHostConfig({
      tailscale: true,
      hostnameExplicit: true,
      hostname: "100.64.0.5",
      password: undefined,
    })
    expect(config.hostname).toBe("100.64.0.5")
    expect(config.auth).toBe(false)
  })

  test("tailscale available: a supplied password still enables auth", () => {
    const config = resolveHostConfig({
      tailscale: true,
      hostnameExplicit: false,
      hostname: "127.0.0.1",
      password: "secret",
    })
    expect(config.auth).toBe(true)
    expect(config.password).toBe("secret")
    expect(config.generated).toBe(false)
  })

  test("no tailscale: binds all interfaces with a generated password", () => {
    const config = resolveHostConfig({
      tailscale: false,
      hostnameExplicit: false,
      hostname: "127.0.0.1",
      password: undefined,
    })
    expect(config.hostname).toBe("0.0.0.0")
    expect(config.auth).toBe(true)
    expect(config.generated).toBe(true)
    expect(config.password).toBeTruthy()
    expect(config.warning).toBeTruthy()
  })

  test("no tailscale: supplied password is used instead of generating", () => {
    const config = resolveHostConfig({
      tailscale: false,
      hostnameExplicit: false,
      hostname: "127.0.0.1",
      password: "secret",
    })
    expect(config.auth).toBe(true)
    expect(config.password).toBe("secret")
    expect(config.generated).toBe(false)
  })

  test("no tailscale: explicit non-default hostname is kept", () => {
    const config = resolveHostConfig({
      tailscale: false,
      hostnameExplicit: true,
      hostname: "192.168.1.10",
      password: undefined,
    })
    expect(config.hostname).toBe("192.168.1.10")
    expect(config.auth).toBe(true)
  })

  test("unix socket: local-only, no password generated", () => {
    const config = resolveHostConfig({
      tailscale: false,
      socket: true,
      hostnameExplicit: false,
      hostname: "127.0.0.1",
      password: undefined,
    })
    expect(config.auth).toBe(false)
    expect(config.generated).toBe(false)
  })
})
