import { describe, expect, test } from "bun:test"
import {
  buildPairingUrl,
  detectNetworkEndpoints,
  printPairingInfo,
  tailscaleHttpsUrl,
  enableTailscaleServe,
  detectTailscaleServe,
} from "../../src/cli/qr"
import { base64Encode } from "@opencode-ai/core/util/encode"

describe("CLI QR Pairing & Tailscale Detection", () => {
  test("detectNetworkEndpoints returns localhost and lan structures", () => {
    const endpoints = detectNetworkEndpoints(4096)
    expect(endpoints.localhost).toBe("http://localhost:4096")
    expect(Array.isArray(endpoints.lan)).toBe(true)
  })

  test("printPairingInfo runs without throwing on localhost and unix socket", async () => {
    expect(printPairingInfo({ port: 4096, password: "test-secret-pass" })).resolves.toBeUndefined()
    expect(printPairingInfo({ port: 4096, socket: "/tmp/test.sock" })).resolves.toBeUndefined()
  })

  test("enableTailscaleServe and detectTailscaleServe return undefined for invalid port 0", async () => {
    expect(enableTailscaleServe(0)).toBeUndefined()
    expect(enableTailscaleServe(-1)).toBeUndefined()
    expect(enableTailscaleServe(NaN)).toBeUndefined()
    expect(detectTailscaleServe(0)).resolves.toBeUndefined()
    expect(detectTailscaleServe(-1)).resolves.toBeUndefined()
    expect(detectTailscaleServe(NaN)).resolves.toBeUndefined()
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

  test("keeps the session ID in one encoded route segment", () => {
    const url = buildPairingUrl({
      targetHostUrl: "https://mac-studio.ts.net",
      directory: "/tmp/project",
      sessionID: "ses/with-slash",
    })

    expect(new URL(url).pathname).toBe(`/${base64Encode("/tmp/project")}/session/ses%2Fwith-slash`)
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
