// Streaming text tails fight the DOM: every paced tick re-morphs the growing
// block, which destroys any text selection anchored inside it. When the
// streamed content is plain prose (no markdown constructs) and only grows at
// the end, we can skip morphdom entirely and append the delta as a bare text
// node — the DOM provably mirrors the previous raw in that case.

// Characters that change markdown structure or rendering. Plain prose that
// avoids these renders verbatim inside a single paragraph. Sentence
// punctuation (.,:;!?-"()…) is deliberately allowed — bare parens or dashes
// without a line start render verbatim. The update path additionally
// verifies the live DOM text equals the previous raw before appending.
const MARKDOWN_SPECIAL = new Set([
  "#",
  ">",
  "*",
  "_",
  "`",
  "[",
  "]",
  "!",
  "~",
  "|",
  "<",
  "\\",
  "\n",
  "&",
])

export function isPlainText(raw: string): boolean {
  if (raw.length === 0) return false
  for (const char of raw) {
    if (MARKDOWN_SPECIAL.has(char)) return false
  }
  return true
}

export function canFastAppend(previousRaw: string, nextRaw: string): boolean {
  if (nextRaw.length <= previousRaw.length) return false
  if (!nextRaw.startsWith(previousRaw)) return false
  // The previously rendered DOM must have been plain text to stay verbatim.
  return isPlainText(nextRaw)
}

export function textDelta(previousRaw: string, nextRaw: string): string {
  return nextRaw.slice(previousRaw.length)
}
