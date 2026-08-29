import { describe, expect, test } from "bun:test"
import { detectNetworkEndpoints, printPairingInfo } from "../../src/cli/qr"

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
