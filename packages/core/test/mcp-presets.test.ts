import { describe, expect, test } from "bun:test"
import { PRESETS } from "@opencode-ai/core/mcp/presets"

describe("MCP Presets", () => {
  test("defines all standard connectors", () => {
    expect(PRESETS.todoist).toBeDefined()
    expect(PRESETS.gmail).toBeDefined()
    expect(PRESETS.puppeteer).toBeDefined()
    expect(PRESETS.postgres).toBeDefined()
    expect(PRESETS.github).toBeDefined()

    expect(PRESETS.todoist.command).toEqual(["npx", "-y", "todoist-mcp-server"])
    expect(PRESETS.puppeteer.command).toEqual(["npx", "-y", "@modelcontextprotocol/server-puppeteer"])
    expect(PRESETS.gmail.command).toEqual(["npx", "-y", "@modelcontextprotocol/server-gmail"])
  })
})
