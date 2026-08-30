import { describe, expect, test } from "bun:test"
import { canFastAppend, isPlainText, textDelta } from "./markdown-text-tail"

describe("isPlainText", () => {
  test("accepts ordinary prose", () => {
    expect(isPlainText("hello world, this is fine: 123.")).toBe(true)
  })

  test("rejects markdown structure characters", () => {
    expect(isPlainText("# heading")).toBe(false)
    expect(isPlainText("**bold**")).toBe(false)
    expect(isPlainText("a [link](x)")).toBe(false)
    expect(isPlainText("`code`")).toBe(false)
    expect(isPlainText("line one\nline two")).toBe(false)
    expect(isPlainText("a | b")).toBe(false)
    expect(isPlainText("call & reply")).toBe(false)
    expect(isPlainText("<tag>")).toBe(false)
  })
})

describe("canFastAppend", () => {
  test("true when the next raw is a pure plain-text extension", () => {
    expect(canFastAppend("hello wor", "hello world")).toBe(true)
  })

  test("false for rewrites, structural deltas, or empty growth", () => {
    expect(canFastAppend("hello world", "hell o world")).toBe(false)
    expect(canFastAppend("hello", "hello **b")).toBe(false)
    expect(canFastAppend("same", "same")).toBe(false)
  })

  test("false when the previous raw was not plain text", () => {
    expect(canFastAppend("para **b", "para **bold")).toBe(false)
  })
})

describe("textDelta", () => {
  test("returns the appended slice", () => {
    expect(textDelta("hello wor", "hello world")).toBe("ld")
  })
})
