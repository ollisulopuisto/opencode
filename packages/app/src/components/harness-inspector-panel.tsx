import { createMemo, For, Show } from "solid-js"
import { HarnessUiPresenter } from "@opencode-ai/core/harness/ui-presenter"
import type { TaskState } from "@opencode-ai/core/harness/state"

export interface HarnessInspectorPanelProps {
  readonly state: TaskState
  readonly onCommit?: (commitMessage: string) => void
}

export function HarnessInspectorPanel(props: HarnessInspectorPanelProps) {
  const gates = createMemo(() => HarnessUiPresenter.presentVerificationGates(props.state))
  const plan = createMemo(() => HarnessUiPresenter.presentPlanProgress(props.state))
  const budget = createMemo(() => HarnessUiPresenter.presentBudget(props.state))
  const supervisor = createMemo(() => HarnessUiPresenter.presentSupervisor(props.state))
  const draft = createMemo(() => HarnessUiPresenter.presentCommitDraft(props.state))

  return (
    <div class="flex flex-col gap-4 p-4 bg-panel border border-border-base rounded-xl text-text-base text-sm">
      {/* Header */}
      <div class="flex items-center justify-between border-b border-border-base pb-3">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-base">Harness Autonomous Governance</span>
          <span class="text-xs px-2 py-0.5 rounded-full font-mono bg-surface text-text-muted border border-border-base">
            {props.state.currentState}
          </span>
        </div>
        <span class="text-xs text-text-muted font-mono">{props.state.taskId}</span>
      </div>

      {/* 1. Verification Gates */}
      <div class="flex flex-col gap-2">
        <div class="text-xs font-semibold text-text-muted uppercase tracking-wider">Multi-Tier Verification Gates</div>
        <div class="grid grid-cols-3 gap-2">
          {/* Tier 0 */}
          <div class={`p-2.5 rounded-lg border flex flex-col gap-1 ${gates().tier0.status === "passed" ? "bg-success/10 border-success/30 text-success" : gates().tier0.status === "failed" ? "bg-error/10 border-error/30 text-error" : "bg-surface border-border-base text-text-muted"}`}>
            <div class="flex items-center justify-between font-medium">
              <span>Tier 0: Types & Lint</span>
              <span>{gates().tier0.status === "passed" ? "✓" : gates().tier0.status === "failed" ? "✗" : "○"}</span>
            </div>
            <Show when={gates().tier0.durationMs}>
              <span class="text-xs opacity-75 font-mono">{gates().tier0.durationMs}ms</span>
            </Show>
          </div>

          {/* Tier 1 */}
          <div class={`p-2.5 rounded-lg border flex flex-col gap-1 ${gates().tier1.status === "passed" ? "bg-success/10 border-success/30 text-success" : gates().tier1.status === "failed" ? "bg-error/10 border-error/30 text-error" : "bg-surface border-border-base text-text-muted"}`}>
            <div class="flex items-center justify-between font-medium">
              <span>Tier 1: Targeted Tests</span>
              <span>{gates().tier1.status === "passed" ? "✓" : gates().tier1.status === "failed" ? "✗" : "○"}</span>
            </div>
            <Show when={gates().tier1.durationMs}>
              <span class="text-xs opacity-75 font-mono">{gates().tier1.durationMs}ms</span>
            </Show>
          </div>

          {/* Tier 2 */}
          <div class={`p-2.5 rounded-lg border flex flex-col gap-1 ${gates().tier2.status === "passed" ? "bg-success/10 border-success/30 text-success" : gates().tier2.status === "failed" ? "bg-error/10 border-error/30 text-error" : "bg-surface border-border-base text-text-muted"}`}>
            <div class="flex items-center justify-between font-medium">
              <span>Tier 2: Regression</span>
              <span>{gates().tier2.status === "passed" ? "✓" : gates().tier2.status === "failed" ? "✗" : "○"}</span>
            </div>
            <Show when={gates().tier2.durationMs}>
              <span class="text-xs opacity-75 font-mono">{gates().tier2.durationMs}ms</span>
            </Show>
          </div>
        </div>

        {/* Failed diagnostics popover / callout */}
        <Show when={gates().tier2.status === "failed" && gates().tier2.diagnostics}>
          <div class="p-3 bg-error/10 border border-error/30 rounded-lg text-xs font-mono text-error overflow-x-auto">
            <div class="font-semibold mb-1">Tier 2 Diagnostic Failure:</div>
            <pre class="whitespace-pre-wrap">{gates().tier2.diagnostics}</pre>
          </div>
        </Show>
      </div>

      {/* 2. Active Hypothesis & Directive */}
      <Show when={supervisor().activeHypothesis || supervisor().hasActiveDirective}>
        <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-surface border border-border-base">
          <Show when={supervisor().activeHypothesis}>
            <div class="text-xs">
              <span class="font-semibold text-accent">Active Hypothesis:</span> {supervisor().activeHypothesis}
            </div>
          </Show>
          <Show when={supervisor().hasActiveDirective}>
            <div class="text-xs text-warning">
              <span class="font-semibold">Supervisory Directive:</span> {supervisor().activeDirective}
            </div>
          </Show>
        </div>
      </Show>

      {/* 3. Work-Unit DAG Checklist */}
      <Show when={plan().totalUnits > 0}>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider">
            <span>Work-Unit Plan ({plan().completedUnits}/{plan().totalUnits})</span>
            <span>{plan().percentage}%</span>
          </div>
          <div class="flex flex-col gap-1">
            <For each={plan().units}>
              {(unit) => (
                <div class="flex items-center justify-between p-2 rounded-md bg-surface border border-border-base text-xs">
                  <div class="flex items-center gap-2">
                    <span class={unit.status === "verified" ? "text-success" : unit.status === "in_progress" ? "text-warning" : "text-text-muted"}>
                      {unit.status === "verified" ? "✓" : unit.status === "in_progress" ? "▶" : "○"}
                    </span>
                    <span class={unit.status === "verified" ? "line-through opacity-60" : ""}>{unit.title}</span>
                  </div>
                  <span class="text-text-muted text-[11px] font-mono">{unit.status}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* 4. Change Budget Meter */}
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider">
          <span>Change Budget Guard</span>
          <span>{budget().percentageOfBudget}% of limit</span>
        </div>
        <div class="w-full bg-surface border border-border-base h-2 rounded-full overflow-hidden">
          <div
            class={`h-full ${budget().isExceeded ? "bg-error" : budget().percentageOfBudget > 80 ? "bg-warning" : "bg-accent"}`}
            style={{ width: `${budget().percentageOfBudget}%` }}
          />
        </div>
        <div class="flex items-center justify-between text-xs text-text-muted font-mono">
          <span>Files: {budget().filesChangedCount} / {budget().maxFiles}</span>
          <span>Lines: +{budget().linesAdded} / -{budget().linesDeleted}</span>
        </div>
      </div>

      {/* 5. One-Click CalVer Commit */}
      <Show when={draft().readyToCommit}>
        <div class="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/30 text-success">
          <div class="flex flex-col">
            <span class="font-semibold text-xs">{draft().commitTitle}</span>
            <span class="text-[11px] font-mono opacity-80">{draft().calverVersion}</span>
          </div>
          <button
            type="button"
            class="px-3 py-1 bg-success text-white rounded font-medium text-xs hover:opacity-90 transition"
            onClick={() => props.onCommit?.(draft().fullMessage)}
          >
            Commit & Sign
          </button>
        </div>
      </Show>
    </div>
  )
}
