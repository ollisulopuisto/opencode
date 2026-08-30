# OpenCode Harness V5
## Model-Adaptive, Supervisor-Guided, Parallel Coding Harness

Version: 5.1
Status: Architecture Specification

Primary execution model:
Qwen3.8-27B

Supervisor:
Gemini 3.7 via Antigravity (Agy)

Execution substrate:
OpenCode CLI

Host:
macOS / Mac Studio


# 0. Executive Objective

Build a software-engineering harness around OpenCode that substantially improves autonomous coding-task performance.

The objective is NOT to reproduce Claude Code or Codex internally.

The objective is to reproduce the behavioral properties associated with strong coding agents:

- strong repository understanding
- disciplined task decomposition
- efficient exploration
- bounded implementation scope
- persistent task state
- reliable verification
- intelligent failure recovery
- minimal repetitive tool use
- appropriate escalation
- model-specific adaptation
- parallel execution where safe
- measurable end-to-end improvement

The harness must be designed around evidence and benchmarks rather than assumptions.


# 1. Core Resource Allocation Strategy

The system treats the two models differently.

## Qwen = execution capacity

Qwen3.8-27B is the default workhorse.

Qwen should perform:

- repository exploration
- implementation
- routine debugging
- test execution
- local reasoning
- independent subtasks
- mechanical transformations
- routine code review

Qwen may be run concurrently when tasks are demonstrably independent and the environment supports safe concurrency.

## Gemini = scarce supervisory intelligence

Gemini 3.7 via Agy is the supervisory resource.

Gemini should NOT be placed in the critical path of every Qwen tool call.

Gemini is invoked when its additional reasoning is likely to materially improve outcome:

- initial architecture/planning for difficult tasks
- ambiguous requirements
- repeated failure
- recovery failure
- architectural uncertainty
- suspicious scope expansion
- contradictory evidence
- final high-value review
- cross-agent conflict
- major replanning

Core rule:

> Do not spend Gemini reasoning on work Qwen can safely perform itself.

The harness should optimize for:

    maximum useful Qwen work
    +
    minimum necessary Gemini intervention


# 2. Supervisor Architecture

Target architecture:

                         GEMINI / AGY
                       scarce supervisor
                              │
                ┌─────────────┼─────────────┐
                │             │             │
              PLAN        INTERVENE      REVIEW
                │             │             │
                └─────────────┼─────────────┘
                              │
                         ORCHESTRATOR
                              │
                 ┌────────────┼────────────┐
                 │            │            │
              QWEN-1       QWEN-2       QWEN-3
                 │            │            │
              tools        tools        tools
                 │            │            │
                 └────────────┼────────────┘
                              │
                         VERIFICATION


The orchestrator owns:

- task decomposition
- work allocation
- state
- concurrency
- permissions
- budgets
- synchronization
- verification gates
- escalation
- recovery
- observability

Gemini does not directly micromanage every Qwen operation.


# 3. Fundamental Architecture Principle

The LLM should not be responsible for everything.

The harness owns:

- state
- policy
- budgets
- permissions
- phase transitions
- concurrency
- synchronization
- verification gates
- retry policy
- failure classification
- recovery triggers
- observability
- orchestration

The model owns:

- repository reasoning
- hypothesis generation
- implementation decisions
- local code reasoning
- interpretation of evidence
- choosing among permitted actions

Core principle:

> The model decides WHAT should happen.
> The harness decides WHETHER the next action is permitted.


# 4. Canonical Execution Loop

For a normal task:

    UNDERSTAND
        ↓
    EXPLORE
        ↓
    PLAN
        ↓
    DECOMPOSE
        ↓
    EXECUTE
        ↓
    SYNCHRONIZE
        ↓
    VERIFY
        ↓
    COMPLETE

For failure:

    FAILURE
        ↓
    DIAGNOSE
        ↓
    RECOVER
        ↓
    VERIFY

If recovery fails:

    RECOVER
        ↓
    GEMINI INTERVENTION
        ↓
    REPLAN
        ↓
    EXECUTE
        ↓
    VERIFY


# 5. Five-Lane Architecture

