---
type: Guide
title: Development guide
description: Local setup, checks, change workflow, and catalog research commands.
status: stable
tags: [development]
---

# Development guide

Eventroam is under active development with no production deployment. Backward compatibility is not required yet. This guide covers local work; the [project structure](project-structure.md) explains code ownership, [OpenSpec](../openspec/specs/) defines implemented behavior, and [ADRs](index.md#decisions) record technology choices.

## Local setup

Use the Node.js and npm versions pinned in `.node-version` and `package.json`. From the repository root:

```sh
npm ci
npm run db:fixtures
npm run dev
```

Open `http://localhost:3000` for the scope directory or `http://festivals.localhost:3000` for discovery. Fixtures create a migrated database at `./data/eventroam.sqlite` and add repeatable fictional records.

Copy `.env.example` to `.env.local` for Next.js settings. A Mapbox token is optional locally; the list and filters work without one. Migration and fixture commands read the shell environment, not `.env.local`. For a custom database, run `DATABASE_PATH=./data/custom.sqlite npm run db:fixtures` and set the same path in `.env.local`. Catalog research, eval, and Studio commands load `.env`. Keep credentials in ignored local env files.

Codex worktrees use `.codex/environments/environment.toml` to link the source checkout’s `.env` and run `npm ci` in the new worktree. The setup requires the pinned Node.js and npm versions to be available on `PATH`.

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

`npm start` serves the built application. `npm run test:e2e` runs desktop and mobile discovery journeys against a temporary fixture database on port 3137. Mapbox loading is disabled, so this suite does not verify live tiles or marker interaction. Pass Playwright options after `--`, for example `npm run test:e2e -- --project=mobile`.

Run `npm run test:coverage` for unit and integration coverage of application and command TypeScript, including unimported files. E2E, test helpers, declaration files, and child-process coverage from Studio and tracing fixtures are excluded. Reports go to ignored `coverage/`; CI publishes totals and retains the HTML `test-coverage` artifact for 14 days. Coverage thresholds are not enforced. React tests use a per-file `// @vitest-environment jsdom` directive and React Testing Library; other tests use Node.

Mastra transport tests start the SDK’s `createNodeServer` directly against temporary catalogs; they do not build or launch the Studio CLI. Observability tests read closed DuckDB stores in the test process, with a dedicated subprocess test for persistence after writer exit. Retry and tracing-abort tests advance controlled timers after the SDK reaches the relevant wait, preserving the configured production delays.

Use the built-in Browser for local UI verification. On macOS, obtain approved execution outside the command sandbox before launching full Chrome through a shell or test runner, including headless mode.

Tests live beside their implementation. Use `testDatabase()` for a fresh migrated temporary database and `testFixtures()` from `src/test/fixtures.ts` for typed builders and inserts. Cleanup is automatic. `fx.build.*` creates objects without storing them; `fx.publishedEvent(...)` creates a complete public scenario. Omitted fields receive defaults, explicit `null` is preserved, and `undefined` overrides are ignored. Set values that affect the scenario or assertions. Tests do not load development fixtures or fetch live source pages; direct SQL is appropriate for testing database constraints or deliberately invalid data.

Run `npm run deps:check` to check runtime dependencies in `src/` and `commands/` for circular dependencies, unresolved imports, and production imports of test code. Type-only imports and other dependencies erased by TypeScript compilation are excluded. CI runs the same check.

## Change workflow

Read the relevant spec, nearby tests, and configuration before editing. Inspect the working tree and preserve unrelated changes. Follow the [module boundaries](project-structure.md#boundaries), validate external input at runtime, and review generated migrations. Keep code, tests, specs, and documentation aligned when changing a contract.

For behavior changes, use the standard OpenSpec workflow: explore or propose, define testable delta specs, add design and tasks, implement, verify, synchronize main specs, and archive. In Codex, use the corresponding `$openspec-*` skills; use `npm exec -- openspec` for the project-local CLI. Group capabilities under `catalog/`, `website/`, or `operations/`, with matching main and delta paths. Keep unresolved choices in [draft proposals](proposals/) and lasting technology decisions in ADRs.

Before handoff, run focused tests and applicable checks, then report the result and remaining uncertainty. Run `docs:check` for documentation edits and `openspec:validate` for OpenSpec edits.

New changes use the project-local [review-driven schema](../openspec/schemas/review-driven/schema.yaml), forked from OpenSpec 1.14.0's `spec-driven` schema. It keeps the proposal/specs/design/tasks workflow and requires a design for every change. Start with Small, Medium, or Large and a short reason based on coupling, risk, and verification effort. Scale design and tasks to that assessment; small changes can use a few paragraphs and focused steps.

Write artifacts in plain English. Show important contract changes, execution flow, rule ownership, and the reasons for key decisions. Consider simpler options both within current requirements and with reduced scope; reducing scope still needs agreement. Keep each design coherent by folding corrections into the relevant sections. Tasks describe reviewable outcomes and their checks without repeating design details. Existing changes retain the schema recorded in their `.openspec.yaml`.

After editing the custom schema or templates, run `npm exec -- openspec schema validate review-driven` as well as the documentation and OpenSpec checks. The local fork does not automatically inherit future upstream schema changes.

Use the repository's [plan-review skill](../.agents/skills/plan-review/SKILL.md) with `$plan-review <change-name>` to review a plan before implementation or after material changes to requirements or design. It checks consistency, contracts, architecture, simplicity, task scope, and verification against repository evidence. It reports blockers, useful improvements, and readiness without editing the plan. Use `openspec-verify-change` to check completed implementation instead.

## Local database

`npm run db:migrate` applies reviewed migrations to `DATABASE_PATH`; `npm run db:fixtures` also loads fictional development data. Fixtures are separate from schema migrations and omit audit history. Normal catalog mutations must use the validated writer; seed loaders must use shared catalog validators.

A disposable development database can be recreated when its schema becomes obsolete. Stop processes using it before replacing it. Preserve valuable research data with a consistent SQLite backup before experiments, then work on a separate copy and pass its path explicitly. SQLite's backup API includes committed WAL data; copying only the live main file is insufficient. Verify backups with `PRAGMA integrity_check`. The Edition naming migration (`0005_rename-occurrence-to-edition.sql`) preserves catalog and history while replacing the old Occurrence table/column names. Stop readers and writers, take and verify a backup, run `db:migrate`, then start the matching Edition code. To downgrade, restore both the old code and the pre-migration database backup; do not run old code against the renamed schema. The estimated-size migration (`0007_estimate-festival-size.sql`) renames `capacity_estimate` to `size_estimate` while preserving numeric estimates and all catalog/history data. Existing development estimates may still reflect capacity and need rechecking through refresh. Apply with matching code after stopping processes and backing up; rollback restores that code/database pair. Historical reports remain opaque storage and are unsupported by current report/eval consumers. See the [SQLite decision](decisions/001-sqlite-and-drizzle.md) for storage details.

## Local catalog research

Set `OPENROUTER_API_KEY` in `.env`. The selected database must exist and be migrated; publication also needs curated taxonomy terms, which migrations do not seed. `npm run catalog -- --help` lists options.

```sh
npm run catalog -- add --name "Festival name" --database data/research.sqlite
npm run catalog -- refresh --event EVENT_ID --database data/research.sqlite --report data/refresh.json
npm run catalog -- refresh --event EVENT_ID --database data/research.sqlite --apply
```

`add` creates new Events; use `refresh` for existing ones. Preview is the default and still needs a writable database: catalog changes roll back, while the private run report persists. `--apply` starts fresh research rather than applying a saved preview. Use `--republish` to permit withdrawn records to publish again.

The defaults are `openai/gpt-6-luna`, medium reasoning, and Flex routing. Set `OPENROUTER_MODEL`, `OPENROUTER_REASONING_EFFORT`, or `OPENROUTER_SERVICE_TIER=standard` to override them. Flex can have higher latency and capacity errors. Optional `FIRECRAWL_KEY` enables a fallback for HTTP 403 responses. Research permits 15 ordinary model steps by default, reserving the last for a final response; override this with `--agent-steps` or `CATALOG_MAX_AGENT_STEPS`. There is no application limit on total input context characters. Defaults and remaining `CATALOG_MAX_*` safeguards are in `.env.example`; CLI overrides also include `--searches` and `--seconds`. Limits bound work, not exact spending.

The [ingestion guide](ingestion-process.md) explains source handling, fact selection, previews, publication, and reports. Research is model-led and can make factual mistakes. Inspect the report before deciding on an apply run. After interruption, start a fresh run against current state; already committed changes remain.

### Catalog evals

`npm run catalog:eval -- --help` lists options. Evals use captured sources, fresh temporary catalogs, and preview writes. Only model calls use the network and incur provider charges; `npm test` checks the machinery without an API key.

```sh
npm run catalog:eval
npm run catalog:eval -- --case sziget --repeat 3 --model openai/gpt-6-luna
```

Use `npm run catalog:eval -- --editor-only` to replay the five captured research handoffs and run only live editor generation. `--case ID` selects a replay case; cases without handoffs fail before generation. Reports label `evaluationMode` and handoff provenance/hash. Source pages remain local fixtures. Known model cost is editor-only; injected research accounting remains partial, not end-to-end usage. Keep full-pipeline evals for research changes and integration checks.

Reports default to `data/catalog-evals/`; `--report PATH` selects an output file. Failed assertions or host workflow/persistence failures produce exit code 1. Evals measure required changes and forbidden claims. Seven synthetic scope cases additionally score temporal selection and research completeness, including unchanged saved history, independently of mutations. Together with six captured-source cases, the default suite has 19 cases, including one full-refresh case covering four participant-size situations; fixture schema 2 is independent of report v5. They are not an apply gate. Compare models or prompts on the same fixtures and repeat runs to expose variability.

Cases and expectations live in `src/ingestion/evals/cases/`. When refreshing captured pages, review their expected results too. Check that facts belong to the intended festival and edition, especially venue versus office addresses and ticket links versus signup forms.

### Local Studio ingestion

Run `npm run catalog:studio`, open `http://127.0.0.1:4111` in the built-in Browser, and choose Workflows → `catalog-ingestion`. Inspection needs no model credentials or catalog; execution needs the migrated `DATABASE_PATH` and OpenRouter settings from `.env`.

```json
{ "mode": "add", "name": "Festival name" }
```

```json
{ "mode": "refresh", "eventId": "EVENT_ID", "scope": "full", "dryRun": false, "republish": false }
```

Studio accepts one Event per refresh, with optional `scope: "full"|"current"` (default full). Add rejects scope and check is unsupported. Preview is the default. Inspect intermediate results and the final report in the workflow view. Use native cancellation while a run is active; after interruption, start a fresh run. Per-step execution, resume, restart, and time travel are unsupported. See the [workflow steps](ingestion-process.md#workflow-steps) for the shared CLI/Studio lifecycle.

### Local trace inspection

Logging and tracing are independently opt-in and default off. Tracing requires an apply run with the real agent; logging also supports previews. `CATALOG_LOG_LEVEL` accepts `debug`, `info` (default), `warn`, or `error`.

Close Studio before recording from a separate CLI process: DuckDB requires exclusive process ownership of its file.

```sh
CATALOG_LOGGING=true CATALOG_TRACING=true npm run catalog -- refresh --event EVENT_ID --apply --report data/research-report.json
npm run catalog:studio
```

In Studio, open Observability → Logs or Traces. Both commands use `CATALOG_OBSERVABILITY_DATABASE_PATH`, defaulting to `data/mastra-observability.duckdb`. Use the durable runId to correlate records. The [ingestion guide](ingestion-process.md#inspect-local-agent-traces) explains recorded fields and privacy boundaries.

Observability is best effort; incomplete or missing traces do not replace the durable report. Revisit flush/shutdown handling if missing traces or closed-store failures recur. Local stores have no automatic retention. To remove a disposable store, stop research and Studio first, then delete its DuckDB file and `.wal`; leave the catalog and reports intact.

## Future deployment and reference

Production packaging and Docker Compose are not implemented. See [production readiness](../openspec/changes/production-readiness/proposal.md) and the [Mapbox deployment gate](mapbox-deployment-gate.md) for planned work.

`/Users/karo/projects/eventmap` is a read-only product reference. Do not modify it or copy its implementation wholesale; follow this project's specs and dependency choices.

Migration `0006_remove-ingestion-report-check` removes the entire database report check while preserving run rows and historical JSON. Migrate before writing report v3; current application finalization/evals reject v2. Stop readers/writers and back up SQLite before migration; downgrade by restoring matching code and the backup. Refresh supports repeated `--event` and `--scope full|current`; each Event has an independent atomic attempt.
