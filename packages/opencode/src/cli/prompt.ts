export * as Prompt from "./prompt"

import { createInterface } from "node:readline"

// Waits for the user to press Enter on an interactive terminal. Returns
// immediately when the input is not a TTY so scripted runs never block.
export async function waitForEnter(input: NodeJS.ReadableStream = process.stdin): Promise<void> {
  if (!("isTTY" in input) || !input.isTTY) return
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input })
    rl.once("line", () => {
      rl.close()
      resolve()
    })
  })
}
