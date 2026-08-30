import { describe, it, expect } from "bun:test"
import { WorkerPoolManager, type WorkerContract } from "../src/worker-pool"

describe("WorkerPoolManager", () => {
  it("formats canonical Parallel Worker Contract prompt accurately", () => {
    const contract: WorkerContract = {
      workerId: "worker_auth",
      workUnit: {
        id: "wu_auth",
        title: "Auth Refactor",
        objective: "Implement JWT validation middleware",
        writeSet: ["src/auth/jwt.ts", "src/auth/middleware.ts"],
        relevantFiles: ["src/config.ts"],
        dependencies: [],
        status: "pending",
        verificationCmd: "bun test test/auth.test.ts",
      },
      objective: "Implement JWT validation middleware",
      writeSetWhitelist: ["src/auth/jwt.ts", "src/auth/middleware.ts"],
      relevantReadFiles: ["src/config.ts"],
      constraints: ["Do not mutate database models directly"],
      verificationCmd: "bun test test/auth.test.ts",
      expectedArtifacts: ["src/auth/jwt.ts"],
    }

    const prompt = WorkerPoolManager.formatWorkerContractPrompt(contract)
    expect(prompt).toContain("# PARALLEL WORKER CONTRACT [worker_auth]")
    expect(prompt).toContain("STRICT WRITE-SET WHITELIST")
    expect(prompt).toContain("`src/auth/jwt.ts`")
    expect(prompt).toContain("`src/config.ts` (read-only reference)")
    expect(prompt).toContain("bun test test/auth.test.ts")
  })

  it("enforces max concurrency limits", () => {
    const pool = new WorkerPoolManager(2)
    expect(pool.availableSlots).toBe(2)

    const c1: WorkerContract = {
      workerId: "w1",
      workUnit: { id: "u1", title: "U1", objective: "O1", writeSet: ["a.ts"], relevantFiles: [], dependencies: [], status: "pending" },
      objective: "O1",
      writeSetWhitelist: ["a.ts"],
      relevantReadFiles: [],
      constraints: [],
      expectedArtifacts: [],
    }
    const c2: WorkerContract = {
      workerId: "w2",
      workUnit: { id: "u2", title: "U2", objective: "O2", writeSet: ["b.ts"], relevantFiles: [], dependencies: [], status: "pending" },
      objective: "O2",
      writeSetWhitelist: ["b.ts"],
      relevantReadFiles: [],
      constraints: [],
      expectedArtifacts: [],
    }
    const c3: WorkerContract = {
      workerId: "w3",
      workUnit: { id: "u3", title: "U3", objective: "O3", writeSet: ["c.ts"], relevantFiles: [], dependencies: [], status: "pending" },
      objective: "O3",
      writeSetWhitelist: ["c.ts"],
      relevantReadFiles: [],
      constraints: [],
      expectedArtifacts: [],
    }

    expect(pool.registerWorker(c1)).toBe(true)
    expect(pool.registerWorker(c2)).toBe(true)
    expect(pool.registerWorker(c3)).toBe(false) // Max workers exceeded

    pool.releaseWorker("w1")
    expect(pool.availableSlots).toBe(1)
    expect(pool.registerWorker(c3)).toBe(true)
  })
})
