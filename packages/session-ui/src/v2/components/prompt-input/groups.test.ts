import { describe, expect, test } from "bun:test"
import type { PromptInputV2Suggestion } from "./types"
import { suggestionRows } from "./groups"

const command = (id: string, group?: string): PromptInputV2Suggestion => ({
  id,
  kind: "command",
  label: `/${id}`,
  group,
})

describe("suggestionRows", () => {
  test("emits a group header before each distinct group", () => {
    const rows = suggestionRows([command("review", "Custom"), command("deploy", "Custom"), command("model", "Built-in")])
    expect(rows).toEqual([
      { type: "group", label: "Custom" },
      { type: "item", item: command("review", "Custom") },
      { type: "item", item: command("deploy", "Custom") },
      { type: "group", label: "Built-in" },
      { type: "item", item: command("model", "Built-in") },
    ])
  })

  test("ungrouped items produce no headers", () => {
    const rows = suggestionRows([command("review", "Custom"), command("model")])
    expect(rows).toEqual([
      { type: "group", label: "Custom" },
      { type: "item", item: command("review", "Custom") },
      { type: "item", item: command("model") },
    ])
  })

  test("returns a leading group header when the first item is grouped", () => {
    const rows = suggestionRows([command("model", "Built-in")])
    expect(rows).toEqual([
      { type: "group", label: "Built-in" },
      { type: "item", item: command("model", "Built-in") },
    ])
  })

  test("returns no rows for an empty list", () => {
    expect(suggestionRows([])).toEqual([])
  })

  test("repeats a group label if it appears again after another group", () => {
    const rows = suggestionRows([command("a", "X"), command("b", "Y"), command("c", "X")])
    expect(rows).toEqual([
      { type: "group", label: "X" },
      { type: "item", item: command("a", "X") },
      { type: "group", label: "Y" },
      { type: "item", item: command("b", "Y") },
      { type: "group", label: "X" },
      { type: "item", item: command("c", "X") },
    ])
  })
})
