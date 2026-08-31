import { describe, expect, test } from "bun:test"
import { buildPairingUrl, detectNetworkEndpoints, printPairingInfo, tailscaleHttpsUrl } from "../../src/cli/qr"
import { base64Encode } from "@opencode-ai/core/util/encode"

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

  test("buildPairingUrl encodes directory and session into path and attaches auth token", () => {
    const dir = "/Users/dst/Documents/koodi/opencode"
    const encodedDir = base64Encode(dir)

    const urlWithDir = buildPairingUrl({
      targetHostUrl: "https://mac-studio.ts.net",
      password: "secret",
      directory: dir,
    })
    expect(urlWithDir).toContain(`https://mac-studio.ts.net/${encodedDir}?auth_token=`)

    const urlWithSession = buildPairingUrl({
      targetHostUrl: "https://mac-studio.ts.net",
      password: "secret",
      directory: dir,
      sessionID: "ses_12345",
    })
    expect(urlWithSession).toContain(`https://mac-studio.ts.net/${encodedDir}/session/ses_12345?auth_token=`)
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
