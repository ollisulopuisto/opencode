import { describe, expect, test } from "bun:test"
import { buildClientManifest, createInstallPromptController, manifestStartUrl } from "./pwa"

describe("paired PWA manifest", () => {
  test("preserves the paired directory and session route without credentials", () => {
    const startURL = manifestStartUrl({
      pathname: "/L3RtcC9wcm9qZWN0/session/ses_123",
      search: "?auth_token=secret&prompt=review",
      hash: "#timeline",
    })

    expect(startURL).toBe("/L3RtcC9wcm9qZWN0/session/ses_123?prompt=review#timeline")
    expect(startURL).not.toContain("auth_token")
    expect(buildClientManifest({ pathname: startURL })).toMatchObject({
      start_url: startURL,
      scope: "/",
    })
  })

  test("builds an anonymous manifest fallback at the app root", () => {
    expect(buildClientManifest({ pathname: "/" })).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
    })
  })

  test("captures and consumes the platform install prompt", async () => {
    const target = new EventTarget()
    let prompted = 0
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => {
        prompted++
      },
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    })
    const controller = createInstallPromptController(target)

    target.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(controller.available()).toBe(true)
    expect(await controller.install()).toBe(true)
    expect(prompted).toBe(1)
    expect(controller.available()).toBe(false)
    controller.dispose()
  })
})
