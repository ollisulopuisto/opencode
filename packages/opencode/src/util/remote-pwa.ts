// Mirrored in agy-remote's src/agy_remote/static/format.js (scanFileRefs /
// parseFileRefs) -- keep the two in sync.

export function peerNotice(count: number): string {
  if (count === 1) return "1 device connected"
  return `${count} devices connected`
}

export function socketIsStale(lastSeen: number | undefined, now: number, timeoutMs = 45_000): boolean {
  if (lastSeen === undefined) return false
  return now - lastSeen > timeoutMs
}

export type FileRef = {
  path: string
  name: string
  raw: string
}

type ScanHit = {
  index: number
  raw: string
  path: string
  label: string | null
}

// Three separate scans (markdown link, bracketed, bare) instead of one
// optional-group regex: the bare scan runs inside every bracketed reference
// and would otherwise swallow the closing bracket or truncate paths with
// spaces into ghost refs. Hits are ordered by position and later overlaps are
// dropped by the cursor guard in parseFileRefs.
function scanFileRefs(value: string): ScanHit[] {
  const found: ScanHit[] = []
  function collect(re: RegExp, pathGroup: number, labelGroup: number | null) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(value)) !== null) {
      found.push({
        index: match.index,
        raw: match[0],
        path: match[pathGroup],
        label: labelGroup ? match[labelGroup] : null,
      })
      if (match.index === re.lastIndex) re.lastIndex += 1
    }
  }
  collect(/\[([^\]\n]+)\]\(file:\/\/\/([^)\s]+)\)/g, 2, 1)
  collect(/\[file:\/\/(\/[^\]\n]+)\]/g, 1, null)
  collect(/file:\/\/\/([^\s\)\]"'<>]+)/g, 1, null)
  // The markdown and bare scans consume all three slashes of `file:///`, so
  // their capture is missing the leading slash of the path; the bracketed
  // scan keeps it. Normalize before anything else looks.
  for (const hit of found) {
    if (!hit.path.startsWith("/")) hit.path = "/" + hit.path
  }
  found.sort((a, b) => a.index - b.index)
  return found
}

function refName(hit: ScanHit, path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1) || path
  if (hit.label && !/^file:\/\//.test(hit.label)) {
    return hit.label.replace(/\s+$/, "")
  }
  return base
}

export function parseFileRefs(text: string): FileRef[] {
  const value = String(text ?? "")
  const refs: FileRef[] = []
  const seen = new Set<string>()
  let cursor = 0
  for (const hit of scanFileRefs(value)) {
    // A raw earlier in the document already swallowed this match -- the
    // bare-path scan runs inside every bracketed reference, and without this
    // guard a path with spaces yields a truncated ghost ref.
    if (hit.index < cursor) continue
    cursor = hit.index + hit.raw.length
    const path = hit.path.replace(/\s+$/, "")
    if (seen.has(path)) continue
    seen.add(path)
    refs.push({ raw: hit.raw, path, name: refName(hit, path) })
  }
  return refs
}

export function isMermaidLang(lang: string | undefined): boolean {
  if (!lang) return false
  return /^(mermaid|mmd)$/i.test(lang.trim())
}

export function clampZoom(scale: number, min = 1, max = 5): number {
  return Math.min(max, Math.max(min, scale))
}

export function isDoubleTap(lastTapTime: number, now: number, thresholdMs = 300): boolean {
  const diff = now - lastTapTime
  return diff > 0 && diff < thresholdMs
}

export function parseEnvelope<T = unknown>(raw: string | unknown): T | null {
  if (typeof raw !== "string") return (raw as T) ?? null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
