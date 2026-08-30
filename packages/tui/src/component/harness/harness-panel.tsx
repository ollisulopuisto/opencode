import { For, Show, createMemo } from "solid-js"
import { useTheme } from "../../context/theme"
import { HarnessUiPresenter } from "@opencode-ai/core/harness/ui-presenter"
import type { TaskState } from "@opencode-ai/core/harness/state"

export interface HarnessPanelProps {
  readonly state: TaskState
}

export function HarnessPanel(props: HarnessPanelProps) {
  const { theme } = useTheme()

  const gates = createMemo(() => HarnessUiPresenter.presentVerificationGates(props.state))
  const plan = createMemo(() => HarnessUiPresenter.presentPlanProgress(props.state))
  const budget = createMemo(() => HarnessUiPresenter.presentBudget(props.state))
  const supervisor = createMemo(() => HarnessUiPresenter.presentSupervisor(props.state))

  return (
    <box flexDirection="column" gap={1} padding={1}>
      {/* 1. Verification Tiers Bar */}
      <box flexDirection="column" gap={0}>
        <text fg={theme.textMuted}>
          <b>VERIFICATION GATES</b>
        </text>
        <box flexDirection="row" gap={2}>
          <text fg={gates()?.tier0?.status === "passed" ? theme.success : gates()?.tier0?.status === "failed" ? theme.error : theme.textMuted}>
            [{gates()?.tier0?.status === "passed" ? "✓" : gates()?.tier0?.status === "failed" ? "✗" : "○"}] Tier 0
          </text>
          <text fg={gates()?.tier1?.status === "passed" ? theme.success : gates()?.tier1?.status === "failed" ? theme.error : theme.textMuted}>
            [{gates()?.tier1?.status === "passed" ? "✓" : gates()?.tier1?.status === "failed" ? "✗" : "○"}] Tier 1
          </text>
          <text fg={gates()?.tier2?.status === "passed" ? theme.success : gates()?.tier2?.status === "failed" ? theme.error : theme.textMuted}>
            [{gates()?.tier2?.status === "passed" ? "✓" : gates()?.tier2?.status === "failed" ? "✗" : "○"}] Tier 2
          </text>
        </box>
      </box>

      {/* 2. Active Hypothesis / Supervisory Directive Banner */}
      <Show when={supervisor()?.activeHypothesis || supervisor()?.hasActiveDirective}>
        <box flexDirection="column" gap={0}>
          <Show when={supervisor()?.activeHypothesis}>
            <text fg={theme.info}>
              <b>Hypothesis:</b> {supervisor()?.activeHypothesis}
            </text>
          </Show>
          <Show when={supervisor()?.hasActiveDirective}>
            <text fg={theme.warning}>
              <b>Directive:</b> {supervisor()?.activeDirective}
            </text>
          </Show>
        </box>
      </Show>

      {/* 3. Work-Unit Progress DAG */}
      <Show when={(plan()?.totalUnits ?? 0) > 0}>
        <box flexDirection="column" gap={0}>
          <text fg={theme.textMuted}>
            <b>PLAN PROGRESS ({plan()?.completedUnits ?? 0}/{plan()?.totalUnits ?? 0})</b>
          </text>
          <For each={plan()?.units ?? []}>
            {(unit) => (
              <box flexDirection="row" gap={1}>
                <text fg={unit?.status === "verified" ? theme.success : unit?.status === "in_progress" ? theme.warning : theme.textMuted}>
                  [{unit?.status === "verified" ? "✓" : unit?.status === "in_progress" ? "▶" : " "}] {unit?.title}
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>

      {/* 4. Change Budget Meter */}
      <box flexDirection="row" gap={2}>
        <text fg={budget()?.isExceeded ? theme.error : theme.textMuted}>
          Files: {budget()?.filesChangedCount ?? 0}/{budget()?.maxFiles ?? 5}
        </text>
        <text fg={budget()?.isExceeded ? theme.error : theme.textMuted}>
          Lines: +{budget()?.linesAdded ?? 0}/-{budget()?.linesDeleted ?? 0}
        </text>
      </box>
    </box>
  )
}
