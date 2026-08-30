import { describe, expect, test } from "bun:test"
import { createDictation, type SpeechRecognitionEventLike, type SpeechRecognitionLike } from "./dictation"

class FakeRecognition implements SpeechRecognitionLike {
  continuous = false
  interimResults = false
  lang = ""
  started = false
  stopped = false
  aborted = false
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null
  onerror: ((event: { error?: string }) => void) | null = null
  onend: (() => void) | null = null

  start() {
    this.started = true
  }
  stop() {
    this.stopped = true
  }
  abort() {
    this.aborted = true
  }
  emit(result: SpeechRecognitionEventLike) {
    this.onresult?.(result)
  }
  fail(error: string) {
    this.onerror?.({ error })
  }
  end() {
    this.onend?.()
  }
}

const result = (chunks: Array<{ transcript: string }>, isFinal: boolean): SpeechRecognitionEventLike => {
  // A real result item is array-like (numeric transcript indices) carrying a
  // finality flag; Object.assign reproduces exactly that shape, no cast.
  const item = Object.assign(chunks, { isFinal })
  return { resultIndex: 0, results: { 0: item, length: 1 } }
}

function setup() {
  const instances: FakeRecognition[] = []
  const finals: string[] = []
  const interims: string[] = []
  const errors: string[] = []
  const states: boolean[] = []
  const dictation = createDictation({
    // The adapter contract hands back a constructor; each start() builds one.
    recognition: () => {
      class ScopedRecognition extends FakeRecognition {
        constructor() {
          super()
          instances.push(this)
        }
      }
      return ScopedRecognition
    },
    onFinal: (text) => finals.push(text),
    onInterim: (text) => interims.push(text),
    onError: (error) => errors.push(error),
    onStateChange: (listening) => states.push(listening),
  })
  return { dictation, instances, finals, interims, errors, states }
}

describe("dictation", () => {
  test("reports no support without a recognition factory", () => {
    const dictation = createDictation({ onFinal: () => {} })
    expect(dictation.supported()).toBe(false)
    expect(dictation.start()).toBe(false)
    expect(dictation.listening()).toBe(false)
  })

  test("start creates a continuous interim recognition and reports listening", () => {
    const { dictation, instances, states } = setup()
    expect(dictation.supported()).toBe(true)
    expect(dictation.start()).toBe(true)
    const instance = instances[0]
    expect(instance.started).toBe(true)
    expect(instance.continuous).toBe(true)
    expect(instance.interimResults).toBe(true)
    expect(dictation.listening()).toBe(true)
    expect(states).toEqual([true])
  })

  test("final results reach onFinal, interim ones onInterim", () => {
    const { dictation, instances, finals, interims } = setup()
    dictation.start()
    const instance = instances[0]
    instance.emit(result([{ transcript: "hello " }], false))
    instance.emit(result([{ transcript: "hello world" }], true))
    // Interim text is replace-only (the UI redraws it each event), so it is
    // trimmed; finals arrive clean and the consumer joins them.
    expect(interims).toEqual(["hello"])
    expect(finals).toEqual(["hello world"])
  })

  test("a final transcript of whitespace is dropped", () => {
    const { dictation, instances, finals } = setup()
    dictation.start()
    instances[0].emit(result([{ transcript: "   " }], true))
    expect(finals).toEqual([])
  })

  test("errors surface and end resets the listening state", () => {
    const { dictation, instances, errors, states } = setup()
    dictation.start()
    instances[0].fail("not-allowed")
    expect(errors).toEqual(["not-allowed"])
    instances[0].end()
    expect(dictation.listening()).toBe(false)
    expect(states).toEqual([true, false])
  })

  test("stop requests a graceful stop and dispose aborts", () => {
    const { dictation, instances } = setup()
    dictation.start()
    dictation.stop()
    expect(instances[0].stopped).toBe(true)
    dictation.dispose()
    expect(instances[0].aborted).toBe(true)
  })

  test("start while already listening is a no-op on the same instance", () => {
    const { dictation, instances, states } = setup()
    dictation.start()
    dictation.start()
    expect(instances.length).toBe(1)
    expect(states).toEqual([true])
  })
})
