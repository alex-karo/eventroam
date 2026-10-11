# Design

## Context

`runCatalogResearch` currently owns both durable lifecycle and the complete research sequence. Existing helpers already own context, source sessions, research, candidate preparation, atomic writes, reports, and safe tracing. See proposal.md for motivation. Existing source-workflow requirements remain unchanged.

## Goals / Non-Goals

**Goals:** Make the real execution graph explicit with meaningful named steps; preserve failure recovery, per-run isolation and the public entry point.

**Non-Goals:** Persisting workflow snapshots, resuming or replaying writes, changing research reasoning, registering an executable Studio workflow, or adding scheduled execution.

## Decisions

1. Build one committed Mastra workflow per invocation with sequential `load-context`, `read-initial-source`, `research-festival`, `prepare-candidate`, `apply-catalog-item`, and `build-report` steps. Each step executes its phase rather than wrapping the old orchestration function. Existing domain helpers remain the owners of their rules.
2. Keep invocation validation and durable start before graph execution, and guarded finalization after it. The host catches thrown engine failures and failed execution results, preserving available accounting and committed writes. Finalization errors must remain outside that catch to prevent replay or replacement of their typed errors.
3. Keep live database, source session, credentials, budget, trace, and partial results in a per-invocation closure. Schematized graph data carries safe run/phase projections only. Passing all resources or the complete report through workflow state would expose content and introduce serialization problems.
4. Disable workflow retries and snapshots explicitly. Retain existing provider retries inside research. Configure a silent logger and preserve the existing sanitized trace root and cleanup. The installed `run.start` API does not accept the existing live parent span, so the workflow engine stays unregistered and existing root/agent/source tracing remains authoritative. Trace availability never governs execution.
5. Preserve CLI, eval and fixture dependency injection. The inspection-only Studio remains free of catalog dependencies and credentials. Tests exercise the real workflow engine without provider calls.

## Risks / Trade-offs

- Mastra returns failed results as well as throwing → handle both in the host and test failures before and after commits.
- Default SDK logging/snapshots might expose private data → suppress logging, disable snapshots, limit graph data, test sentinels.
- Hidden shared state could cross invocations → construct resources and graph per invocation, test overlapping runs.
- Closure-backed steps cannot resume independently → intentional for this owner-initiated flow; reruns start new durable attempts.

## Migration Plan

No database or dependency migration. Run type, lint, existing ingestion/tracing/eval regressions, focused workflow tests, documentation and OpenSpec checks. Rollback is restoring the previous orchestration code; run records retain their existing format.
