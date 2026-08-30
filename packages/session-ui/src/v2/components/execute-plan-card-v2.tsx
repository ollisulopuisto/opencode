import { Show, createSignal, type JSX } from "solid-js"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"

export interface ExecutePlanCardV2Props {
  planText: string
  onExecutePlan: (planText: string) => void
  disabled?: boolean
}

export function ExecutePlanCardV2(props: ExecutePlanCardV2Props): JSX.Element {
  const [executing, setExecuting] = createSignal(false)

  const handleExecute = () => {
    setExecuting(true)
    props.onExecutePlan(props.planText)
  }

  return (
    <div class="my-3 flex flex-col gap-3 rounded-lg border border-v2-border-border-base bg-v2-surface-surface-raised p-4 shadow-sm">
      <div class="flex items-center gap-2 text-sm font-medium text-v2-text-text-base">
        <Icon name="check-circle" class="size-4 text-green-500" />
        <span>Plan Complete — Ready to Implement</span>
      </div>

      <div class="line-clamp-3 text-xs text-v2-text-text-muted">
        {props.planText}
      </div>

      <div class="flex items-center justify-between pt-1">
        <span class="text-[11px] text-v2-text-text-faint">
          Switches active agent from Plan to Build mode
        </span>
        <ButtonV2
          appearance="primary"
          size="small"
          disabled={props.disabled || executing()}
          onClick={handleExecute}
        >
          {executing() ? "Switching to Build..." : "🚀 Execute Plan"}
        </ButtonV2>
      </div>
    </div>
  )
}
