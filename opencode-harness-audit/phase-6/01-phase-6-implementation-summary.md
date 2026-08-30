# OpenCode Harness V5.2 — Phase 6 Implementation Summary
## Model Registry, Adaptive Routing & Churn Recovery Engine

**Date:** 2026-08-30  
**Status:** IMPLEMENTED & FULLY VERIFIED  
**Target:** Dynamic Model Registry, Role Mapper, Quota Outage Detection & Mid-Task Substitution  

---

## 1. Executive Summary

Phase 6 implements the core **Model Independence Principle** (§27A, §33, §38A of Master Design V5.2).

In V5.2, models are treated as disposable runtime workers rather than architectural constants. When models encounter 429 rate limits, monthly quota exhaustion, service 503s, or provider deprecations, the harness must survive the churn seamlessly without corrupting task state, introducing amnesia, or failing tasks.

Phase 6 introduces:
1. **Dynamic Model Registry:** Decouples task roles (`explorer`, `planner`, `implementer`, `verifier`, `debugger`) from specific model names.
2. **Health Tracking & Cooldown:** Tracks model failure counts, rate limit cooldowns, and automatic recovery.
3. **Model-Loss Continuity Engine:** Checkpoints in-flight state to disk, substitutes an optimal fallback model matching role requirements, adapts prompt formatting, and logs the substitution event.

---

## 2. Implemented Components

### 1. Dynamic Model Registry & Role Mapper ([`harness/src/model-registry.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/model-registry.ts))
- **Role-Based Mapping:** Maps execution lanes to optimal models:
  - `explorer` ➔ Fast high-context model (`opencode-go/glm-5.3-flash`, `opencode-go/kimi-k2.6`)
  - `planner` ➔ High-reasoning model (`opencode-go/qwen3.8-max`, `opencode-go/kimi-k2.6`)
  - `implementer` ➔ Fast code worker (`opencode-go/glm-5.3-flash`, `hetzner/Qwen3.8-27B`)
  - `debugger` ➔ Multi-tier diagnostic resolver
- **Health Lifecycle:** Manages `healthy`, `rate_limited`, `unreachable`, `degraded` states with time-based cooldown refresh.

### 2. Model-Loss Continuity & Churn Recovery Engine ([`harness/src/churn-engine.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/churn-engine.ts))
- **Signature Detection:** Intercepts 429s, `insufficient_quota`, credit limits, 503s, and provider outages.
- **Pre-Substitution Snapshot:** Atomically persists state to disk (`.opencode/snapshots/model_churn_<timestamp>.json`) before switching models.
- **Prompt Adaptation:** Adapts downstream prompts according to the new model's context window and thinking support.
- **Substitution Audit Log:** Tracks complete provenance of mid-task model replacements.

---

## 3. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│             Lane 5: Dynamic Model Registry & Churn Recovery            │
│                                                                        │
│                      ┌─────────────────────────┐                       │
│                      │      Model Registry     │                       │
│                      │(Profiles, Roles, Health)│                       │
│                      └────────────┬────────────┘                       │
│                                   │                                    │
│             ┌─────────────────────┴─────────────────────┐              │
│             ▼                                           ▼              │
│   ┌───────────────────┐                       ┌───────────────────┐    │
│   │ Primary Worker    │                       │ Replacement Model │    │
│   │(GLM 5.3 Flash)    │                       │(Qwen / Hetzner)   │    │
│   └─────────┬─────────┘                       └─────────▲─────────┘    │
│             │                                           │              │
│             ▼ [429 / Outage Detected]                   │              │
│   ┌─────────────────────────────────────────────────────┴─────────┐    │
│   │ Churn Recovery Engine                                         │    │
│   │ 1. Mark health = rate_limited                                 │    │
│   │ 2. Checkpoint task-state.json                                 │    │
│   │ 3. Select next healthy candidate matching role                │    │
│   │ 4. Resume execution seamlessly                                │    │
│   └───────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```
