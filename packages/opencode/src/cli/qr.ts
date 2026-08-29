import QRCode from "qrcode"
import { networkInterfaces } from "os"
import { spawnSync } from "child_process"
import { UI } from "./ui"

export type NetworkEndpoints = {
  tailscale?: string
  magicDns?: string
  lan?: string[]
  localhost: string
}

export function detectNetworkEndpoints(port: number): NetworkEndpoints {
  const nets = networkInterfaces()
  const lan: string[] = []
  let tailscale: string | undefined
  let magicDns: string | undefined

  // 1. Try querying Tailscale CLI directly if installed
  try {
    const tsIp = spawnSync("tailscale", ["ip", "-4"], { encoding: "utf8", timeout: 1000 })
    if (tsIp.status === 0 && tsIp.stdout.trim()) {
      tailscale = `http://${tsIp.stdout.trim()}:${port}`
    }

    const tsStatus = spawnSync("tailscale", ["status", "--json"], { encoding: "utf8", timeout: 1000 })
    if (tsStatus.status === 0 && tsStatus.stdout) {
      try {
        const json = JSON.parse(tsStatus.stdout)
        if (json.Self?.DNSName) {
          const dns = json.Self.DNSName.replace(/\.$/, "")
          magicDns = `https://${dns}`
        }
      } catch {}
    }
  } catch {}

  // 2. Scan network interfaces
  for (const name of Object.keys(nets)) {
    const net = nets[name]
    if (!net) continue

    for (const netInfo of net) {
      if (netInfo.internal || netInfo.family !== "IPv4") continue
      if (netInfo.address.startsWith("172.")) continue // Docker bridges

      // Tailscale CGNAT range is 100.64.0.0/10 (100.64.0.0 - 100.127.255.255) or interface tailscale/utun
      if (
        !tailscale &&
        (netInfo.address.startsWith("100.") || name.toLowerCase().includes("tailscale") || name.startsWith("utun"))
      ) {
        tailscale = `http://${netInfo.address}:${port}`
      } else {
        lan.push(`http://${netInfo.address}:${port}`)
      }
    }
  }

  return {
    tailscale,
    magicDns,
    lan,
    localhost: `http://localhost:${port}`,
  }
}

export async function printPairingInfo(options: { port: number; password?: string; socket?: string }) {
  if (options.socket) {
    UI.println(UI.Style.TEXT_INFO_BOLD + "  Socket:            ", UI.Style.TEXT_NORMAL, `unix:${options.socket}`)
    return
  }

  const endpoints = detectNetworkEndpoints(options.port)
  const password = options.password ?? process.env.OPENCODE_SERVER_PASSWORD

  UI.empty()
  UI.println(UI.Style.TEXT_INFO_BOLD + "  Local access:      ", UI.Style.TEXT_NORMAL, endpoints.localhost)

  // Preferred Tailscale Endpoints
  if (endpoints.tailscale) {
    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD + "  Tailscale access:  ",
      UI.Style.TEXT_NORMAL,
      endpoints.tailscale,
      UI.Style.TEXT_SUCCESS + " (Recommended & Encrypted)",
    )
  }
  if (endpoints.magicDns) {
    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD + "  Tailscale HTTPS:   ",
      UI.Style.TEXT_NORMAL,
      `${endpoints.magicDns}:${options.port}`,
      UI.Style.TEXT_SUCCESS + " (MagicDNS)",
    )
  }

  // Fallback LAN Endpoints
  if (endpoints.lan && endpoints.lan.length > 0) {
    for (const lanUrl of endpoints.lan) {
      UI.println(UI.Style.TEXT_DIM + "  LAN access:        ", UI.Style.TEXT_NORMAL, lanUrl)
    }
  }

  // Security warning for unencrypted LAN
  if (!endpoints.tailscale && endpoints.lan && endpoints.lan.length > 0) {
    UI.empty()
    UI.println(
      UI.Style.TEXT_WARNING_BOLD + "  ⚠️  Security Notice: ",
      UI.Style.TEXT_NORMAL,
      "Listening over unencrypted HTTP on local Wi-Fi/LAN.",
    )
    UI.println(
      UI.Style.TEXT_DIM + "     Use Tailscale (`tailscale up`) for automatic end-to-end WireGuard encryption.",
    )
  } else if (endpoints.tailscale) {
    UI.empty()
    UI.println(
      UI.Style.TEXT_SUCCESS + "  🔒 End-to-end WireGuard encryption active via Tailscale mesh network.",
    )
  }

  // Target Pairing URL for QR code
  const targetHostUrl = endpoints.tailscale ?? (endpoints.lan && endpoints.lan[0]) ?? endpoints.localhost
  const urlObj = new URL(targetHostUrl)
  if (password) {
    urlObj.username = "opencode"
    urlObj.password = password
  }
  const pairingUrl = urlObj.toString()

  try {
    const qr = await QRCode.toString(pairingUrl, { type: "terminal", small: true })
    UI.empty()
    UI.println(UI.Style.TEXT_INFO_BOLD + "  Scan with phone camera to pair PWA / Web UI:")
    UI.empty()
    // Indent QR code
    const lines = qr.split("\n")
    for (const line of lines) {
      UI.println("  " + line)
    }
    UI.empty()
  } catch (err) {
    // If QR rendering fails, fallback gracefully
  }
}
