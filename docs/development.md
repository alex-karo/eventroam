---
type: Guide
title: Development guide
description: Local setup, checks, change workflow, and catalog research commands.
status: stable
tags: [development]
---

# Development guide

Eventroam is under active development with no production deployment. Backward compatibility is not required yet. This guide covers local work and application containers; the [project structure](project-structure.md) explains code ownership, [OpenSpec](../openspec/specs/) defines implemented behavior, and [ADRs](index.md#decisions) record technology choices.

## Local setup

Use the Node.js and npm versions pinned in `.node-version` and `package.json`. From the repository root:

```sh
npm ci
npm run db:fixtures
npm run dev
```

Open `http://localhost:3000` for the project presentation or `http://festivals.localhost:3000` for discovery. Fixtures create a migrated database at `./data/eventroam.sqlite` and add repeatable fictional records.

Copy `.env.example` to `.env.local` for Next.js settings. A Mapbox token is optional locally; the list and filters work without one. Migration and fixture commands read the shell environment, not `.env.local`. For a custom database, run `DATABASE_PATH=./data/custom.sqlite npm run db:fixtures` and set the same path in `.env.local`. Catalog research, eval, and Studio commands load `.env`. Keep credentials in ignored local env files.

Codex worktrees use `.codex/environments/environment.toml` to link the source checkout’s `.env` and run `npm ci` in the new worktree. The setup requires the pinned Node.js and npm versions to be available on `PATH`.

## Coordinate comparison

## Checks and tests

Run the checks relevant to your change:

```sh
npm run type-check
npm run lint
npm run format:check
npm test
npm run build
npm run docs:check
npm run openspec:validate
```

CI validates main OpenSpec specs with `npm exec -- openspec validate --specs --strict`, allowing active changes to start with a proposal only. `npm run openspec:validate` also validates active changes and requires their delta specs to be ready.

`npm start` serves the built application. `npm run test:e2e` runs desktop and mobile discovery and detail journeys against a temporary fixture database on port 3137. The default mode disables Mapbox and checks list and map fallbacks. Pass Playwright options after `--`, for example `npm run test:e2e -- --project=mobile`.

For a small real-map check, set `E2E_REAL_MAP=1` and supply `NEXT_PUBLIC_MAPBOX_TOKEN`. The runner and Playwright server forward that token only in this mode. This command loads the local token from `.env` without printing it:

```sh
E2E_REAL_MAP=1 node --env-file-if-exists=.env scripts/run-e2e.mjs e2e/real-map.spec.ts --workers=1
```

The real-map tests check clustered selection, card overlap, unchanged zoom, camera return, pointer hover, and unlocated selection. They use real Mapbox rendering and a small discovery response override for the cluster case. They need provider access and browser rendering support. Keep the token local. The default suite skips these tests.

Use the built-in Browser for local UI checks. On macOS, obtain approved execution outside the command sandbox before a shell runner starts full Chrome, including headless Chrome. Do not retry a sandboxed launch after an `_RegisterApplication` or `SIGABRT` startup crash. Stop other local Next.js servers before an E2E run because they share the build directory.

Run `npm run test:coverage` for unit and integration coverage of application and command TypeScript, including unimported files. E2E, test helpers, declaration files, and child-process coverage from Studio and tracing fixtures are excluded. Reports go to ignored `coverage/`; CI publishes totals and retains the HTML `test-coverage` artifact for 14 days. Coverage thresholds are not enforced. React tests use a per-file `// @vitest-environment jsdom` directive and React Testing Library; other tests use Node.

Mastra transport tests use the production server setup and SDK shutdown against temporary catalogs; they do not build or launch the Studio CLI. Observability tests read closed DuckDB stores in the test process, with a dedicated subprocess test for persistence after writer exit. Retry and tracing-abort tests advance controlled timers after the SDK reaches the relevant wait, preserving the configured production delays.

Use the built-in Browser for local UI verification. On macOS, obtain approved execution outside the command sandbox before launching full Chrome through a shell or test runner, including headless mode.

Tests live beside their implementation. Use `testDatabase()` for a fresh migrated temporary database and `testFixtures()` from `src/test/fixtures.ts` for typed builders and inserts. The database includes the migrated starter vocabulary. Use `fx.existingTerm(facet, slug)` to read a stored term; `fx.festivalTerms()` and public-scenario helpers reuse those terms. Use `fx.term(...)` to insert custom terms for the scenario, without clearing the dictionary. Cleanup is automatic. `fx.build.*` creates objects without storing them; `fx.publishedEvent(...)` creates a complete public scenario. Omitted fields receive defaults, explicit `null` is preserved, and `undefined` overrides are ignored. Set values that affect the scenario or assertions. Tests do not load development fixtures or fetch live source pages; direct SQL is appropriate for testing database constraints or deliberately invalid data.

Run `npm run deps:check` to check runtime dependencies in `src/` and `commands/` for circular dependencies, unresolved imports, and production imports of test code. Type-only imports and other dependencies erased by TypeScript compilation are excluded. CI runs the same check.

## Change workflow

Read the relevant spec, nearby tests, and configuration before editing. Inspect the working tree and preserve unrelated changes. Follow the [module boundaries](project-structure.md#boundaries), validate external input at runtime, and review generated migrations. Keep code, tests, specs, and documentation aligned when changing a contract.

For behavior changes, use the standard OpenSpec workflow: explore or propose, define testable delta specs, add design and tasks, implement, verify, synchronize main specs, and archive. In Codex, use the corresponding `$openspec-*` skills; use `npm exec -- openspec` for the project-local CLI. Group capabilities under `catalog/`, `website/`, or `operations/`, with matching main and delta paths. Keep unresolved choices in [draft proposals](proposals/) and lasting technology decisions in ADRs.

Before handoff, run focused tests and applicable checks, then report the result and remaining uncertainty. Run `docs:check` for documentation edits and `openspec:validate` for OpenSpec edits.

New changes use the project-local [review-driven schema](../openspec/schemas/review-driven/schema.yaml), forked from OpenSpec 1.14.0's `spec-driven` schema. It keeps the proposal/specs/design/tasks workflow and requires a design for every change. Start with Small, Medium, or Large and a short reason based on coupling, risk, and verification effort. Scale design and tasks to that assessment; small changes can use a few paragraphs and focused steps.

For each Modified Capability in a proposal, show Before and After behavior. Base Before on the main spec and note any known difference from the implementation. Keep detailed conditions in delta specs. In design, state each decision directly and each fact once. Usually use 2-3 sentences per key decision: choice, reason, and material trade-off. Add detail for a specific complexity or risk. Before handoff, remove text that does not help the reader assess or implement the design. Keep necessary reasons and constraints; use direct wording instead of dense shorthand.

Write plans in plain English, whether they live in chat, a design document, or OpenSpec. Explain the observable change and main flow before implementation details. Identify what existing code or dependencies already do and what the application must add. Distinguish requested outcomes, accepted contracts, and newly proposed guarantees; writing a guarantee into a spec does not establish its acceptance. For significant additional mechanisms, explain the concrete consumer/scenario and why existing capabilities are insufficient.

Compare the smallest credible solution with the proposed design. Consider removing mechanisms as well as reorganizing them. When a simpler option reduces scope, name the lost behavior, affected consumers, and implementation/test burden avoided; changing an accepted guarantee still needs agreement. Check that a reader can explain the idea, flow, ownership and key trade-offs from the plan alone. Rewrite missing explanations in their owning sections rather than adding a separate summary document.

Keep each design coherent by folding corrections into the relevant sections. Tasks describe reviewable outcomes and their checks without repeating design details. Proposed tests should detect meaningful failures not already adequately covered; avoid reproducing a dependency's algorithm tests without an application integration risk. Existing changes retain the schema recorded in their `.openspec.yaml`.

After editing the custom schema or templates, run `npm exec -- openspec schema validate review-driven` as well as the documentation and OpenSpec checks. The local fork does not automatically inherit future upstream schema changes.

Use the repository's [plan-review skill](../.agents/skills/plan-review/SKILL.md) with `$plan-review <plan or change-name>` before implementation or after material planning changes. It accepts plans in chat, Markdown, issues, or OpenSpec. For substantive plans, the main reviewer checks readiness and asks one independent subagent what can be simplified, requesting concrete removals, combinations or replacements and their trade-offs. The main reviewer verifies these suggestions against the sources and reports readiness separately from supported simplifications. Small direct plans use a self-check. The skill reports findings without editing the plan. Use `openspec-verify-change` to check completed implementation against OpenSpec instead.

For OpenSpec plans, the review reports three separate checks: specs follow the selected schema's instructions, proposal keeps implementation details in design, and design contains only useful content. Each check states whether it passed, found issues, or was not reviewed, with a reason.

The review-driven schema calls for this review after drafting substantive plans, before presenting them as ready. The update workflow also invokes it after material changes to requirements or approach in plans awaiting implementation. The author incorporates supported improvements within the authorized planning scope and surfaces material scope decisions. Recheck affected decisions once after revisions; report unresolved issues instead of starting repeated review loops. Small direct plans can use a disclosed self-check. This is workflow guidance, not a new CLI-enforced approval gate or an extra artifact.

Use the project-local [code-review skill](../.agents/skills/code-review/SKILL.md) with `$code-review` to review changes and fix clear bugs and simple improvements. It runs [complex-code-review](../.agents/skills/complex-code-review/SKILL.md) in a fresh Astra subagent. Every finding gets a recorded outcome. High-effort changes, uncertain improvements, and changes to requirements go to the user for a decision. After fixes, it runs one more review if the first pass had at least four unique findings, or if the fixes have substantial regression risk. Use `$complex-code-review` directly for review only.

## Local database

`npm run db:migrate` applies reviewed migrations to `DATABASE_PATH`, including the 71-term [starter taxonomy](proposals/festival-taxonomy-vocabulary.md) (56 genres). Existing terms and Edition assignments are preserved; new terms do not classify or publish records. `npm run db:fixtures` also loads fictional development data. Fixtures are separate from schema migrations and omit audit history. Normal catalog mutations must use the validated writer; seed loaders must use shared catalog validators.

The current migration history starts from one baseline, the starter-taxonomy data migration and a private run-accounting migration. The data migration also supports catalogs already using that baseline. A database initialized by the earlier nine-migration history must be recreated; `db:migrate` does not upgrade it. Stop processes using a disposable database before replacing it, then run `npm run db:fixtures` for fictional data or `npm run db:migrate` for a catalog with the starter vocabulary and no Events or Editions. Preserve valuable local research data with a consistent SQLite backup before replacing its database, and keep that backup separate for manual recovery. SQLite's backup API includes committed WAL data; copying only the live main file is insufficient. Verify backups with `PRAGMA integrity_check`. Historical reports remain opaque storage and are unsupported by current report/eval consumers. See the [SQLite decision](decisions/001-sqlite-and-drizzle.md) for storage details.

## Local catalog research

Set `OPENROUTER_API_KEY` in `.env`. The selected database must exist and be migrated; migrations supply the starter taxonomy needed for classification. `npm run catalog -- --help` lists options.

```sh
npm run catalog -- add --name "Festival name" --database data/research.sqlite
npm run catalog -- refresh --event EVENT_ID --database data/research.sqlite --report data/refresh.json
npm run catalog -- refresh --event EVENT_ID --database data/research.sqlite --apply
```

`add` creates new Events; use `refresh` for existing ones. Refresh supports repeated `--event` and `--scope full|current`; each Event has an independent atomic attempt. Preview is the default and still needs a writable database: catalog changes roll back, while the private run report persists. `--apply` starts fresh research rather than applying a saved preview. Use `--republish` to permit withdrawn records to publish again.

The defaults are `openai/gpt-6-luna`, medium reasoning, and Flex routing. Set `OPENROUTER_MODEL`, `OPENROUTER_REASONING_EFFORT`, or `OPENROUTER_SERVICE_TIER=standard` to override them. Flex can have higher latency and capacity errors. Optional `FIRECRAWL_KEY` enables a fallback for HTTP 403 responses. Research permits 15 ordinary model steps by default, reserving the last for a final response; override this with `--agent-steps` or `CATALOG_MAX_AGENT_STEPS`. There is no application limit on total input context characters. Defaults and remaining `CATALOG_MAX_*` safeguards are in `.env.example`; CLI overrides also include `--searches` and `--seconds`. Limits bound work, not exact spending.

The [ingestion guide](ingestion-process.md) explains source handling, fact selection, previews, publication, and reports. Research is model-led and can make factual mistakes. Inspect the report before deciding on an apply run. After interruption, start a fresh run against current state; already committed changes remain.

To inspect exactly what the research agent received from its initial source, `readPage`, and `searchWeb`, set `CATALOG_CAPTURE_TOOL_OUTPUTS=true` for a local CLI or loopback Studio process. Capture works for previews and apply runs and is off by default. For example:

```sh
CATALOG_CAPTURE_TOOL_OUTPUTS=true npm run catalog -- add --name "Festival name" --database data/research.sqlite
```

Find the durable `runId` in the report, then inspect `data/catalog-debug/<runId>/`. Numbered JSON files contain each agent-visible response and its origin; page responses also have Markdown files. Numbers follow tool invocation order, even when concurrent calls finish out of order. The directory is ignored by Git and contains sensitive source text and search results. Keep it local and remove it when no longer needed. If capture cannot write, the process prints one bounded diagnostic to stderr; the catalog outcome is unaffected. Injected eval candidates do not use this capture.

### Catalog evals

`npm run catalog:eval -- --help` lists options. Evals use captured sources, fresh temporary catalogs, and preview writes. Each case can provide a top-level `geocoding` array of recorded requests and normalized client results for any evaluation mode. Only model calls use the network and incur provider charges; `npm test` checks the machinery without an API key.

```sh
npm run catalog:eval
npm run catalog:eval -- --case sziget --repeat 3 --model openai/gpt-6-luna
```

Use `npm run catalog:eval -- --editor-only` to replay the seven captured research handoffs and run live Editor and Location generation. `--case ID` selects a replay case; cases without handoffs fail before generation. Default pipeline runs exclude handoffs; explicit `--case` selections incompatible with either mode fail before provider setup. Reports label `evaluationMode` and handoff provenance/hash. Source pages remain local fixtures. Native metrics describe the stages that actually run; injected research does not add model usage. Keep full-pipeline evals for research changes and integration checks.

Use `npm run catalog:eval -- --location-only` to evaluate Location directly with captured inputs and geocoding responses. It skips Research, Editor, workflow, database setup and writes. It supports `--case` and `--repeat`; `--model` overrides the Location model for this mode. It cannot be combined with `--editor-only`. Initial and follow-up requests use normalized geocoding-client results with the normal cache, bounds and point registration. Provider response parsing is tested in the Geoapify adapter. An unmatched request returns `fixture_miss` and fails the case even after valid output. Recorded empty responses and provider failures remain distinct. Completion, correction and preservation results are shown separately. Positive cases require point or precision changes; keep-only output cannot pass them. Location fixtures need no catalog seed or captured page sources. Pipeline fixtures require both; Location cases reused by workflow integration tests retain an explicit catalog seed. Injected decisions in unit tests check integration, not agent accuracy.

Evaluation artifacts retain the native Mastra item envelope: `output`, `error` and `scores`. Pipeline and editor replay items have one ingestion report under `output.report`, with `toolCalls` and existing assertion details under `output.score`. Location-only items have `output.location`, actual geocoding calls and run/trace correlation without an ingestion report. A returned failed ingestion report is valid output and is scored against its case. Exceptions without a report have null output and bounded safe errors; an available persistence-failure report is preserved. Task errors, scorer errors, missing required scores and failed assertions cause exit code 1 after all completed experiment results are saved. Valid sibling results remain available. Report version 7 has no flat report copies or application token/cost totals.

Set `CATALOG_LOCATION_MODEL` to choose a separate Location model; the default is `OPENROUTER_MODEL`. The same credentials and reasoning settings apply. `GEOAPIFY_KEY` is optional: missing credentials return unavailable context rather than blocking startup. Location has eight model steps and six shared geocoding calls per Event, including preparation and agent cache hits. Geoapify is server-side only. Observability remains optional and costs are native estimates or provider observations, not a complete bill. Evaluation report paths are protected from observability database collisions.

Reports default to `data/catalog-evals/`; `--report PATH` selects an output file. Failed assertions or host workflow/persistence failures produce exit code 1. Evals measure required changes and forbidden claims. Seven synthetic scope cases additionally score temporal selection and research completeness, including unchanged saved history and expected key or null for each slot, independently of mutations. The fixture suite has 51 cases: 31 pipeline cases, seven editor-only replays and thirteen Location cases. These comprise six captured-source cases, seven scope cases, seven editor replays, two independent participant-size cases, three source regressions, six narrow-current cases and one current identity-contradiction case, plus six search-policy cases. Current cases also reject raw Event findings, cover optional-field completion, explicit taxonomy continuity versus changed or noncomparable programmes, no announcement, partial saved tickets and stopping on identity contradictions while full retains recovery; fixture schema 2 is independent of report v7. They are not an apply gate. Compare models or prompts on the same fixtures and repeat runs to expose variability.

Each score retains structured `required` and `forbidden` assertion results with their `matched` flags. Correctness and completeness measure only mutation assertions. Research scoring checks the terminal research/catalog outcomes for every case and any annotated facts or expected safe failure. Expected failures retain their safety and evidence checks; unmet conditions, such as missing source diagnosis or unexpected catalog changes, reduce the research score. Host workflow/persistence failures independently reject the case without changing its dimension scores.

`score.diagnostics` groups failed-check explanations by `execution`, `correctness`, `completeness`, `research`, and `toolUse`. The CLI prints these explanations beneath failing cases; each Mastra scorer uses its dimension's diagnostics. Host failures appear once under `execution`. Perfect dimension scores can still be rejected by a host failure. Each repetition has its own score and diagnostics.

Mastra `runExperiment` executes one task per case repetition with concurrency 3. Reports contain `experiment` execution metadata and native `scores` for each case. These replace the former `mastra` aggregate block. Experiment `succeededCount` counts completed tasks, including cases whose assertions fail; `score.passed` determines acceptance and CLI exit status. A completed experiment retains task and scorer failures in its artifact before the command exits nonzero. Experiments use inline fixtures with experiment and score persistence disabled; pipeline and editor replay still record ingestion runs in temporary catalogs.

Cases and expectations live in `src/ingestion/evals/cases/`. When refreshing captured pages, review their expected results too. Check that facts belong to the intended festival and edition, especially venue versus office addresses and ticket links versus signup forms.

### Local Studio ingestion

Run `npm run catalog:studio`, open `http://127.0.0.1:4111` in the built-in Browser, and choose Workflows → `catalog-ingestion`. Inspection needs no model credentials or catalog; execution needs the migrated `DATABASE_PATH` and OpenRouter settings from `.env`.

```json
{ "mode": "add", "name": "Festival name" }
```

```json
{
  "mode": "refresh",
  "eventId": "EVENT_ID",
  "scope": "full",
  "dryRun": false,
  "republish": false
}
```

Studio accepts one Event per refresh, with optional `scope: "full"|"current"` (default full). Add rejects scope and check is unsupported. Preview is the default. Inspect intermediate results and the final report in the workflow view. Use native cancellation while a run is active; after interruption, start a fresh run. Per-step execution, resume, restart, and time travel are unsupported. See the [workflow steps](ingestion-process.md#workflow-steps) for the shared CLI/Studio lifecycle.

### Workflow history

CLI and Studio save native workflow snapshots by default, including intermediate progress, with logs and traces off. `CATALOG_WORKFLOW_DATABASE_PATH` defaults to `data/mastra-workflows.sqlite`. Relative paths use the project root, including when the Studio launcher changes directory. Keep the file and its SQLite sidecars separate from catalog, report, historical trace, and observability files. Preflight checks include the CLI `--database` path, symlinks, and hard links.

After CLI exit, start `npm run catalog:studio`, open Workflows → catalog-ingestion → Recent runs, then select a run. Use the same workflow path in both commands. Graph and saved inspection need no catalog connection or model key. `initialize-run` connects the engine execution ID to the durable ingestion run ID. Reports from before this feature are not imported. Tests use temporary stores; evals use per-case in-memory history.

History is required. A failed open or write prevents or stops work and gives CLI exit code 1 with `workflow_history_failed`. Paid work may already have occurred. Confirmed catalog commits and completed reports remain; use them to check actual writes. Optional observability keeps its best-effort policy. Close Studio before a CLI run with logging or tracing enabled: DuckDB permits one owning process. Workflow history alone does not require DuckDB.

Snapshots remain until manual cleanup; there is no automatic retention. To delete one completed entry, keep Studio running and call:

```sh
curl -X DELETE http://127.0.0.1:4111/api/workflows/catalog-ingestion/runs/EXECUTION_ID
```

To reset a disposable workflow store, stop all its writers and Studio, then remove only its configured SQLite file and `-wal`, `-shm`, and `-journal` sidecars. Leave catalog, reports, and DuckDB files intact. Deletion also removes evidence used to reject old IDs; always use a new execution ID for a new attempt. History does not enable resume, replay, comparison dashboards, or cross-host sync.

### Local trace inspection

Logging and tracing are independently opt-in and default off. Tracing supports apply, preview and evaluation, including injected dependencies. Mock calls do not invent tokens or costs. `CATALOG_LOG_LEVEL` accepts `debug`, `info` (default), `warn`, or `error`.

Close Studio before recording from a separate CLI process: DuckDB requires exclusive process ownership of its file.

```sh
CATALOG_LOGGING=true CATALOG_TRACING=true npm run catalog -- refresh --event EVENT_ID --apply --report data/research-report.json
npm run catalog:studio
```

In Studio, open Observability → Logs, Traces or Metrics. Both commands use `CATALOG_OBSERVABILITY_DATABASE_PATH`, defaulting to `data/mastra-observability.duckdb`. Use the durable runId to correlate records. The [ingestion guide](ingestion-process.md#execution-metrics) describes metric eligibility, recorded fields, cost semantics and privacy boundaries.

With Studio running, query persisted records without model credentials or research execution. Sum cost over total input/output metrics only; adding cache/reasoning detail costs can double count consumption:

```sh
curl -sS http://127.0.0.1:4111/api/observability/metrics/aggregate \
  -H 'Content-Type: application/json' \
  -d '{"name":["mastra_model_total_input_tokens","mastra_model_total_output_tokens"],"aggregation":"sum"}'
```

`value` is the combined input/output token count; `estimatedCost`/`costUnit` carry the known model cost or estimate, not a complete bill. Add `filters.runId` to select a durable run. `POST /api/observability/metrics/breakdown` accepts the same names/aggregation and `groupBy:["entityId","model"]`. Raw `GET /api/observability/metrics` records expose runId, traceId, spanId and native cost metadata. Studio’s agent links from Metrics may preselect agent-root trace filters; this ingestion uses a generic catalog root, so clear those primitive filters to see its trace or correlate the IDs through the API.

Observability is best effort; incomplete or missing traces/metrics do not replace the durable report. Revisit flush/shutdown handling if missing traces or closed-store failures recur. Local stores have no automatic retention. To remove a disposable store, stop research and Studio first, then delete its DuckDB file and `.wal`; leave the catalog and reports intact.

## Application containers

One Dockerfile has `web` and `studio` targets. Both use Node 26.11.1 on Debian Bookworm, with the base image pinned by digest. Dependencies come from `package-lock.json` and are installed for the target Linux architecture. The website uses Next standalone output. Studio includes its UI, Mastra's production Node server, and a separate migration command. Neither startup command runs migrations or loads fixtures.

```sh
docker compose build
docker compose stop
docker compose run --rm --no-deps studio node commands/migrate.mjs
docker compose up -d --wait
```

Supply the closed catalog and any retained diagnostic stores before the first service start. Missing diagnostic stores are created empty. The migration command can also create an empty catalog for a temporary check. It is repeatable and returns nonzero on failure. Run it with all catalog users stopped. Use matching images and schema from the same source version.

Compose declares one named volume, `data`, mounted at `/data` in both services. Keep the same Compose project name to retain it during recreation. Do not use `docker compose down --volumes` for retained data. The fixed container paths are:

- `/data/eventroam.sqlite`: catalog, public website reads, and validated Studio writes.
- `/data/mastra-workflows.sqlite`: native CLI and Studio workflow history.
- `/data/mastra-observability.duckdb`: optional logs, traces, and metrics.

Both images run as `node` (UID/GID 1000). The volume directory and supplied files must permit this user to read and write, including SQLite WAL/shared-memory files and DuckDB WAL files. Website database connections stay read-only; the shared volume permits SQLite sidecar access. Only one process can own the DuckDB file. Stop Studio before any separate command opens that file.

Compose exposes web port 3000 and Studio port 4111 only on the Docker network. It publishes no host ports. Studio listens on `0.0.0.0:4111` and has no application login or credentials. Authentication for the complete public Studio host is an external ingress prerequisite. Network attachment, ingress authentication, DNS, TLS, Komodo, webhooks, and deployment automation belong in the self-hosted repository. Both services use `restart: unless-stopped`.

### Container inputs

Compose reads deployment inputs with `EVENTROAM_` and maps them to current application names. Existing local `.env` names and defaults stay unchanged. Set these inputs in the deployment environment or a selected Compose env file; do not commit credentials.

| Deployment input                                                                                                                                                                                                                    | Use                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EVENTROAM_MAPBOX_TOKEN`, `EVENTROAM_MAPBOX_STYLE`                                                                                                                                                                                  | Website build arguments mapped to `NEXT_PUBLIC_MAPBOX_TOKEN` and `NEXT_PUBLIC_MAPBOX_STYLE`. Empty token keeps list-only use; the style defaults to Mapbox streets-v12. Rebuild to change either value. |
| `EVENTROAM_PUBLIC_APEX_ORIGIN`, `EVENTROAM_PUBLIC_FESTIVALS_ORIGIN`                                                                                                                                                                 | Runtime `PUBLIC_APEX_ORIGIN` and `PUBLIC_FESTIVALS_ORIGIN`; defaults match local development. Set the public origins for deployment.                                                                    |
| `EVENTROAM_OPENROUTER_API_KEY`, `EVENTROAM_FIRECRAWL_KEY`, `EVENTROAM_GEOAPIFY_KEY`                                                                                                                                                 | Runtime Studio provider credentials. Neither is a build argument. Inspection needs no model key. Execution needs the migrated catalog and its usual provider settings.                                  |
| `EVENTROAM_OPENROUTER_MODEL`, `EVENTROAM_OPENROUTER_SERVICE_TIER`, `EVENTROAM_OPENROUTER_REASONING_EFFORT`                                                                                                                          | Runtime model selection; empty values keep the current application defaults.                                                                                                                            |
| `EVENTROAM_CATALOG_LOCATION_MODEL`                                                                                                                                                                                                  | Runtime `CATALOG_LOCATION_MODEL`; empty uses the normal model.                                                                                                                                          |
| `EVENTROAM_CATALOG_TRACING`, `EVENTROAM_CATALOG_LOGGING`, `EVENTROAM_CATALOG_LOG_LEVEL`                                                                                                                                             | Existing diagnostics, all off by default except log level `info`.                                                                                                                                       |
| `EVENTROAM_CATALOG_MAX_SEARCHES`, `EVENTROAM_CATALOG_MAX_SEARCH_RESULTS`, `EVENTROAM_CATALOG_MAX_AGENT_STEPS`, `EVENTROAM_CATALOG_MAX_DURATION_MS`, `EVENTROAM_CATALOG_MAX_PAGE_BYTES`, `EVENTROAM_CATALOG_MAX_MODEL_OUTPUT_TOKENS` | Existing execution limits; empty values keep the application defaults.                                                                                                                                  |

Database paths are Compose constants, without deployment inputs. Direct image use can set the `DATABASE_PATH`, `CATALOG_WORKFLOW_DATABASE_PATH`, and `CATALOG_OBSERVABILITY_DATABASE_PATH` runtime names. Builds exclude owner databases, `.env` files, old output, and host dependencies. Only the public Mapbox token and style enter browser assets. Complete the [Mapbox deployment gate](mapbox-deployment-gate.md) before public map use.

For a production Studio build outside Docker, use temporary build storage, then select runtime storage explicitly:

```sh
DATABASE_PATH=/tmp/eventroam-build/catalog.sqlite CATALOG_OBSERVABILITY_DATABASE_PATH=/tmp/eventroam-build/history.duckdb CATALOG_WORKFLOW_DATABASE_PATH=/tmp/eventroam-build/workflows.sqlite npm run studio:build
DATABASE_PATH=./data/eventroam.sqlite CATALOG_OBSERVABILITY_DATABASE_PATH=./data/mastra-observability.duckdb CATALOG_WORKFLOW_DATABASE_PATH=./data/mastra-workflows.sqlite npm run studio:start
```

`studio:start` serves the built UI and API on all interfaces without application authentication. It reads shell inputs; it does not load `.env`. Keep `npm run catalog:studio` for loopback development. Both servers preserve default preview, explicit apply, native cancellation, and the existing unsupported-execution guards. Hosted inspection alone makes no model call.

### Health and image verification

Both images include Node health probes. Website `GET /health` returns `200 {"status":"ok"}` for a readable public schema or generic `503 {"status":"unavailable"}`. It does not create or migrate a missing catalog. Studio uses its existing `GET /health`. These internal checks need no model or login inputs.

Run `npm run docker:smoke` to build both targets, prepare an empty test catalog with one explicit migration, and wait for both container health checks to pass. The script uses the application Compose file without host ports, a random project, and a temporary named volume. It supplies no owner data or provider credentials, makes no paid calls, and removes only its test project's containers and volume after success or failure. CI runs the same command instead of a separate host website build. Website health tests and full offline workflow execution remain outside the images.

### Replace supplied data

There is no merge or automatic transfer command. Stop all source and destination users before replacing either database, in either direction. Close/checkpoint SQLite and handle WAL state before copying; never copy a live WAL database's main file alone. Check SQLite integrity and open the closed DuckDB copy with the matching runtime before start. Copy only the catalog and observability data, without separate reports or debug directories. Set file ownership, run explicit migrations while users remain stopped, then start the matching release. Short downtime is expected.

Backups and recovery drills are deferred to the next iteration. Retained images permit code rollback only while catalog schema and DuckDB formats stay compatible. Image rollback does not reverse data changes; an incompatible migration needs a compatible saved data copy.

## Reference

`/Users/karo/projects/eventmap` is a read-only product reference. Do not modify it or copy its implementation wholesale; follow this project's specs and dependency choices.
