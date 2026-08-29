import { describe, expect, test, mock } from "bun:test"
import { Effect } from "effect"
import { Ntfy } from "@opencode-ai/core/notify/ntfy"

describe("Ntfy", () => {
  test("send skips when no url is configured", async () => {
    delete process.env.OPENCODE_NTFY_URL
    delete process.env.OPENCODE_NTFY_TOPIC
    let called = false
    const origFetch = globalThis.fetch
    globalThis.fetch = mock(async () => {
      called = true
      return new Response("ok")
    }) as any

    try {
      await Effect.runPromise(Ntfy.send({ message: "test message" }))
      expect(called).toBe(false)
    } finally {
      globalThis.fetch = origFetch
    }
  })

  test("send makes POST request when topic configured", async () => {
    process.env.OPENCODE_NTFY_TOPIC = "test-topic-123"
    let requestedUrl = ""
    let requestedBody = ""
    const origFetch = globalThis.fetch
    globalThis.fetch = mock(async (url: any, init: any) => {
      requestedUrl = String(url)
      requestedBody = String(init?.body)
      return new Response("ok")
    }) as any

    try {
      await Effect.runPromise(Ntfy.send({ title: "Test Title", message: "Task completed", tags: ["robot"] }))
      expect(requestedUrl).toBe("https://ntfy.sh/test-topic-123")
      expect(requestedBody).toBe("Task completed")
    } finally {
      delete process.env.OPENCODE_NTFY_TOPIC
      globalThis.fetch = origFetch
    }
  })
})
