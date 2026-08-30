import { describe, expect, test } from "bun:test"
import {
  MERMAID_ZOOM_MAX,
  MERMAID_ZOOM_MIN,
  clampZoom,
  pinchScale,
  zoomedWidth,
} from "./mermaid-zoom"

describe("clampZoom", () => {
  test("keeps a scale inside the min/max window", () => {
    expect(clampZoom(1.5, MERMAID_ZOOM_MIN, MERMAID_ZOOM_MAX)).toBe(1.5)
    expect(clampZoom(0.2, MERMAID_ZOOM_MIN, MERMAID_ZOOM_MAX)).toBe(MERMAID_ZOOM_MIN)
    expect(clampZoom(9, MERMAID_ZOOM_MIN, MERMAID_ZOOM_MAX)).toBe(MERMAID_ZOOM_MAX)
  })
})

describe("pinchScale", () => {
  test("scales proportionally to the pinch distance ratio", () => {
    expect(pinchScale(1, 100, 200)).toBe(2)
    expect(pinchScale(2, 200, 100)).toBe(1)
  })

  test("clamps the resulting scale", () => {
    expect(pinchScale(1, 100, 1000)).toBe(MERMAID_ZOOM_MAX)
    expect(pinchScale(2, 200, 1)).toBe(MERMAID_ZOOM_MIN)
  })
})

describe("zoomedWidth", () => {
  test("returns undefined at natural zoom so CSS takes over", () => {
    expect(zoomedWidth(320, 1)).toBeUndefined()
  })

  test("widens the natural width by the zoom factor", () => {
    expect(zoomedWidth(320, 2)).toBe(640)
  })
})
