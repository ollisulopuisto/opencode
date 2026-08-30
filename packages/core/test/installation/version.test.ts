import { describe, expect, test } from "bun:test"
import { InstallationChannel, InstallationVersion } from "@opencode-ai/core/installation/version"

const pkg = JSON.parse(await Bun.file(new URL("../../package.json", import.meta.url)).text())

function calverToday() {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
}

describe("InstallationVersion local fallback", () => {
  test("resembles the upstream package version with a calver date appended", () => {
    const escaped = pkg.version.replace(/\./g, "\\.")
    expect(InstallationVersion).toMatch(new RegExp(`^${escaped}\\+\\d{8}$`))
  })

  test("appended calver date is today", () => {
    const suffix = InstallationVersion.split("+")[1]
    expect(suffix).toBe(calverToday())
  })

  test("channel stays local", () => {
    expect(InstallationChannel).toBe("local")
  })
})