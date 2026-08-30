export * as Prompt from "./prompt"

import { createInterface } from "node:readline"

// Waits for the user to press Enter on an interactive terminal, giving up
// after `timeoutMs` so an unattended terminal still proceeds. Returns
// immediately when the input is not a TTY so scripted runs never block.
export async function waitForEnter(
  input: NodeJS.ReadableStream = process.stdin,
  timeoutMs?: number,
): Promise<void> {
  if (!("isTTY" in input) || !input.isTTY) return
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      rl.close()
      resolve()
    }
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            finish()
          }, timeoutMs)
    if (timer) timer.unref?.()
    rl.once("line", finish)
  })
}
