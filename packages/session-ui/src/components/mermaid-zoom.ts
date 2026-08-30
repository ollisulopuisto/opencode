// Pinch-zoom math for rendered mermaid diagrams, shared with the touch
// handlers in mermaid.ts. Mirrors the proven iOS behaviour from agy-remote's
// PWA: zoom widens the SVG from its natural width (no CSS transforms, so the
// container scrolls instead of blurring), and returning to scale 1 restores
// the natural layout.
export const MERMAID_ZOOM_MIN = 1
export const MERMAID_ZOOM_MAX = 4

export function clampZoom(scale: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, scale))
}

export function pinchScale(startScale: number, startDistance: number, currentDistance: number): number {
  if (startDistance <= 0) return startScale
  return clampZoom((startScale * currentDistance) / startDistance, MERMAID_ZOOM_MIN, MERMAID_ZOOM_MAX)
}

export function zoomedWidth(baseWidth: number, scale: number): number | undefined {
  if (scale === 1) return undefined
  return Math.round(baseWidth * scale)
}

export function touchDistance(touches: { clientX: number; clientY: number }[]): number {
  const [a, b] = touches
  if (!a || !b) return 0
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

type PinchTouch = { clientX: number; clientY: number }

// Wires iOS-proven pinch zoom onto a rendered diagram container: two fingers
// widen the SVG from its natural width, one finger keeps scrolling, and
// returning to scale 1 restores the natural layout.
export function attachMermaidZoom(container: HTMLElement): void {
  const svg = container.querySelector("svg")
  if (!(svg instanceof SVGSVGElement)) return
  let startScale = 1
  let startDistance = 0
  let baseWidth: number | undefined

  const apply = (scale: number) => {
    if (!baseWidth) baseWidth = container.clientWidth
    const width = zoomedWidth(baseWidth, scale)
    if (width === undefined) {
      delete container.dataset.zoom
      svg.style.maxWidth = ""
      svg.style.width = ""
      return
    }
    container.dataset.zoom = String(scale)
    svg.style.maxWidth = "none"
    svg.style.width = `${width}px`
  }

  container.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 2) return
      startDistance = touchDistance(event.touches as unknown as PinchTouch[])
      startScale = Number.parseFloat(container.dataset.zoom || "1")
      if (!baseWidth) baseWidth = container.clientWidth
    },
    { passive: true },
  )
  container.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length !== 2 || startDistance <= 0) return
      event.preventDefault()
      apply(pinchScale(startScale, startDistance, touchDistance(event.touches as unknown as PinchTouch[])))
    },
    { passive: false },
  )
  container.addEventListener(
    "touchend",
    (event) => {
      if (event.touches.length > 0) return
      startDistance = 0
    },
    { passive: true },
  )
}
