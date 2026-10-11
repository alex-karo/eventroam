# Proposal

## Why

Following `catalog refresh` is straightforward at the workflow boundary, but understanding its model input, wire compatibility, and safe failure classification requires reading unrelated sections of [research execution](../../../../src/ingestion/research/agent/index.ts). A bounded refactor can give these transformations explicit owners while retaining the existing execution, preparation, writer, and reporting boundaries.

## What Changes

- Keep `researchFestival` as the research execution entry point in `research/agent/index.ts`. Group three cohesive, mostly pure responsibilities beside it: model-facing input construction (`input.ts`), response-schema adaptation and optional-null normalization (`wire.ts`), and safe model-error classification (`errors.ts`), with adjacent tests. Move existing logic without changing prompt text, schema descriptions, serialized input/output, tool descriptions, or error precedence.
- Keep the fixed model instruction text separately in `research/agent/prompt.ts`; input construction imports it directly without runtime file loading or an extra abstraction.
- Put the `ResearchCatalog` type alias beside its context owner, retaining inference from the private catalog read rather than inventing a parallel DTO. Update the necessary type-only imports, including the trace-label consumer in `runtime/tracing/labels.ts`.
- Preserve `prepareResearch` as the operation adapter and keep lifecycle, budgets, retries, usage accumulation, observability ownership, native workflow state, cancellation, catalog transactions, and reports in their current owners. Do not add a generic pipeline, service layer, barrel, provider abstraction, or per-field module hierarchy.
- Establish the baseline before moving code with existing deterministic tests and targeted characterization of serialization and failure boundaries. Retain existing offline CLI/Studio integration coverage. Use the documented current reading path as the baseline for a final clarity review; passing tests alone does not establish clarity.
- Update the existing project-structure documentation once within the extraction stage with the verified owners and reading path. Propose narrowly scoped dependency checks for later adoption; do not install new check configuration or repository rules in this pilot.

## Capabilities

### New Capabilities

None. This is an internal, behavior-preserving refactor.

### Modified Capabilities

None. [catalog/source-workflow](../../../specs/catalog/source-workflow/spec.md), [catalog/records](../../../specs/catalog/records/spec.md), and [catalog/publication](../../../specs/catalog/publication/spec.md) remain authoritative and unchanged. `.openspec.yaml` declares `skip_specs: true`, so the workflow explicitly skips delta specs. Moving code does not justify restating behavioral requirements or introducing an architecture capability.

## Impact

The first implementation is limited to `src/ingestion/research`, its adjacent tests, the `ResearchCatalog` type import in `src/ingestion/runtime/tracing/labels.ts`, targeted offline provider characterization, and existing architecture documentation. The shared CLI/Studio workflow, native step outputs, terminal summaries, workflow and CLI signatures, `ResearchExecution`, report version 2, operation contracts, prompt version, dependency versions, database schema, and public UI remain compatible.

The full CLI/Studio → shared Mastra workflow and attempt lifecycle → context/source session → research → preparation → writer → report path was rechecked against `main` at `3b3fa9f` (2026-10-11) to justify this narrower scope. The [design](design.md) records findings, preserved boundaries, price flow, permitted dependencies, tradeoffs, and acceptance evidence; [tasks](tasks.md) defines independently checkable stages. Publication preflight overlap is recorded as a maintenance concern, but unifying publication rules would cross the pilot boundary and is deferred.

This proposal authorizes no implementation. Application code, tests, prompts, and check configuration are unchanged during planning. No live research, paid model calls, or catalog database mutations are needed to prepare or validate these artifacts.
