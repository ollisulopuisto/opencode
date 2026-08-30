import { For, Show, createSignal, type JSX } from "solid-js"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"

export interface WorkingTreeDiffV2Props {
  diff: string
  stat?: string
  files: string[]
  onRefresh?: () => void
  onSelectFile?: (file: string) => void
}

export function WorkingTreeDiffV2(props: WorkingTreeDiffV2Props): JSX.Element {
  const [selectedFile, setSelectedFile] = createSignal<string>(props.files[0] || "")

  return (
    <div class="flex h-full w-full flex-col overflow-hidden bg-v2-surface-surface-base text-v2-text-text-base">
      <div class="flex items-center justify-between border-b border-v2-border-border-base px-4 py-2">
        <div class="flex items-center gap-2">
          <Icon name="git-branch" class="size-4 text-v2-text-text-muted" />
          <span class="text-xs font-medium">Working Tree Changes</span>
          <span class="rounded bg-v2-surface-surface-raised px-1.5 py-0.5 text-[10px] text-v2-text-text-muted">
            {props.files.length} {props.files.length === 1 ? "file" : "files"}
          </span>
        </div>

        <Show when={props.onRefresh}>
          <ButtonV2 size="small" appearance="secondary" onClick={props.onRefresh}>
            Refresh
          </ButtonV2>
        </Show>
      </div>

      <div class="flex flex-1 overflow-hidden">
        {/* Left file sidebar */}
        <div class="w-64 border-r border-v2-border-border-base overflow-y-auto p-2">
          <For each={props.files}>
            {(file) => (
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-v2-surface-surface-raised"
                classList={{
                  "bg-v2-surface-surface-raised font-semibold text-v2-text-text-base": selectedFile() === file,
                  "text-v2-text-text-muted": selectedFile() !== file,
                }}
                onClick={() => {
                  setSelectedFile(file)
                  props.onSelectFile?.(file)
                }}
              >
                <Icon name="file" class="size-3.5 shrink-0 opacity-70" />
                <span class="truncate">{file}</span>
              </button>
            )}
          </For>

          <Show when={props.files.length === 0}>
            <div class="p-4 text-center text-xs text-v2-text-text-faint">
              Working tree is clean.
            </div>
          </Show>
        </div>

        {/* Right unified patch viewer */}
        <div class="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          <Show when={props.stat}>
            <div class="mb-4 rounded border border-v2-border-border-base bg-v2-surface-surface-raised p-2 text-v2-text-text-muted">
              <pre class="whitespace-pre">{props.stat}</pre>
            </div>
          </Show>

          <pre class="whitespace-pre overflow-x-auto text-v2-text-text-base">
            {props.diff || "No changes in working tree."}
          </pre>
        </div>
      </div>
    </div>
  )
}
