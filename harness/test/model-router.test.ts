import { describe, it, expect } from "bun:test"
import { ModelRouter } from "../src/model-router"

describe("ModelRouter", () => {
  it("selects primary model (opencode-go/glm-5.3-flash) by default", () => {
    const router = new ModelRouter()
    expect(router.selectModel()).toBe("opencode-go/glm-5.3-flash")
  })

  it("detects quota and rate-limit error signatures", () => {
    expect(ModelRouter.isQuotaOrAvailabilityError("HTTP 429: Rate limit exceeded")).toBe(true)
    expect(ModelRouter.isQuotaOrAvailabilityError("User has insufficient_quota on account")).toBe(true)
    expect(ModelRouter.isQuotaOrAvailabilityError("Out of credits/balance")).toBe(true)
    expect(
      ModelRouter.isQuotaOrAvailabilityError(
        "5 hour usage limit reached. It will reset in 4 hours 34 minutes. To continue using this model now, enable usage from your available balance",
      ),
    ).toBe(true)
    expect(ModelRouter.isQuotaOrAvailabilityError("SyntaxError: Unexpected token")).toBe(false)
  })

  it("substitutes to fallback model when primary runs out of quota", () => {
    const router = new ModelRouter()
    const primary = router.selectModel()
    expect(primary).toBe("opencode-go/glm-5.3-flash")

    const res = router.handleModelFailure(primary, "429: Monthly quota exhausted")
    expect(res.substituted).toBe(true)
    expect(res.nextModel).toBe("opencode-go/qwen3.8-max")

    expect(router.selectModel()).toBe("opencode-go/qwen3.8-max")

    const subs = router.getSubstitutions()
    expect(subs.length).toBe(1)
    expect(subs[0].fromModel).toBe("opencode-go/glm-5.3-flash")
    expect(subs[0].toModel).toBe("opencode-go/qwen3.8-max")
  })

  it("cascades to tertiary fallback if secondary is also unavailable", () => {
    const router = new ModelRouter()
    router.handleModelFailure("opencode-go/glm-5.3-flash", "429 Rate limit")
    const res2 = router.handleModelFailure("opencode-go/qwen3.8-max", "503 Service Overloaded")

    expect(res2.substituted).toBe(true)
    expect(res2.nextModel).toBe("hetzner/Qwen3.8-27B")
  })

  it("selects GLM-5.3-Flash for implementer/explorer and Kimi-K2.6 for planner/debugger", () => {
    const router = new ModelRouter()
    expect(router.selectModelForRole("explorer")).toBe("opencode-go/glm-5.3-flash")
    expect(router.selectModelForRole("implementer")).toBe("opencode-go/glm-5.3-flash")
    expect(router.selectModelForRole("verifier")).toBe("opencode-go/glm-5.3-flash")
    expect(router.selectModelForRole("planner")).toBe("opencode-go/kimi-k2.6")
    expect(router.selectModelForRole("debugger")).toBe("opencode-go/kimi-k2.6")
  })
})
