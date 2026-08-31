import { describe, expect, test } from "bun:test"
import {
  activeCommandRegistrations,
  addCommandRegistration,
  commandPaletteOptions,
  formatKeybindParts,
  matchKeybind,
  parseKeybind,
  resolveKeybindOption,
  type CommandOption,
} from "./command"

const paletteOptions: CommandOption[] = [
  { id: "settings.open", title: "Open settings" },
  { id: "session.undo", title: "Undo" },
  { id: "file.open", title: "Open file" },
  { id: "hidden", title: "Hidden", hidden: true },
  { id: "disabled", title: "Disabled", disabled: true },
]

describe("commandPaletteOptions", () => {
  test("keeps visible enabled commands", () => {
    expect(commandPaletteOptions(paletteOptions).map((option) => option.id)).toEqual(["settings.open", "session.undo"])
  })
})

describe("slash search keybind", () => {
  const fileSearch: CommandOption = {
    id: "file.search",
    title: "Open file",
    keybind: "/",
    hidden: true,
  }

  test("matches an unmodified slash keydown", () => {
    expect(matchKeybind(parseKeybind(fileSearch.keybind!), new KeyboardEvent("keydown", { key: "/" }))).toBe(true)
  })

  test("does not match slash with modifiers", () => {
    const keybinds = parseKeybind(fileSearch.keybind!)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: "/", ctrlKey: true }))).toBe(false)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: "/", metaKey: true }))).toBe(false)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: "/", altKey: true }))).toBe(false)
  })

  test("stays out of the command palette", () => {
    expect(commandPaletteOptions([fileSearch])).toEqual([])
  })

  test("displays as a plain slash", () => {
    expect(formatKeybindParts(fileSearch.keybind!)).toEqual(["/"])
  })
})

describe("command registrations", () => {
  test("shadows keyed registrations while retaining the previous owner", () => {
    const one = () => [{ id: "one", title: "One" }]
    const two = () => [{ id: "two", title: "Two" }]

    const registrations = addCommandRegistration([{ key: "layout", options: one }], {
      key: "layout",
      options: two,
    })
    const active = activeCommandRegistrations(registrations)

    expect(registrations).toHaveLength(2)
    expect(active).toHaveLength(1)
    expect(active[0]?.options).toBe(two)

    const restored = activeCommandRegistrations(registrations.filter((entry) => entry.options !== two))
    expect(restored).toHaveLength(1)
    expect(restored[0]?.options).toBe(one)
  })

  test("keeps unkeyed registrations additive", () => {
    const one = () => [{ id: "one", title: "One" }]
    const two = () => [{ id: "two", title: "Two" }]

    const next = activeCommandRegistrations(addCommandRegistration([{ options: one }], { options: two }))

    expect(next).toHaveLength(2)
    expect(next[0]?.options).toBe(two)
    expect(next[1]?.options).toBe(one)
  })
})

describe("resolveKeybindOption", () => {
  test("prefers a matching contextual command over the global fallback", () => {
    const fallback = { id: "tab.close", title: "Close tab" }
    const contextual = { id: "terminal.close", title: "Close terminal", when: () => true }

    expect(resolveKeybindOption([fallback, contextual], new KeyboardEvent("keydown"))).toBe(contextual)
  })

  test("uses the global fallback outside the command context", () => {
    const fallback = { id: "tab.close", title: "Close tab" }
    const contextual = { id: "terminal.close", title: "Close terminal", when: () => false }

    expect(resolveKeybindOption([fallback, contextual], new KeyboardEvent("keydown"))).toBe(fallback)
  })
})
