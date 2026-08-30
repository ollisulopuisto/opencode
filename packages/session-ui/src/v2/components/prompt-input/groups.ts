export type SuggestionRow<T> =
  | { type: "group"; label: string }
  | { type: "item"; item: T }

// Turns a flat, group-ordered suggestion list into render rows: a header row
// before each run of items sharing the same `group` label. Ungrouped items
// produce no headers, so mixed lists stay intact.
export function suggestionRows<T extends { group?: string }>(items: T[]): SuggestionRow<T>[] {
  const rows: SuggestionRow<T>[] = []
  let current: string | undefined
  for (const item of items) {
    if (item.group && item.group !== current) {
      current = item.group
      rows.push({ type: "group", label: item.group })
    }
    if (!item.group) current = undefined
    rows.push({ type: "item", item })
  }
  return rows
}
