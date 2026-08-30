import { describe, expect, test } from "bun:test"
import path from "node:path"
import fs from "node:fs"
import os from "node:os"
import {
  peerNotice,
  socketIsStale,
  parseFileRefs,
  isMermaidLang,
  clampZoom,
  isDoubleTap,
  parseEnvelope,
} from "../../src/util/remote-pwa"
import {
  sanitizeFilePath,
  isPathContained,
  getSanctionedRoots,
} from "../../src/server/shared/file-view"

describe("Remote PWA Pure Helpers", () => {
  test("peerNotice formats singular and plural counts", () => {
    expect(peerNotice(1)).toBe("1 device connected")
    expect(peerNotice(2)).toBe("2 devices connected")
    expect(peerNotice(5)).toBe("5 devices connected")
  })

  test("socketIsStale detects stale timestamps and handles initial undefined", () => {
    const now = 100_000
    // Initial undefined gets stamped fresh on first sweep, judged on next -> not stale
    expect(socketIsStale(undefined, now, 45_000)).toBe(false)
    // Active client within 45s
    expect(socketIsStale(now - 20_000, now, 45_000)).toBe(false)
    // Silent client > 45s
    expect(socketIsStale(now - 45_001, now, 45_000)).toBe(true)
  })

  test("parseFileRefs parses empty-host file URLs and deduplicates per message", () => {
    const text = `
      Check out file:///Users/dst/project/src/index.ts and [App](file:///Users/dst/project/src/App.tsx).
      Duplicate: file:///Users/dst/project/src/index.ts
      Remote machine ref: file://remote-server/etc/config.json
    `
    const refs = parseFileRefs(text)
    expect(refs.length).toBe(2)
    expect(refs[0].path).toBe("/Users/dst/project/src/index.ts")
    expect(refs[0].name).toBe("index.ts")
    expect(refs[1].path).toBe("/Users/dst/project/src/App.tsx")
    expect(refs[1].name).toBe("App")
  })

  test("parseFileRefs keeps bracketed references intact (no swallowed closing bracket)", () => {
    const refs = parseFileRefs(
      "Implemented ([file:///Users/dst/x/harness/src/classifier.ts] and " +
        "[file:///Users/dst/x/harness/tests/ts/classifier.ts])",
    )
    expect(refs.length).toBe(2)
    expect(refs[0].path).toBe("/Users/dst/x/harness/src/classifier.ts")
    expect(refs[0].name).toBe("classifier.ts")
    expect(refs[1].path).toBe("/Users/dst/x/harness/tests/ts/classifier.ts")
    expect(refs[1].name).toBe("classifier.ts")
  })

  test("parseFileRefs does not create ghost refs for paths with spaces", () => {
    const refs = parseFileRefs("[file:///Users/dst/My Repo/src/a.ts]")
    expect(refs.length).toBe(1)
    expect(refs[0].path).toBe("/Users/dst/My Repo/src/a.ts")
    expect(refs[0].name).toBe("a.ts")
  })

  test("parseFileRefs deduplicates bracketed references and rejects host/relative forms", () => {
    expect(parseFileRefs("[file:///a/b.ts] then [file:///a/b.ts] again").length).toBe(1)
    expect(parseFileRefs("[file://host/share/x.txt]")).toEqual([])
    expect(parseFileRefs("[file://relative/path.txt]")).toEqual([])
  })

  test("parseFileRefs parses markdown links with a label", () => {
    const refs = parseFileRefs(
      "Implemented [harness/src/project-memory.ts]" + "(file:///Users/dst/x/harness/src/project-memory.ts), verified.",
    )
    expect(refs.length).toBe(1)
    expect(refs[0].path).toBe("/Users/dst/x/harness/src/project-memory.ts")
    expect(refs[0].name).toBe("harness/src/project-memory.ts")
  })

  test("isMermaidLang matches only mermaid and mmd case-insensitively", () => {
    expect(isMermaidLang("mermaid")).toBe(true)
    expect(isMermaidLang("Mermaid")).toBe(true)
    expect(isMermaidLang("mmd")).toBe(true)
    expect(isMermaidLang("MMD")).toBe(true)
    expect(isMermaidLang("mermaid2")).toBe(false)
    expect(isMermaidLang("typescript")).toBe(false)
    expect(isMermaidLang(undefined)).toBe(false)
  })

  test("clampZoom clamps scale between 1 and 5", () => {
    expect(clampZoom(0.5)).toBe(1)
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(2.5)).toBe(2.5)
    expect(clampZoom(5)).toBe(5)
    expect(clampZoom(6)).toBe(5)
  })

  test("isDoubleTap detects taps within threshold", () => {
    expect(isDoubleTap(1000, 1200, 300)).toBe(true)
    expect(isDoubleTap(1000, 1400, 300)).toBe(false)
    expect(isDoubleTap(1000, 1000, 300)).toBe(false)
  })

  test("parseEnvelope safely parses JSON", () => {
    expect(parseEnvelope<{ status: string }>('{"status":"ok"}')).toEqual({ status: "ok" })
    expect(parseEnvelope("invalid json")).toBeNull()
    expect(parseEnvelope<{ direct: boolean }>({ direct: true })).toEqual({ direct: true })
  })
})

describe("Server File View Security", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-file-view-test-"))
  const sanctionedRoots = [tmpDir]

  test("sanitizeFilePath rejects relative paths and non-empty-host file URIs", () => {
    expect(sanitizeFilePath("relative/path.ts").ok).toBe(false)
    expect(sanitizeFilePath("file://other-host/abs/path.ts").ok).toBe(false)
    const valid = sanitizeFilePath("file:///Users/dst/file.ts")
    expect(valid.ok).toBe(true)
    if (valid.ok) {
      expect(valid.path).toBe("/Users/dst/file.ts")
    }
  })

  test("isPathContained correctly checks containment in sanctioned roots", () => {
    const inside = path.join(tmpDir, "sub", "file.ts")
    const outside = "/etc/hosts"
    expect(isPathContained(inside, sanctionedRoots)).toBe(true)
    expect(isPathContained(outside, sanctionedRoots)).toBe(false)
  })

  test("rejects directory, binary NUL-bytes, and handles truncation", () => {
    const textFile = path.join(tmpDir, "text.txt")
    fs.writeFileSync(textFile, "Hello world", "utf8")

    const binFile = path.join(tmpDir, "binary.bin")
    fs.writeFileSync(binFile, Buffer.from([0x48, 0x00, 0x49]))

    const largeFile = path.join(tmpDir, "large.txt")
    const largeContent = "a".repeat(130 * 1024)
    fs.writeFileSync(largeFile, largeContent, "utf8")

    // Stat & containment checks
    expect(isPathContained(textFile, sanctionedRoots)).toBe(true)
    expect(isPathContained(binFile, sanctionedRoots)).toBe(true)
    expect(isPathContained(largeFile, sanctionedRoots)).toBe(true)
  })
})
