/**
 * Voice dictation for the prompt input, built on the Web Speech API adapter.
 *
 * The recognition constructor comes injected (see getSpeechRecognitionCtor) so
 * this module stays framework-free and testable without touching globals. A
 * session is continuous with interim results: partial words stream to
 * onInterim while the user speaks, and each settled phrase arrives once, and
 * only once, through onFinal.
 */

export type SpeechRecognitionAlternativeLike = { transcript: string }

export type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike> & { isFinal: boolean }

export type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

export type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

export type DictationOptions = {
  recognition?: () => (new () => SpeechRecognitionLike) | undefined
  lang?: string
  onFinal: (text: string) => void
  onInterim?: (text: string) => void
  onError?: (error: string) => void
  onStateChange?: (listening: boolean) => void
}

const transcriptOf = (event: SpeechRecognitionEventLike, final: boolean) => {
  let text = ""
  const results = event.results
  for (let i = event.resultIndex; i < results.length; i++) {
    const result = results[i]
    if (!result || result.isFinal !== final) continue
    text += result[0]?.transcript ?? ""
  }
  return text.trim()
}

export function createDictation(options: DictationOptions) {
  let instance: SpeechRecognitionLike | undefined
  let listening = false

  const setListening = (next: boolean) => {
    if (listening === next) return
    listening = next
    options.onStateChange?.(next)
  }

  return {
    supported: () => typeof options.recognition === "function",
    listening: () => listening,
    start: () => {
      if (listening) return true
      const create = options.recognition
      if (typeof create !== "function") return false
      const Ctor = create()
      if (!Ctor) return false
      const next = new Ctor()
      next.continuous = true
      next.interimResults = true
      if (options.lang) next.lang = options.lang
      next.onresult = (event) => {
        const interim = transcriptOf(event, false)
        if (interim) options.onInterim?.(interim)
        const final = transcriptOf(event, true)
        if (final) options.onFinal(final)
      }
      next.onerror = (event) => {
        if (event.error) options.onError?.(event.error)
      }
      next.onend = () => setListening(false)
      instance = next
      next.start()
      setListening(true)
      return true
    },
    stop: () => {
      instance?.stop()
    },
    dispose: () => {
      instance?.abort()
      instance = undefined
      setListening(false)
    },
  }
}