The harness contains five logical lanes.

These are roles, not necessarily five simultaneously running agents.

## Lane 1 — Explorer

Purpose:

- understand unfamiliar repositories
- locate implementations
- identify entrypoints
- find tests
- trace dependencies
- identify relevant modules
- identify unknowns

Default model:

Qwen.

Properties:

- primarily read-only
- bounded exploration
- no code modification unless explicitly assigned

Explorer tasks are excellent candidates for parallel execution.

Example:

    Qwen A → locate implementation
    Qwen B → locate tests
    Qwen C → inspect architecture
    Qwen D → inspect dependencies

Results are merged before implementation begins.

---

## Lane 2 — Planner

Purpose:

- translate requirements into an implementation plan
- identify affected files
- identify dependencies
- determine verification strategy
- identify risks
- define rollback strategy
- identify parallelizable work

Default:

Qwen for ordinary tasks.

Gemini for:

- architectural tasks
- high uncertainty
- conflicting plans
- failed prior plans
- expensive/high-risk changes

Planner output:

```markdown
# Objective

# Current Architecture

# Proposed Change

# Work Units

# Dependencies

# Parallelization Opportunities

# Risks

# Verification

# Rollback

# Open Questions
```

## Lane 3 — Implementer

Primary implementation role.

Qwen3.8-27B is the default implementer.

Multiple Qwen workers may execute simultaneously if:

- their write sets do not overlap
- dependencies permit parallel execution
- git/worktree strategy is safe
- shared state cannot be corrupted
- verification can isolate their results

When writes overlap, serialize or isolate using worktrees/branches/sandboxes.

## Lane 4 — Verifier

Purpose:

independently determine whether the implementation actually satisfies the task.

Default:

Qwen for routine verification.

Gemini only when:

- verification is ambiguous
- architecture is complex
- tests are insufficient
- behavior is subtle
- high-risk changes require stronger review

The verifier should be read-only.

Inputs:

- original task
- plan
- diff
- test results
- relevant repository context

Output:

```json
{
  "correct": false,
  "confidence": 0.0,
  "issues": [],
  "missing_tests": [],
  "regressions": []
}
```

# 6. Lane 5 — Recovery / Debugger

Activated when:

- build fails
- tests fail
- runtime behavior fails
- implementation contradicts requirements
- the agent repeats failed actions
- scope expands unexpectedly
- verification fails
- the current hypothesis becomes implausible

First recovery attempt:

Qwen.

Gemini intervention occurs when recovery evidence indicates that Qwen's current approach is failing or architectural reasoning is required.

Recovery protocol:

    STOP
      ↓
    DIAGNOSE
      ↓
    FORM HYPOTHESIS
      ↓
    GATHER EVIDENCE
      ↓
    PATCH OR REPLAN
      ↓
    VERIFY


Never blindly repeat a failed action.

# 7. Gemini Intervention Policy

Gemini should be treated as an escalation resource.

Gemini SHOULD be invoked for:
- architectural ambiguity
- difficult planning
- repeated deterministic failure
- failed recovery
- requirement conflicts
- large unexpected diffs
- scope explosion
- cross-agent disagreement
- high-risk migrations
- final review of critical changes

Gemini SHOULD NOT be invoked for:
- every shell command
- every file read
- every edit
- routine test execution
- simple syntax errors
- obvious local fixes
- trivial refactors

Default:

Qwen handles the task.

Escalate only when evidence justifies escalation.

# 8. Gemini Intervention Budget

The harness should track Gemini usage per task.

Example:

```yaml
gemini_budget:
  default_interventions: 2
  complex_task_interventions: 4
  architectural_task_interventions: 6
```

These are initial heuristics.

The benchmark should determine optimal values.

A Gemini intervention should ideally produce a durable change in trajectory:

- better plan
- corrected hypothesis
- narrower scope
- recovered task
- prevented failure

# 9. Qwen Parallelism

Parallel execution is a first-class capability but NOT a Phase-1 feature.

First establish:

    one Qwen
       ↓
    reliable execution
       ↓
    reliable verification
       ↓
    reliable recovery
       ↓
    safe parallelism


