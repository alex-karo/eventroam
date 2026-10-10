# Proposal

## Why

Ingestion currently sequences all work inside one host function. Explicit Mastra workflow steps will make phase ownership and execution order easier to understand and inspect.

## What Changes

- Replace inline orchestration with a committed Mastra workflow containing context, initial source, research, validation, atomic write, and report steps.
- Retain host ownership of invocation validation, durable run creation/finalization, partial failure recovery, and trace cleanup.
- Keep per-invocation resources private and disable workflow retries and snapshots, preserving current reporting, budgets, atomic writes, and source/model retry policy.
- Add focused execution and isolation regressions and update the ingestion guide.

## Capabilities

### New Capabilities

None. This is an internal orchestration refactor.

### Modified Capabilities

None. Existing `catalog/source-workflow` requirements remain the acceptance contract; this change explicitly skips delta specs.

## Impact

`src/ingestion/workflow.ts`, supporting workflow implementation, tests, and ingestion documentation. Uses the existing pinned Mastra dependency. CLI/eval interfaces, database schema, model prompts, source retrieval, and inspection-only Studio behavior remain compatible. Scheduling, resumable execution, Studio execution controls, and deployment are outside scope.
