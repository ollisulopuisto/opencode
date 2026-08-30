import { expect, test, type Page } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const home = "C:/OpenCode"
const directory = `${home}/PickerTreeRegression`
const projectID = "proj_picker_tree_regression"

// The dialog navigates to the home directory first, so the tree can expand and
// select a nested project folder there. The mock lists demo-project under the
// home directory (the /file route ignores its path argument).
const fileList = () => [
  { name: "demo-project", path: "demo-project", absolute: `${home}/demo-project`, type: "directory" as const, ignored: false },
]

async function openAddProjectDialog(page: Page) {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "picker-tree-regression",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: { "mock-model": { id: "mock-model", name: "Mock Model", limit: { context: 200_000 } } },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "mock-model" },
    },
    sessions: [],
    pageMessages: () => ({ items: [] }),
    fileList,
    findFiles: () => [],
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })
  await page.goto("/")
  const add = page.getByRole("button", { name: "Add project" }).first()
  await expectAppVisible(add)
  await add.click()
}

test("project dialog browses directories as a tree on the web", async ({ page }) => {
  await openAddProjectDialog(page)

  const dialog = page.locator(".directory-picker-v2")
  await expect(dialog).toBeVisible()

  // The tree lists the home directory's folders as selectable rows.
  const row = dialog.getByRole("treeitem", { name: "demo-project" })
  await expect(row).toHaveCount(1)
})

test("selecting a folder in the tree resolves that project", async ({ page }) => {
  await openAddProjectDialog(page)

  const dialog = page.locator(".directory-picker-v2")
  await expect(dialog).toBeVisible()

  const row = dialog.getByRole("treeitem", { name: "demo-project" })
  await row.click()

  const select = dialog.getByRole("button", { name: "Select folder" })
  await expect(select).toBeEnabled()
  await select.click()

  await expect(dialog).toBeHidden()

  // The picker hands the chosen directory to the app, which records it as the
  // last project. (Full navigation is not asserted here because the mock cannot
  // describe a real project for the new directory.)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("opencode.global.dat:server") ?? "{}")
        return stored.lastProject?.local
      }),
    )
    .toBe("C:\\OpenCode\\demo-project")
})

test("the path input still searches directories", async ({ page }) => {
  await openAddProjectDialog(page)

  const dialog = page.locator(".directory-picker-v2")
  await expect(dialog).toBeVisible()

  const input = dialog.locator("input")
  await input.fill("demo")

  const suggestion = dialog.locator("[data-directory-path]", { hasText: "demo-project" })
  await expect(suggestion).toBeVisible()
})
