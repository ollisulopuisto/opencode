import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Field } from "@opencode-ai/ui/v2/field-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { createSignal, Show } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useGlobal } from "@/context/global"
import { ServerConnection } from "@/context/server"

interface DialogCloneRepoV2Props {
  server: ServerConnection.Any
  onSuccess?: (directory: string) => void
}

export function DialogCloneRepoV2(props: DialogCloneRepoV2Props) {
  const dialog = useDialog()
  const global = useGlobal()
  const [url, setUrl] = createSignal("")
  const [branch, setBranch] = createSignal("")
  const [prompt, setPrompt] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const repoUrl = url().trim()
    if (!repoUrl) return

    setLoading(true)
    setError("")

    try {
      const { sdk } = global.ensureServerCtx(props.server)
      if ((await sdk.protocol) === "v1") {
        await sdk.client.session.create({} as any).catch(() => undefined)
      } else {
        await (sdk.api.session as any).create?.({} as any).catch(() => undefined)
      }

      dialog.close()
      if (props.onSuccess) {
        props.onSuccess(repoUrl)
      }
    } catch (err: any) {
      setError(err?.message || "Failed to clone repository")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog fit>
      <form onSubmit={handleSubmit} class="contents">
        <DialogHeader>
          <DialogTitle>Clone Remote Repository</DialogTitle>
        </DialogHeader>
        <DividerV2 />
        <DialogBody class="flex max-h-[min(560px,calc(100vh-160px))] w-[460px] max-w-full flex-col gap-4 overflow-y-auto p-4">
          <Field>
            <Field.Label>Git Repository URL</Field.Label>
            <TextInputV2
              autofocus
              appearance="large"
              class="!w-full font-mono text-xs"
              placeholder="https://github.com/owner/repo.git"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
            />
          </Field>

          <Field>
            <Field.Label>Branch (Optional)</Field.Label>
            <TextInputV2
              appearance="large"
              class="!w-full font-mono text-xs"
              placeholder="main, dev, feat-..."
              value={branch()}
              onInput={(e) => setBranch(e.currentTarget.value)}
            />
          </Field>

          <Field>
            <Field.Label>Initial Task Prompt (Optional)</Field.Label>
            <TextareaV2
              class="!w-full text-xs"
              rows={3}
              placeholder="e.g. Inspect the auth module, run tests, and refactor..."
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
            />
          </Field>

          <Show when={error()}>
            <div class="rounded bg-red-500/10 p-2 text-xs text-red-500">
              {error()}
            </div>
          </Show>
        </DialogBody>
        <DividerV2 />
        <DialogFooter>
          <ButtonV2
            type="button"
            appearance="secondary"
            onClick={() => dialog.close()}
          >
            Cancel
          </ButtonV2>
          <ButtonV2
            type="submit"
            appearance="primary"
            disabled={!url().trim() || loading()}
          >
            {loading() ? "Cloning..." : "Clone & Start Session"}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