Parallelism should initially be limited to independent read-heavy tasks.

Examples:

- repository exploration
- test discovery
- dependency inspection
- independent analysis

Later:

- independent implementation worktrees
- parallel tests
- independent refactors

# 10. Parallelization Safety

Before parallel execution, determine:

```yaml
parallelizable:
  independent_reading: true
  independent_tests: true
  independent_worktrees: true

unsafe:
  same_file_writes: true
  shared_mutable_state: true
  unordered_schema_migrations: true
  dependent_edits: true
```

The orchestrator must know the write set of each worker.

If uncertain:

serialize.

# 11. Synchronization

Parallel work must converge through explicit synchronization.

Example:

    Qwen A ── implementation A ──┐
                                  │
    Qwen B ── implementation B ──┼──→ integration
                                  │
    Qwen C ── tests / analysis ──┘
                                          ↓
                                      verification


Integration is a state transition.

Do not silently merge parallel results.

# 12. State Machine

Canonical states:

- UNDERSTAND
- EXPLORE
- PLAN
- DECOMPOSE
- EXECUTE
- VERIFY
- RECOVER
- REPLAN
- INTEGRATE
- COMPLETE
- BLOCKED

The harness owns state transitions.

The model may recommend a transition.

The harness decides whether it is allowed.

# 13. Verification Gate

An implementation cannot become COMPLETE merely because the model says it is finished.

Verification should use the cheapest sufficient evidence first.

Example:

    edit
      ↓
    targeted check
      ↓
    targeted test
      ↓
    integration test
      ↓
    broader test
      ↓
    final verification


Verification should be task-sensitive.

Do not automatically run an entire repository test suite after every edit.

# 14. Failure Taxonomy

At minimum:

- BUILD_FAILURE
- TYPE_FAILURE
- TEST_FAILURE
- LINT_FAILURE
- RUNTIME_FAILURE
- IMPORT_FAILURE
- DEPENDENCY_FAILURE
- ENVIRONMENT_FAILURE
- GIT_FAILURE
- TIMEOUT
- PERMISSION_FAILURE
- MERGE_CONFLICT
- LOOP_DETECTED
- SCOPE_EXPANSION
- UNKNOWN

# 15. Retry Policy

Retries must be evidence-driven.

Example:

```yaml
retry:

  transient:
    max_attempts: 3

  deterministic_code_failure:
    max_attempts: 2

  unknown:
    max_attempts: 1

  repeated_strategy_failure:
    escalate_to_gemini: true
```

After repeated deterministic failure:

    STOP
    ↓
    change hypothesis
    ↓
    gather evidence
    ↓
    replan


Do not allow infinite retries.

# 16. Change Budget

Each significant task receives a soft change budget.

Example:

```json
{
  "change_budget": {
    "files": 8,
    "lines_added": 500,
    "lines_deleted": 300
  }
}
```

Exceeding the budget triggers a planning checkpoint.

The agent must explain why scope expanded.

# 17. Loop Detection

Detect:

- repeated commands
- repeated searches
- repeated edits
- repeated identical failures
- oscillating changes
- repeated attempts against the same incorrect hypothesis

When triggered:

RECOVERY

# 18. Repository Intelligence

Create lightweight repository knowledge.

Possible generated state:

    .repo/
        architecture.md
        modules.json
        dependencies.json
        conventions.md
        entrypoints.md
        test-map.json
        risky-files.json


This is a cache, not authoritative truth.

It must be refreshable.

Do not build a giant knowledge graph unless benchmarks prove that one is needed.

# 19. Context Architecture

Separate:

RAW CONTEXT

from:

TASK STATE

Task state must survive compaction.

Example:

```json
{
  "objective": "",
  "constraints": [],
  "decisions": [],
  "work_units": [],
  "files_changed": [],
  "tests_run": [],
  "failures": [],
  "current_hypothesis": "",
  "remaining_work": [],
  "known_unknowns": []
}
```

Parallel workers must receive only the state relevant to their work unit.

Do not dump every worker's entire context into every other worker.

# 20. Tool Output Normalization

Do not always expose raw command output.

