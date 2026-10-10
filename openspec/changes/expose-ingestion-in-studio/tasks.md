# Tasks

## 1. Shared registered workflow

- [ ] 1.1 Extract one shared attempt object and phase operations from `runCatalogResearch`, retaining its CLI/eval signature and fixture injection; verify existing workflow, durable-run and eval tests pass.
- [ ] 1.2 Build the reusable eight-step graph with one server-owned attempt per execution and a small lookup registry, lazy initialization, safe input/output schemas and explicit finalization; test two overlapping executions on the same workflow instance, graph visibility, target validation and default dry-run.
- [ ] 1.3 Use attempt-owned failure state and one idempotent cleanup from finalization/fallback hooks; fault-inject context, report, setup and final-persistence failures and verify committed outcomes survive, connections close once and model/writer calls do not replay. Reject duplicate active IDs before step work and verify rejected executions cannot finalize or release the original attempt through fallback hooks.
- [ ] 1.4 Connect native cancellation to the research deadline/abort path and pre-write checks; test cancellation during research and after a confirmed write, ensuring cleanup waits for active work and known accounting survives. Verify existing terminal trace codes distinguish cancellation, workflow failure and persistence failure, and owned tracing finishes once on cancellation and finalization errors.
- [ ] 1.5 Update the project-structure guide for shared graph, runtime ownership and finalization boundaries; verify docs:check.

## 2. Studio integration

- [ ] 2.1 Register `catalog-ingestion` in the existing loopback Mastra instance and resolve absolute catalog/trace paths in its launcher; verify startup and graph/trace inspection without credentials or a catalog, and verify execution from Mastra's output directory uses the selected existing database without creating or migrating one.
- [ ] 2.2 Disable retries, snapshots and automatic restart; guard resume/restart/time-travel routes and reject perStep starts on every start/stream variant before allocation. Preserve silent SDK logging and sanitized apply-only traces correlated with both ingestion and engine IDs. Test actual server create/start/stream/cancel paths, rejected replay/per-step operations with no durable row or attempt resources, direct engine/failed-step error messages and any stacks/causes, private sentinels in transport/storage/traces, dry-run trace exclusion and continued shared trace-store availability after runs.
- [ ] 2.3 Verify Studio result/error projections through the real server: preview, explicit apply, partial/failed research and finalization failure must expose the correct ingestion ID, outcome, usage and persistence status. Compare catalog changes and durable reports against equivalent CLI fixture runs.
- [ ] 2.4 Update ingestion/development guides with launch instructions, form examples, summary/report locations, fresh reruns and native cancellation limits; sync the completed delta into the owning main spec and verify docs:check and openspec:validate.

## 3. Integration acceptance

- [ ] 3.1 Use the built-in Browser against local Studio with disposable migrated catalogs and an offline provider to verify the visible graph, generated form, default preview, explicit apply, live progress, cancellation and safe error presentation; record evidence without changing a real catalog or calling a live model.
- [ ] 3.2 Run the full test suite, type-check, lint, changed-code format checks, docs:check and openspec:validate; resolve regressions and record results before marking this change complete.
