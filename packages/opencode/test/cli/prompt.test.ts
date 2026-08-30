import { describe, expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import { Prompt } from "../../src/cli/prompt"

function ttyStream() {
  const stream = new PassThrough()
  Object.defineProperty(stream, "isTTY", { value: true })
  return stream
}

describe("waitForEnter", () => {
  test("resolves when a line arrives on a TTY input", async () => {
    const input = ttyStream()
    const pending = Prompt.waitForEnter(input)
    input.write("\n")
    let settled = false
    await pending.then(() => {
      settled = true
    })
    expect(settled).toBe(true)
  })

  test("does not resolve before a line arrives on a TTY input", async () => {
    const input = ttyStream()
    let settled = false
    const pending = Prompt.waitForEnter(input).then(() => {
      settled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(settled).toBe(false)
    input.write("\n")
    await pending
    expect(settled).toBe(true)
  })

  test("resolves immediately when the input is not a TTY", async () => {
    const input = new PassThrough()
    let settled = false
    await Prompt.waitForEnter(input).then(() => {
      settled = true
    })
    expect(settled).toBe(true)
  })
})
