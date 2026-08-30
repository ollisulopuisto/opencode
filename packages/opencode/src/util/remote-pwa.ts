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

export function parseFileRefs(text: string): FileRef[] {
  if (!text) return []
  const seen = new Set<string>()
  const results: FileRef[] = []

  // Matches [name](file:///path) or file:///path or [file:///path]
  // Requires empty-host form: file:///... (three slashes followed by non-slash)
  // Rejects file://host/path
  const pattern = /(?:\[([^\]]+)\]\()?file:\/\/\/([^\s\)"'<>]+)\)?/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const rawPath = "/" + match[2]
    // Normalize path to eliminate double slashes while keeping absolute
    const normalized = "/" + rawPath.replace(/^\/+/, "").replace(/\/+/g, "/")
    if (seen.has(normalized)) continue
    seen.add(normalized)

    const base = normalized.split("/").filter(Boolean).pop() ?? "file"
    const label = match[1]?.trim()
    const name = label && !label.startsWith("file://") ? label : base

    results.push({
      path: normalized,
      name,
      raw: match[0],
    })
  }

  return results
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