Instead produce structured summaries.

Example:

```json
{
  "status": "failed",
  "duration_ms": 4210,
  "summary": "2 failed, 184 passed",
  "failures": [
    {
      "test": "",
      "file": "",
      "error": ""
    }
  ]
}
```

Raw logs remain available on demand.

# 21. Planning

Planning is required for sufficiently complex tasks.

A plan must include:

- objective
- architecture
- affected files
- work units
- dependencies
- parallelization opportunities
- risks
- verification
- rollback
- unknowns

Every implementation step should map to verification.

# 22. Plan Validation

Before execution, validate:

- every requirement has an implementation path
- every implementation path has verification
- dependencies are ordered
- parallel work does not conflict
- files are relevant
- assumptions are explicit
- scope is reasonable
- rollback exists

# 23. Qwen3.8-27B Adaptation

The harness must adapt to Qwen rather than forcing Qwen to imitate another model.

Design goals:

- high structure
- low ambiguity
- explicit state
- explicit verification
- bounded scope
- short feedback loops
- normalized tool output
- limited open-ended delegation

Avoid giant static prompts.

Use:

    CORE POLICY
    +
    ROLE
    +
    TASK STATE
    +
    CURRENT OBJECTIVE
    +
    RELEVANT CONTEXT
    +
    FAILURE STATE


Do not repeatedly inject irrelevant information.

# 24. Qwen Reasoning Policy

Reasoning effort should be experimentally tuned.

Initial hypothesis:

```yaml
trivial:
  reasoning: low_or_medium

routine_implementation:
  reasoning: medium

multi_file_feature:
  reasoning: high

architectural:
  reasoning: high

difficult_debugging:
  reasoning: highest_available
```

Do not permanently hard-code these values until benchmark evidence exists.

Important:

Optimizing reasoning per request is less important than minimizing total failed trajectories.

A faster individual response is not necessarily a faster completed task.

# 25. Qwen Parallel Worker Policy

When parallelism is enabled, each worker receives:

- objective
- work-unit boundary
- relevant files
- constraints
- expected outputs
- verification instructions
- write-set restrictions

Workers should not independently reinterpret the entire project.

The orchestrator owns the global task.

Workers own their assigned work units.

# 26. Model Routing

Initial routing:

```yaml
exploration:
  default: qwen

implementation:
  default: qwen

routine_review:
  default: qwen

routine_recovery:
  default: qwen

architectural_review:
  default: gemini

failed_recovery:
  default: gemini

high_risk_final_review:
  default: gemini
```

Do not introduce additional models until benchmark evidence demonstrates a need.

# 27. Observability

Every task should record:

- task_id
- model
- phase
- worker_id
- tool_calls
- tokens
- files_changed
- tests_run
- tests_failed
- retries
- recoveries
- gemini_interventions
- parallel_workers
- context_compactions
- time_to_first_edit
- time_to_verified_success
- human_interventions

Measure both:

raw model efficiency

and:

end-to-end task efficiency

# 28. Benchmark

Create benchmark categories:

- 10 bug fixes
- 10 features
- 10 refactors
- 10 debugging tasks
- 10 multi-file changes
- 10 unfamiliar-codebase tasks

Benchmark:

    baseline
       ↓
    P0
       ↓
    context
       ↓
    verification
       ↓
    planning
       ↓
    parallelism
       ↓
    Gemini supervision
       ↓
    Qwen tuning


Do not change multiple major variables simultaneously unless the experiment is explicitly measuring the combined system.

# 29. Primary Metrics

Measure:

- task completion rate
- verified completion rate
- first-pass success
- recovery success
- time to completion
- tokens
- tool calls
- files touched
- regressions
- human intervention
- Gemini interventions
- Qwen worker count
- parallel speedup
- failed trajectories

Critical metric:

Verified task completion per unit of model usage.

Not:

Number of agent features.

# 30. Priority Order

Highest priority:

1. Execution reliability
2. Verification
3. Recovery
4. Context/repository understanding
5. Planning
6. Safe parallel Qwen execution
7. Gemini supervision
8. Qwen-specific tuning
9. Performance optimization
10. Nice-to-have intelligence

