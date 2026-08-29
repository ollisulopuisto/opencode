import { Effect } from "effect"
import { define } from "../internal"
import { Flag } from "../../flag/flag"

export const MLXPlugin = define({
  id: "mlx",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.aisdk.sdk(
      Effect.fn(function* (evt) {
        if (evt.sdk) return
        if (!evt.package.includes("mlx")) return
        if (evt.options.includeUsage !== false) evt.options.includeUsage = true
        const mod = yield* Effect.promise(() => import("@ai-sdk/openai-compatible"))
        evt.sdk = mod.createOpenAICompatible({
          name: "mlx",
          baseURL: Flag.OPENCODE_MLX_URL,
          headers: {},
          ...evt.options,
        } as any)
      }),
    )
  }),
})
