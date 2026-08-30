export * as MCPPresets from "./presets"

export interface MCPPreset {
  readonly name: string
  readonly description: string
  readonly command: readonly string[]
  readonly environment?: Record<string, string>
}

export const PRESETS: Record<string, MCPPreset> = {
  todoist: {
    name: "todoist",
    description: "Todoist task, project, and reminder management connector",
    command: ["npx", "-y", "todoist-mcp-server"],
    environment: {
      TODOIST_API_TOKEN: "${TODOIST_API_TOKEN}",
    },
  },
  gmail: {
    name: "gmail",
    description: "Gmail inbox, email drafting, and search connector",
    command: ["npx", "-y", "@modelcontextprotocol/server-gmail"],
  },
  puppeteer: {
    name: "puppeteer",
    description: "Headless Chromium interactive browser automation and screenshots",
    command: ["npx", "-y", "@modelcontextprotocol/server-puppeteer"],
  },
  postgres: {
    name: "postgres",
    description: "PostgreSQL database query and schema inspection connector",
    command: ["npx", "-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"],
  },
  github: {
    name: "github",
    description: "GitHub issues, pull requests, and repository exploration connector",
    command: ["npx", "-y", "@modelcontextprotocol/server-github"],
    environment: {
      GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}",
    },
  },
}
