import { TextAttributes } from "@opentui/core"
import { createMemo, createResource, Show } from "solid-js"
import { useTheme } from "../../context/theme"
import { useDialog } from "../../ui/dialog"
import { useDirectory } from "../../context/directory"
import { HarnessPanel } from "./harness-panel"
import { HarnessUiPresenter } from "@opencode-ai/core/harness/ui-presenter"
import type { TaskState } from "@opencode-ai/core/harness/state"
import path from "path"

export interface DialogHarnessProps {
  readonly state?: TaskState
  readonly onClose?: () => void
}

export function DialogHarness(props: DialogHarnessProps) {
  const { theme } = useTheme()
  let directory: (() => string) | undefined
  try {
    directory = useDirectory()
  } catch {}

  const handleClose = () => {
    props.onClose?.()
    try {
      useDialog().clear()
    } catch {}
  }

  const [loadedState] = createResource(async () => {
    if (props.state) return props.state
    if (!directory) return undefined
    try {
      const taskFile = path.join(directory(), ".opencode", "task-state.json")
      const file = Bun.file(taskFile)
      if (await file.exists()) {
        return (await file.json()) as TaskState
      }
    } catch {}
    return undefined
  })

  const effectiveState = () => props.state ?? loadedState()
  const draft = createMemo(() => (effectiveState() ? HarnessUiPresenter.presentCommitDraft(effectiveState()!) : undefined))
  const gates = createMemo(() => (effectiveState() ? HarnessUiPresenter.presentVerificationGates(effectiveState()!) : undefined))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Harness Governance & Diagnostics
        </text>
        <text fg={theme.textMuted} onMouseUp={handleClose}>
          esc
        </text>
      </box>

      {/* Embedded Panel */}
      <Show when={effectiveState()} fallback={<text fg={theme.textMuted}>No active harness run found in workspace.</text>}>
        {(s) => <HarnessPanel state={s()} />}
      </Show>

      {/* Diagnostics / Error Callout */}
      <Show when={gates()?.tier2.status === "failed" && gates()?.tier2.diagnostics}>
        <box flexDirection="column" gap={0} backgroundColor={theme.backgroundPanel} padding={1}>
          <text fg={theme.error} attributes={TextAttributes.BOLD}>
            Tier 2 Diagnostic Error:
          </text>
          <text fg={theme.error} wrapMode="word">
            {gates()?.tier2.diagnostics}
          </text>
        </box>
      </Show>

      {/* One-Click CalVer Commit Draft */}
      <Show when={draft()?.readyToCommit}>
        <box flexDirection="column" gap={0} backgroundColor={theme.backgroundPanel} padding={1}>
          <text fg={theme.success} attributes={TextAttributes.BOLD}>
            ✓ 100% Verified — Ready to Commit
          </text>
          <text fg={theme.text}>
            {draft()!.commitTitle} <span style={{ fg: theme.textMuted }}>({draft()!.calverVersion})</span>
          </text>
        </box>
      </Show>
    </box>
  )
}
