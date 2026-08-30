import { createMemo, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { HarnessUiPresenter } from "@opencode-ai/core/harness/ui-presenter"
import type { TaskState } from "@opencode-ai/core/harness/state"

export interface HarnessBadgeProps {
  readonly state?: TaskState
}

export function HarnessBadge(props: HarnessBadgeProps) {
  const { theme } = useTheme()

  const gates = createMemo(() => {
    if (!props.state) return undefined
    return HarnessUiPresenter.presentVerificationGates(props.state)
  })

  return (
    <Show when={gates()}>
      {(g) => {
        const item = () => (typeof g === "function" ? g() : g) ?? gates()
        return (
          <box flexDirection="row" gap={1}>
            <text
              fg={
                item()?.allPassed
                  ? theme.success
                  : item()?.tier2?.status === "failed" ||
                      item()?.tier1?.status === "failed" ||
                      item()?.tier0?.status === "failed"
                    ? theme.error
                    : theme.textMuted
              }
            >
              [Harness:{" "}
              {item()?.allPassed
                ? "✓ Verified"
                : item()?.tier0?.status === "failed"
                  ? "✗ T0"
                  : item()?.tier1?.status === "failed"
                    ? "✗ T1"
                    : item()?.tier2?.status === "failed"
                      ? "✗ T2"
                      : "Running"}
              ]
            </text>
          </box>
        )
      }}
    </Show>
  )
}
