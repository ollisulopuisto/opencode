import { describe, expect, test } from "bun:test"
import { detectNetworkEndpoints, printPairingInfo, tailscaleHttpsUrl } from "../../src/cli/qr"

describe("CLI QR Pairing & Tailscale Detection", () => {
  test("detectNetworkEndpoints returns localhost and lan structures", () => {
    const endpoints = detectNetworkEndpoints(4096)
    expect(endpoints.localhost).toBe("http://localhost:4096")
    expect(Array.isArray(endpoints.lan)).toBe(true)
  })

  test("printPairingInfo runs without throwing on localhost and unix socket", async () => {
    await expect(printPairingInfo({ port: 4096, password: "test-secret-pass" })).resolves.toBeUndefined()
    await expect(printPairingInfo({ port: 4096, socket: "/tmp/test.sock" })).resolves.toBeUndefined()
  })
})

describe("tailscaleHttpsUrl", () => {
  test("strips the trailing dot from the MagicDNS name", () => {
    expect(tailscaleHttpsUrl("mac-studio.tailnet.ts.net.")).toBe("https://mac-studio.tailnet.ts.net")
  })

  test("keeps a name without a trailing dot unchanged", () => {
    expect(tailscaleHttpsUrl("mac-studio.tailnet.ts.net")).toBe("https://mac-studio.tailnet.ts.net")
  })
})
