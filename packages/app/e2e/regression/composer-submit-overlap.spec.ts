import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/OpenCode/ComposerSubmitOverlapRegression"
const projectID = "proj_composer_submit_overlap_regression"
const sessionID = "ses_composer_submit_overlap_regression"

// A model name long enough that its picker trigger cannot fit next to the other
// composer controls on a phone-width viewport unless the footer can shrink it.
const modelName = "Claude Opus 4.6 Extended Thinking Preview Long Edition"

async function openComposer(page: Page) {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "composer-submit-overlap-regression",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: {
            "long-model": {
              id: "long-model",
              name: modelName,
              limit: { context: 200_000 },
            },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "long-model" },
    },
    sessions: [
      {
        id: sessionID,
        slug: "composer-submit-overlap-regression",
        projectID,
        directory,
        title: "Composer submit overlap regression",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await page.addInitScript(() => {
    localStorage.setItem(
      "settings.v3",
      JSON.stringify({ general: { newLayoutDesigns: true, shouldDisplayTabsToast: false } }),
    )
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  const composer = page.locator('[data-component="prompt-input-v2"]')
  await expectAppVisible(composer)
  return composer
}

test("send button is not overlapped by the model selector on a phone-width viewport", async ({ page }) => {
  const composer = await openComposer(page)

  const editor = composer.locator('[data-component="prompt-input"]')
  await editor.click()
  await page.keyboard.type("hello")

  const submit = composer.locator('[data-action="prompt-submit"]')
  const model = composer.locator('[data-action="prompt-model"]')
  await expect(submit).toBeEnabled()

  const submitBox = await submit.boundingBox()
  const modelBox = await model.boundingBox()
  expect(submitBox).not.toBeNull()
  expect(modelBox).not.toBeNull()

  const overlaps =
    modelBox!.x < submitBox!.x + submitBox!.width &&
    submitBox!.x < modelBox!.x + modelBox!.width &&
    modelBox!.y < submitBox!.y + submitBox!.height &&
    submitBox!.y < modelBox!.y + modelBox!.height
  expect(overlaps).toBe(false)
})

test("tapping send submits the prompt on a phone-width viewport", async ({ page }) => {
  const composer = await openComposer(page)

  const editor = composer.locator('[data-component="prompt-input"]')
  await editor.click()
  await page.keyboard.type("hello")

  const submit = composer.locator('[data-action="prompt-submit"]')
  await expect(submit).toBeEnabled()

  await submit.click()
  await expect(editor).toHaveText("")
  await expect(page.getByRole("main").getByText("hello", { exact: true })).toBeVisible()
})
