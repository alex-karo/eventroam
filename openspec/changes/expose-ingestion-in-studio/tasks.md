# Tasks

## 1. Shared registered workflow

- [x] 1.1 Extract one shared attempt object and phase operations from `runCatalogResearch`, retaining its CLI/eval signature and fixture injection; verify existing workflow, durable-run and eval tests pass.
- [x] 1.2 Build the reusable eight-step graph with one server-owned attempt per execution and a small lookup registry, lazy initialization, safe input/output schemas and explicit finalization; test two overlapping executions on the same workflow instance, graph visibility, target validation and default dry-run.
- [x] 1.3 Use attempt-owned failure state and one idempotent cleanup from finalization/fallback hooks; fault-inject context, report, setup and final-persistence failures and verify committed outcomes survive, connections close once and model/writer calls do not replay. Reject duplicate active IDs before step work and verify rejected executions cannot finalize or release the original attempt through fallback hooks.
- [x] 1.4 Connect native cancellation to the research deadline/abort path and pre-write checks; test cancellation during research and after a confirmed write, ensuring cleanup waits for active work and known accounting survives. Verify existing terminal trace codes distinguish cancellation, workflow failure and persistence failure, and owned tracing finishes once on cancellation and finalization errors.
- [x] 1.5 Remove page-count enforcement/configuration and prompt page targets; replace the ordinary-call cap and generation timer with Mastra iteration/native timeout controls. Retain search/depth/size safeguards, deadline outside generation, unavailable retry capacity and accounting. Verify offline-agent iteration/timeout/retry cases, reads beyond the old cap, candidate acceptance and historical version-2 report readability.
- [x] 1.6 Update the project-structure guide for shared graph, runtime ownership and finalization boundaries; verify docs:check.

## 2. Studio integration

- [x] 2.1 Register `catalog-ingestion` in the existing loopback Mastra instance and resolve absolute catalog/observability paths in its launcher; verify startup and graph/trace inspection without credentials or a catalog, and verify execution from Mastra's output directory uses the selected existing database without creating or migrating one.
- [x] 2.2 Disable retries, snapshots and automatic restart; guard resume/restart/time-travel routes and reject perStep starts on every start/stream variant before allocation. Preserve main’s optional selected application logs and apply-only traces, with a silent workflow SDK logger and correlation using both ingestion and engine IDs. Test actual server create/start/stream/cancel paths, rejected replay/per-step operations with no durable row or attempt resources, direct engine/failed-step error messages and any stacks/causes, credential sentinels in transport and private content exclusion in application logs/traces, dry-run trace exclusion and continued shared trace-store availability after runs.
- [x] 2.3 Verify Studio result/error projections through the real server for preview, explicit apply and finalization failure, including ingestion ID, outcome, usage and persistence status. Keep partial/failed research and shared CLI behavior covered by engine tests.
- [x] 2.4 Update ingestion/development guides with launch instructions, form examples, summary/report locations, fresh reruns, native cancellation and revised budget settings/semantics; sync the completed delta into the owning main spec and verify docs:check and openspec:validate.

## 3. Integration acceptance

- [x] 3.1 Use the built-in Browser against local Studio with disposable migrated catalogs and an offline provider to verify the visible graph, generated form, default preview, explicit apply, live progress, cancellation and safe error presentation; record evidence without changing a real catalog or calling a live model.
- [x] 3.2 Run the full test suite, type-check, lint, changed-code format checks, docs:check and openspec:validate; resolve regressions and record results before marking this change complete.

## 4. Explicit research data

- [x] 4.1 Pass serializable research data through step inputs/outputs; retain only runtime resources and a recovery checkpoint outside the workflow. Preserve cancellation, accounting, atomic writes and durable finalization.
- [x] 4.2 Verify intermediate research visibility and secret/resource exclusion in engine and real Studio transport tests; update owning specs and guides, and run checks.

## 5. Step ownership

- [x] 5.1 Move context, source, research, preparation, apply and report operations into workflow step bodies. Keep runtime ownership, one recovery checkpoint and terminal lifecycle in CatalogAttempt; remove per-phase methods and duplicate cloning.
- [x] 5.2 Verify existing engine/transport regressions and update architecture documentation; run full tests and required checks.

## 6. Native workflow state

- [x] 6.1 Move accumulated serializable run data into native Mastra workflow state; remove the attempt-owned checkpoint. Preserve failure/cancellation accounting, confirmed writes and durable finalization through verified state/hook semantics.
- [x] 6.2 Verify state initialization, intermediate visibility, partial-work cancellation, failure and persistence boundaries through engine and real Studio tests; retain rejection of caller-supplied initialState, update specs/guides and run required checks.

## Verification evidence

- Latest main merged at `4a64ca0`; its Pino logging and DuckDB tracing remain intact.
- Full offline suite after step ownership simplification: 435 tests across 39 files passed, including six real-server transport tests. Repository lint, type-check, changed-code formatting, docs:check and strict OpenSpec validation passed.
- Real Mastra transport tests cover inspection, preview/apply streams with visible intermediate research data, credential/resource exclusion, replay guards, cancellation, safe persistence errors and private trace/log projections. Partial/failed research and shared CLI behavior are covered by engine tests. Engine and failed-step error messages, stacks and causes are checked directly.
- Built-in Browser used disposable catalogs and an offline provider: eight-step graph, generated form with default dry-run, separate preview/apply, live research progress, cancellation and safe finalization failure all verified.
- Browser preview/apply retained two completed reports and one committed occurrence; cancellation retained a failed report with no occurrence; final persistence failure retained one committed occurrence and a running row without a final report.
- Engine tests verify native state accumulates research while each phase exposes its own result without mutating earlier outputs. Runtime resources remain server-owned; no private accumulated-data checkpoint exists.
- Phase operations live directly in workflow step bodies. Native workflow state replaced the attempt-owned checkpoint; each step exposes only its own phase result. Installed-engine buffered state semantics require local failure finalization for a throwing interrupted phase or unserializable state/report.
- Native-state engine and real-server transport tests passed (45 + 6), including partial-work cancellation, cyclic report serialization failure and rejection of caller initialState on all start/stream routes. Full offline suite remains 435 tests across 39 files passed.
- Built-in Browser verified the optional-object initial-state form regression, then the broad JSON master/narrow step schema workaround: untouched initial state and valid refresh preview completed all eight steps. The served master schema advertises no named or required state fields; state is initialized and validated by steps.
- An anonymized verified Studio optional-object form bug was reported through the Mastra skill feedback endpoint (HTTP 201).
- Main source-workflow spec synced. Change remains active for a separate archive operation.
