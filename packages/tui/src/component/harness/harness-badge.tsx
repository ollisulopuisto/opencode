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
      {(g) => (
        <box flexDirection="row" gap={1}>
          <text fg={g().allPassed ? theme.success : g().tier2.status === "failed" || g().tier1.status === "failed" || g().tier0.status === "failed" ? theme.error : theme.textMuted}>
            [Harness: {g().allPassed ? "✓ Verified" : g().tier0.status === "failed" ? "✗ T0" : g().tier1.status === "failed" ? "✗ T1" : g().tier2.status === "failed" ? "✗ T2" : "Running"}]
          </text>
        </box>
      )}
    </Show>
  )
}