The ordering is deliberate.

Parallelism comes only after the system can reliably determine whether work is correct.

# 31. Phase Roadmap

## Phase 0 — Audit

Read-only.

Deliver:

- OpenCode state
- Qwen state
- Agy/Gemini state
- actual failure modes
- evidence-based implementation plan

## Phase 1 — P0 Execution Reliability

Senior:

- state machine
- verification gate
- failure recovery
- retry policy
- loop detection
- change budget

Junior:

- parsers
- logging
- metrics
- test runners
- deterministic utilities

No parallel writes yet.

## Phase 2 — Context

Senior:

- task-state architecture
- exploration policy
- semantic context management

Junior:

- repository scanners
- output normalization
- caches
- indexing utilities

## Phase 3 — Verification

Senior:

- verifier architecture
- verification policy
- test selection

Junior:

- test discovery
- diff extraction
- report generation

## Phase 4 — Planning

Senior:

- complexity classifier
- planner protocol
- plan validator
- work-unit decomposition

Junior:

- plan schemas
- persistence
- rendering
- deterministic validators

## Phase 5 — Safe Qwen Parallelism

Prerequisite:

single-Qwen execution is reliable.

Implement:

- work-unit decomposition
- dependency graph
- worker lifecycle
- concurrency limits
- worktree/sandbox isolation
- synchronization
- integration
- parallel failure handling

Start with:

- read-only parallelism
- independent analysis

Then:

- isolated implementation workers

Do not allow uncontrolled shared writes.

## Phase 6 — Gemini Supervisor

Implement:

- intervention policy
- Gemini budget
- escalation triggers
- replanning
- architectural review
- cross-worker conflict resolution

Gemini remains outside the normal Qwen tool loop.

## Phase 7 — Qwen Optimization

Benchmark:

- reasoning effort
- prompt structure
- tool descriptions
- context allocation
- planning thresholds
- exploration budgets
- verification frequency
- parallel worker count

Tune against total task completion, not individual response speed.

## Phase 8 — Performance

Optimize:

- caching
- parallel exploration
- context reuse
- tool startup
- process management
- model routing
- latency

Only after correctness is strong.

## Phase 9 — Nice-to-Haves

Potential:

- PR generation
- commit synthesis
- long-term project memory
- advanced git workflows
- automatic documentation
- predictive planning
- larger-scale parallelism

These are explicitly lower priority.

# 32. Senior vs Junior Ownership

Senior owns:

- architecture
- state machine
- orchestration
- concurrency model
- failure recovery
- context architecture
- verification semantics
- model routing
- Gemini escalation
- security boundaries
- benchmark design

Junior owns:

- CLI wrappers
- parsers
- logging
- metrics
- schemas
- test fixtures
- repository scanners
- configuration
- deterministic utilities

Rule:

If a defect can cause systematically bad agent decisions, senior owns it.
If it is deterministic plumbing, junior can own it.

# 33. Security

The supervisor must not automatically receive unrestricted authority.

Reuse existing OpenCode permission mechanisms whenever practical.

Parallel workers must have explicit workspace boundaries.

Never allow two workers to mutate the same uncontrolled working tree simultaneously.

# 34. Explicit Non-Goals

Do not prematurely build:

- agent swarms for their own sake
- Gemini on every turn
- dozens of specialized agents
- giant prompt frameworks
- multi-agent debates
- speculative AI memory
- giant repository knowledge graphs
- automatic unverified rewrites
- elaborate UI

The objective is reliable software engineering.

# 35. Definition of Success

Success requires benchmark evidence demonstrating improvement in:

- verified task completion
- first-pass success
- recovery success
- context efficiency
- tool efficiency
- reduced human intervention
- useful Qwen parallelism
- efficient Gemini intervention

A larger architecture without measurable improvement is not success.

# 36. Final Principle

The goal is not:

Make Qwen smarter.

The goal is:

Make the system harder to fail.

And:

Use Qwen for breadth and execution.
Use Gemini for high-value judgment.

The harness should maximize useful work per unit of supervisory intelligence.
