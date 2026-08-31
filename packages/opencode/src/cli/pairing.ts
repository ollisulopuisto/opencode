export * as Pairing from "./pairing"

import { UI } from "./ui"
import { Prompt } from "./prompt"

export const PAIRING_TIMEOUT_MS = 15_000

// The QR pairing code is printed both when starting a server and when
// attaching to an already-running one, so the pause is keyed on the QR being
// shown — not on server ownership — otherwise an attach run wipes the code
// off screen before it can be scanned.
export function shouldPauseForPairing(input: { qr: boolean; owned: boolean }): boolean {
  return input.qr
}

// Pauses the terminal after the QR code is printed so the user can scan it
// before the TUI takes over. Returns immediately on non-TTY stdin so
// scripted runs never block.
export async function pauseForPairing(input: { stdin?: NodeJS.ReadableStream } = {}) {
  UI.println(
    UI.Style.TEXT_INFO_BOLD +
      `Scan the QR code above to pair your phone, then press Enter to start the TUI (auto-starts in ${PAIRING_TIMEOUT_MS / 1000}s)…` +
      UI.Style.TEXT_NORMAL,
  )
  await Prompt.waitForEnter(input.stdin ?? process.stdin, PAIRING_TIMEOUT_MS)
}
