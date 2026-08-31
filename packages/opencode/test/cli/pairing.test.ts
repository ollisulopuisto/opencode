import { describe, expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import { Pairing } from "../../src/cli/pairing"

function ttyStream() {
  const stream = new PassThrough()
  Object.defineProperty(stream, "isTTY", { value: true })
  return stream
}

describe("shouldPauseForPairing", () => {
  test("pauses when attaching to an already-running server: the QR is still shown", () => {
    expect(Pairing.shouldPauseForPairing({ qr: true, owned: false })).toBe(true)
  })

  test("pauses when starting a fresh server", () => {
    expect(Pairing.shouldPauseForPairing({ qr: true, owned: true })).toBe(true)
  })

  test("never pauses when the QR is suppressed with --no-qr", () => {
    expect(Pairing.shouldPauseForPairing({ qr: false, owned: true })).toBe(false)
    expect(Pairing.shouldPauseForPairing({ qr: false, owned: false })).toBe(false)
  })
})

describe("pauseForPairing", () => {
  test("does not resolve before a line arrives on a TTY input", async () => {
    const input = ttyStream()
    let settled = false
    const pending = Pairing.pauseForPairing({ stdin: input }).then(() => {
      settled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(settled).toBe(false)
    input.write("\n")
    await pending
    expect(settled).toBe(true)
  })

  test("resolves immediately when the input is not a TTY", async () => {
    let settled = false
    await Pairing.pauseForPairing({ stdin: new PassThrough() }).then(() => {
      settled = true
    })
    expect(settled).toBe(true)
  })
})
