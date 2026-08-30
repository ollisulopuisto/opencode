import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { Effect } from "effect"

const MAX_FILE_SIZE = 128 * 1024 // 128 KB

export function getSanctionedRoots(extraRoots: string[] = []): string[] {
  const roots = [
    process.cwd(),
    os.homedir(),
    os.tmpdir(),
    ...extraRoots,
  ]
  return roots.map((r) => {
    try {
      return fs.realpathSync(path.resolve(r))
    } catch {
      return path.resolve(r)
    }
  })
}

export function isPathContained(targetPath: string, roots: string[]): boolean {
  const normalizedTarget = path.resolve(targetPath)
  return roots.some((root) => {
    const normalizedRoot = path.resolve(root)
    if (normalizedTarget === normalizedRoot) return true
    const prefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep
    return normalizedTarget.startsWith(prefix)
  })
}

export function sanitizeFilePath(inputPath: string): { ok: true; path: string } | { ok: false; error: string; status: number } {
  let p = inputPath.trim()
  if (p.startsWith("file://")) {
    if (!p.startsWith("file:///")) {
      return { ok: false, error: "Remote host file URIs are not permitted", status: 400 }
    }
    p = p.slice(7) // strip 'file://' keeping leading '/'
  }

  if (!p.startsWith("/")) {
    return { ok: false, error: "Absolute path required", status: 400 }
  }

  const resolved = path.resolve(p)
  return { ok: true, path: resolved }
}

export function serveFileView(
  request: HttpServerRequest.HttpServerRequest,
  sanctionedRoots: string[] = getSanctionedRoots(),
) {
  return Effect.sync(() => {
    const url = new URL(request.url, "http://localhost")
    const rawPathParam = url.searchParams.get("path")
    if (!rawPathParam) {
      return HttpServerResponse.jsonUnsafe({ error: "Missing path parameter" }, { status: 400 })
    }

    const sanitized = sanitizeFilePath(rawPathParam)
    if (!sanitized.ok) {
      return HttpServerResponse.jsonUnsafe({ error: sanitized.error }, { status: sanitized.status })
    }

    const targetPath = sanitized.path

    let realPath: string
    try {
      if (fs.existsSync(targetPath)) {
        realPath = fs.realpathSync(targetPath)
      } else {
        return HttpServerResponse.jsonUnsafe({ error: "File not found" }, { status: 404 })
      }
    } catch {
      return HttpServerResponse.jsonUnsafe({ error: "File not found" }, { status: 404 })
    }

    if (!isPathContained(realPath, sanctionedRoots)) {
      return HttpServerResponse.jsonUnsafe({ error: "Access forbidden: path outside sanctioned roots" }, { status: 403 })
    }

    let stat: fs.Stats
    try {
      stat = fs.statSync(realPath)
    } catch {
      return HttpServerResponse.jsonUnsafe({ error: "File not found" }, { status: 404 })
    }

    if (stat.isDirectory()) {
      return HttpServerResponse.jsonUnsafe({ error: "Directories cannot be viewed" }, { status: 415 })
    }

    const size = stat.size
    const readLength = Math.min(size, MAX_FILE_SIZE)
    const buf = Buffer.alloc(readLength)

    try {
      const fd = fs.openSync(realPath, "r")
      try {
        fs.readSync(fd, buf, 0, readLength, 0)
      } finally {
        fs.closeSync(fd)
      }
    } catch (err) {
      return HttpServerResponse.jsonUnsafe({ error: "Failed to read file" }, { status: 500 })
    }

    // Check for NUL-byte binary
    if (buf.includes(0)) {
      return HttpServerResponse.jsonUnsafe({ error: "Binary files cannot be viewed" }, { status: 415 })
    }

    const content = buf.toString("utf-8")
    const truncated = size > MAX_FILE_SIZE
    const name = path.basename(realPath)

    return HttpServerResponse.jsonUnsafe({
      path: realPath,
      name,
      content,
      truncated,
      size,
    })
  })
}
