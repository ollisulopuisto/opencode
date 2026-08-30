/**
 * OpenCode Harness V5.2 - Git Worktree & Workspace Isolation Engine
 * 
 * Creates and cleans up isolated worktrees/sandboxes per execution worker,
 * guaranteeing zero index lock collisions or concurrent write contamination.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

export interface WorkerWorkspace {
  workerId: string
  worktreePath: string
  branchName: string
  isGitWorktree: boolean
  createdAt: number
}

export class WorktreeManager {
  private baseDir: string
  private isGitRepo: boolean

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = path.resolve(baseDir)
    this.isGitRepo = fs.existsSync(path.join(this.baseDir, ".git"))
  }

  /**
   * Creates an isolated workspace for a worker.
   */
  async createWorkspace(workerId: string, baseRef: string = "HEAD"): Promise<WorkerWorkspace> {
    const sanitizedId = workerId.replace(/[^a-zA-Z0-9_-]/g, "_")
    const branchName = `worker-${sanitizedId}-${Date.now()}`
    const worktreePath = path.join(os.tmpdir(), `harness-wt-${sanitizedId}-${Date.now()}`)

    if (this.isGitRepo) {
      try {
        const proc = Bun.spawn(["git", "worktree", "add", "-b", branchName, worktreePath, baseRef], {
          cwd: this.baseDir,
          stdout: "pipe",
          stderr: "pipe",
        })
        const exitCode = await proc.exited
        if (exitCode === 0) {
          return {
            workerId,
            worktreePath,
            branchName,
            isGitWorktree: true,
            createdAt: Date.now(),
          }
        }
      } catch {
        // Fallback to directory copy if git worktree fails
      }
    }

    // Non-git / fallback directory clone
    this.copyDirectoryRecursive(this.baseDir, worktreePath)
    return {
      workerId,
      worktreePath,
      branchName,
      isGitWorktree: false,
      createdAt: Date.now(),
    }
  }

  /**
   * Cleans up and removes a worker's isolated workspace.
   */
  async removeWorkspace(workspace: WorkerWorkspace): Promise<void> {
    if (workspace.isGitWorktree && this.isGitRepo) {
      try {
        const proc = Bun.spawn(["git", "worktree", "remove", "--force", workspace.worktreePath], {
          cwd: this.baseDir,
          stdout: "pipe",
          stderr: "pipe",
        })
        await proc.exited

        const branchProc = Bun.spawn(["git", "branch", "-D", workspace.branchName], {
          cwd: this.baseDir,
          stdout: "pipe",
          stderr: "pipe",
        })
        await branchProc.exited
      } catch {
        // ignore
      }
    }

    if (fs.existsSync(workspace.worktreePath)) {
      try {
        fs.rmSync(workspace.worktreePath, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  }

  /**
   * Extracts git diff patch from a worker's workspace.
   */
  async extractPatch(workspace: WorkerWorkspace): Promise<string> {
    if (workspace.isGitWorktree) {
      const proc = Bun.spawn(["git", "diff", "HEAD"], {
        cwd: workspace.worktreePath,
        stdout: "pipe",
        stderr: "pipe",
      })
      const output = await new Response(proc.stdout).text()
      return output
    }
    return ""
  }

  private copyDirectoryRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }
    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".opencode") {
        continue
      }
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath)
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}
