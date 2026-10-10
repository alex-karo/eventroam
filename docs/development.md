---
type: Guide
title: Development guide
description: Implementation workflow, application commands, and local development practices.
status: stable
tags: [development]
---

# Development guide

This guide holds implementation and working practices. Implemented behavior belongs in [OpenSpec](../openspec/specs/), approved future work in [active changes](../openspec/changes/), unresolved choices in [draft proposals](proposals/), and lasting technology choices in [ADRs](decisions/001-sqlite-and-drizzle.md).

## Technical direction

- Build the smallest working vertical slice first. Use one Next.js/React application with strict TypeScript, server-rendered public pages, and a client-side interactive map. Follow the [project structure](project-structure.md): routes and composition in `src/app`, discovery UI and pure filtering in `src/features/discovery`, shared UI in `src/components`, public reads and contracts in `src/catalog/read`, validated operations in `src/catalog/operations`, writes in `src/catalog/write`, and request adapters in `src/site/server`. Keep the catalog writer independent of Next.js. Add a protected UI only when needed.
- Follow [ADR 002](decisions/002-runtime-and-tooling.md) for the selected runtime/tooling baseline: Node.js, npm, Next.js/React, Zod, Tailwind, Mapbox GL JS, Vitest, and Playwright, with compatible compiler/lint versions. Keep pinned versions and native SQLite packaging verified when dependencies change.
- Use SQLite, Drizzle, explicit reviewed migrations, and one persistent local Docker volume as described in [ADR 001](decisions/001-sqlite-and-drizzle.md). Run owner-initiated database operations from `commands/`; collection workflows live in `src/ingestion/`. Add a separate API, queue, search, scraper, or AI service only when a concrete requirement justifies it.
- Prefer this sequence: schema and domain rules; a small source-verified dataset; indexable list and detail pages; map using the same query and filters; validated agent writes and audit; complete manual refresh and discovery. Keep each step part of a working product.

## Public web

- The map enhances linked list/detail discovery. Public pages need stable URLs, server-rendered content, titles and descriptions, canonical and social metadata, sitemap entries, and relevant schema.org data. Exclude drafts, duplicate filtered views, and thin placeholders from indexing.
- Put useful shareable filter state in URLs. Treat mobile usability, keyboard access, reduced motion, and map/list parity as baseline. Keep map-provider code behind a small adapter.
- Follow the [discovery contract](../openspec/specs/website/discovery/spec.md): return the complete public discovery summary set, load full details on selection, show map/list together on desktop, and provide easy switching on narrow screens. No viewport query or “Search this area” control. The fixture-backed application filters in the browser with shared server-rendering rules.
- Use scope subdomains with one application and shared catalog. The [scoped website spec](../openspec/specs/website/routing/spec.md) records current routes; the [draft routing proposal](proposals/website-routing-and-indexing.md) covers unselected cross-scope and indexing policies.
- Owner-initiated collection runs locally through the catalog CLI and uses the validated writer; server execution and scheduling remain deferred. Web routes use public catalog reads. The browser uses public contracts and pure filtering rules, and does not import database or writer modules.

## Change workflow

### Application commands

Use Node.js 26.10.0 and its bundled npm 11.19.1 (see `.node-version` and `package.json`). From the repository root, run `npm ci` for a clean install, then `npm run dev` for the local App Router server. The default SQLite location is `./data/eventroam.sqlite`; copy `.env.example` to `.env.local` only when a different `DATABASE_PATH` is needed. The data directory and local environment files are ignored by Git.

Run `npm run type-check`, `npm run lint`, `npm run format:check`, and `npm test` for local checks. `npm run build` creates the production build, and `npm start` serves it. The SQLite smoke test uses a temporary real database file and verifies Drizzle queries, foreign keys, WAL, and the bounded busy timeout. Run `npm run test:e2e` for the four Festivals filter journeys in desktop Chromium and mobile Chromium. Its launcher creates a fresh temporary SQLite database, runs migrations, loads only fictional development fixtures, and removes the database afterward. The server uses port 3137 and disables Mapbox loading, so the suite checks shared map/list counts and mobile view switching but not live map tiles or marker interaction. Pass Playwright options after `--`, for example `npm run test:e2e -- --project=mobile`. Compose commands will be documented when that workflow is implemented.

Vitest installs database cleanup for every test. Call `testDatabase()` when a test needs SQLite; it creates and migrates a fresh temporary database on first use. Use `const fx = testFixtures()` from `src/test/fixtures.ts` for typed test data. `fx.build.*` creates objects without writing to SQLite; `fx.event`, `fx.occurrence`, `fx.term`, `fx.eventLink`, `fx.occurrenceLink`, and relationship helpers insert records. `fx.publishedEvent({ event: { slug: "example" }, occurrences: [{ startsOn: "2028-07-01" }] })` creates a complete public scenario with terms and URL aliases. Omitted fields get defaults, explicit `null` is preserved, and an `undefined` override is ignored. Describe scenario data inside each test and specify values that the test checks or that affect its logic. Use direct SQL for constraint and query-count tests. Tests do not load development fixtures.

Run `npm run db:migrate` to apply the reviewed Drizzle SQL migrations to `DATABASE_PATH`. Run `npm run db:fixtures` to migrate and add repeatable fictional development records; both scripts enter through `commands/catalog-db.ts`, and fixture records live in `commands/development-fixtures.ts`. Fixtures are a separate data operation and are not part of the schema migration. The fixture command keeps existing fixture identities on repeat runs. Development fixtures insert catalog records directly and do not create operation receipts or audit history. Test fixture helpers also omit operation receipts and audit history. The initial migration was simplified before deployment; recreate any existing local development database from an older schema. `applyCatalogOperation` in `src/catalog/write` supports validated catalog writes with stable operation keys, expected versions, actor attribution, and audit history. Research writes retain old/new values and owner attribution through the same operation schema as other catalog writes. Existing published records are not automatically withdrawn. No scheduled runner is configured.

- Use OpenSpec's standard workflow for behavior changes: write a proposal with the user's goal and delta specs with testable scenarios before implementation; add design and tasks when the change is ready to build. In Codex, invoke `$openspec-explore` or `$openspec-propose`, then `$openspec-apply-change`, `$openspec-update-change` when plans change, and `$openspec-archive-change` only after implementation and verification. `$openspec-sync-specs` is available when an active delta must reach the main specs before archive. Group capabilities under `catalog/`, `website/`, or `operations/` and give each delta the same capability path as its main spec. Keep main specs aligned with implemented behavior. Use the project-local CLI through `npm exec -- openspec` and run `npm run openspec:validate` to check artifacts. Reload the Codex task after initial setup so the generated skills appear. Record lasting cross-cutting decisions in short ADRs.
- Before editing, read the relevant spec, nearby tests, and configuration; inspect the working tree and preserve unrelated changes. Make the smallest complete change that keeps data, UI, and ingestion aligned.
- Validate external input at runtime; avoid `any`. Review generated migrations. Keep secrets out of source control and document only safe variable names in `.env.example`. Log stable run/source IDs without credentials or unnecessary personal data.
- Use focused unit tests for normalization, matching, and transitions; persistence and route integration tests; and a few critical end-to-end tests. Add a regression test for a bug when practical. Normal parser tests use small, attributable saved fixtures, not live third-party pages.
- Before handoff, run narrow relevant tests and standard checks when practical. Verify changed Docker configuration. Report changes, checks, and remaining uncertainty. Document new ingestion and Compose commands here when they exist.

## Local catalog research

`npm run catalog -- --help` lists the local commands. Set `OPENROUTER_API_KEY` in the ignored `.env` file; the catalog command loads it. The default model is `openai/gpt-6-luna`. Override it with `OPENROUTER_MODEL` when evaluating another model supporting tools and structured output. Eval, research, and discovery request Flex by default: missing or blank `OPENROUTER_SERVICE_TIER` resolves to `flex`. Set `OPENROUTER_SERVICE_TIER=standard` to omit the provider tier and use standard routing. Flex may have higher latency or capacity errors, and the run's five-minute default limit still applies. A model without Flex endpoints may route at standard rates, so check OpenRouter's reported tier and cost when comparing runs. `OPENROUTER_REASONING_EFFORT` optionally sets `none`, `minimal`, `low`, `medium`, `high`, or `xhigh` for ordinary research and discovery calls; the selected model must support that level. Leaving it empty explicitly selects `medium`. The default output allowance is 16,000 tokens per model call, including reasoning; `CATALOG_MAX_MODEL_OUTPUT_TOKENS` can override it. Reports record the requested effort (`null` means provider default), `cachedInputTokens` and `reasoningTokens`. These token counts are subsets of input/output totals, not extra tokens. Missing provider details or an interrupted generation yield `null`; reported costs and total tokens may remain partial after an interrupted generation. The source reader does not require a browser installation. Use the built-in Browser for local UI verification.

```sh
npm run catalog -- add --name "Festival name" --database data/research.sqlite
npm run catalog -- refresh --event EVENT_ID --database data/research.sqlite --report data/refresh.json
npm run catalog -- check --event EVENT_ID --database data/research.sqlite --apply
```

The database must exist and be migrated first. Publication also requires existing curated taxonomy terms; migrations do not seed vocabulary and the agent never creates terms from labels. `add` researches the latest completed and next announced editions and creates only new Events; an existing match returns skipped with its ID and no operations; `refresh` targets one Event ID, while `check` accepts one or more Event IDs for independent checks. Both consider relevant editions of each selected Event. The CLI records `catalog-research` as the actor without requiring a named initiating owner; `--republish` explicitly permits withdrawn records to publish. Dry-run is the default: it runs the writer in a transaction on the catalog database, collects the preview, then rolls back without retained catalog changes; the private run and preview report persist. The command opens a writable database connection for both preview and apply. `--apply` researches again and may differ from a prior preview. Structurally eligible records publish directly; incomplete records remain drafts.

One Mastra research agent chooses searches, reads sources, matches existing Event IDs, and proposes resolved changes; it cannot write. Ordinary model calls use Mastra's built-in model router with the configured API key and `openrouter/` prepended internally to the unchanged `OPENROUTER_MODEL` value. Flex and reasoning use provider options; SDK retries and Mastra's default error processors are disabled. Ordinary research retries only OpenRouter's explicit `provider_unavailable` error, at most three times per run with 10-second, 30-second, and 90-second backoff (or a longer bounded `Retry-After`), within the run deadline. A bounded retry allowance preserves ordinary agent iteration capacity; observed model request counts include unavailable attempts. A recovered retry preserves earlier steps and does not replay tools. Missing provider usage still makes the total partial and full cost unavailable. Discovery remains a bounded direct OpenRouter HTTP call with the web/Exa plugin and its existing search backoff. A compact adapter checks the response schema and requested catalog targets, then maps the proposal to writer operations. The model’s factual interpretation is accepted without host quote, authority, conflict, or supersession verification. There is no snapshot preparation or feedback round. The writer handles structural validation, no-op detection, versions, and atomic item commits. The source reader uses bounded HTTP requests without executing page scripts. Turndown converts HTML into bounded Markdown, preserving headings, lists, tables, links, and page order. Sparse HTML with application scripts is reported as partial with `javascript_required`; missing facts on such pages are not verified absences. The model receives each page as continuous Markdown; extracted links remain available for traversal. Facebook/Instagram retrieval is unsupported. OpenRouter Exa searches supply candidate links only. Page text is untrusted data, and source requests reject private addresses and unsafe redirects.

Per-festival defaults are 3 searches, depth 2, 10 Mastra agent iterations, 5 minutes, and 2 MiB per page. Page reads have no count cap. Input/output are bounded too. Tool steps share the run budget; there is one final candidate and no validation feedback call. Mastra bounds generation with `maxSteps` and native total timeout; the remaining attempt deadline also bounds initial reads, discovery and retry waits. CLI overrides include `--searches`, `--agent-steps`, and `--seconds`; the full `CATALOG_MAX_*` environment names are in `.env.example`. Limits bound work, not exact spend.

The model chooses which inspected material supports facts, resolves conflicts, and interprets programme dates, capacity, ticket scope, classification, and moves. Host code does not check that interpretation. It rejects malformed responses and changes outside requested Event/Occurrence targets. Omitted fields preserve stored values. A structurally invalid writer operation rolls back the item and appears as a write failure in the report. Fixed-source evals measure factual accuracy without citation assertions.

Prices are the exception to missing-field preservation: a supplied valid price block replaces the entire `price_details` array and typed primary price together. The agent supplies the primary full-programme base admission price or `null`; code does not select a ticket. An empty block clears both representations. The model should omit the block when extraction fails. Variants contain a label and optional amount/currency, terms, category availability, and URL. All model amounts use major currency units and validated uppercase three-letter ISO currency codes. Base `minAmount/maxAmount` convert to safe integer minor units using currency precision at the adapter boundary; stored base prices convert back before entering model context. Excess fractional precision fails without rounding. Variant amounts remain major units. There is no per-ticket merge or exhaustive-offer guarantee. Public details expose only variant label/availability and retain the primary price display. Aggregate availability is absent from public payloads and all detail/list/map indicators; the old database field remains unused by public readers.

For `refresh` and `check`, the host initially reads the first saved official-site link, or the first saved link when none is marked as an official site. Every saved URL is included in the agent input with known owner and edition context; the agent selects any further reads. `add` starts from the festival name and discovers a source before inspecting it. The prompt asks the model to read by section and edition, prioritize identity and programme dates, and stop after useful facts. Mastra intermediate structured-output validation uses a silent warning strategy so text accompanying tool calls does not abort research. One final candidate must pass strict schema validation before catalog operations.

Research loads current private facts, versions, links, and terms for the requested `refresh`/`check` Event. `add` retains the existing full-catalog matching context. Audit history remains in the catalog database and is not part of research context. This avoids loading unrelated Events for targeted runs without introducing a separate identity index.

Version 2 terminal/JSON reports distinguish `researchStatus` (success/partial/failed) from catalog `outcome`, and show explained old/new facts, staged errors, unresolved questions, source summaries, technical retrieval history, model/prompt versions, duration, tokens, and cost when reported. An existing Event name is never renamed by research; a trimmed case-sensitive difference is logged as informational `eventNameMismatch` with both original names and ID. Success/partial proposals use the atomic writer; failed research creates no operations. Partial and skipped alone exit zero; research or write failure exits nonzero. Write failure retains research status, summaries, and mismatch metadata. New report consumers reject unsupported versions; old reports are not converted and the historical `gaps` fallback is removed. Reports retain `modelResponse.text` and `modelResponse.object` before candidate normalization, separately from catalog operations, including rejected candidates and write failures. A missing response or component is `null`; fixture-injected candidates have no original text. These are final outputs, not a reasoning trace. Reasons are attached to actual reported changes through preparation mappings; unchanged proposals retain reasons only in raw output. Shared `sourceSummaries` describe useful page information without direct fact-to-source references. Omitted facts and link slots preserve stored values; a supplied URL replaces only that owner/kind slot. Host `model_failed` errors include safe `diagnostic` metadata when available: recognized error/cause types, HTTP status, provider/network code, and SDK retryability. CLI text and JSON/eval reports retain it; unknown details are not inferred. The capacity-specific retry policy above remains unchanged. Reports are private durable run records with optional local files and do not copy full source pages, prompts, credentials, raw provider messages/bodies/headers, or sessions. Catalog audit entries have old/new values and attribution. Unchanged checks add no audit entries. After interruption, rerun the command against current state with new operation keys. Completed item transactions remain; incomplete transactions roll back. A running record without final report/statistics has unknown completion; reruns create new runIds without modifying it.

### Catalog evals

`npm run catalog:eval -- --help` describes the opt-in Mastra eval command. It runs the real research workflow and configured OpenRouter model against five captured-page festival cases and one blocked-source failure case, using fresh temporary catalogs and dry-run writes. Only model requests use the network: source reads and searches use fixtures; an uncaptured URL never falls back to live retrieval. Normal `npm test` checks the eval machinery without an API key.

The Tomorrowland eval rejects Thailand's sold-out status on Belgium ticket variants through a forbidden `price_details` assertion.

The Roskilde eval includes the festival contact page and checks the venue address separately from the office address. It permits `DK` or an unknown country and rejects a different country; it does not require a country absent from the captured text. Annual eval expectations use `editionYear` to match the typed occurrence year; `editionKey` is retained for a specific stored edition such as `source-row`.

```sh
npm run catalog:eval
npm run catalog:eval -- --case sziget --repeat 3 --model openai/gpt-6-luna
npm run catalog:eval -- --case afro-nation-portugal-blocked
```

Runs use up to three concurrent cases. Reports default to private files under `data/catalog-evals/`; `--report PATH` selects a new file. A failed assertion or host `workflow_failed`/`run_persistence_failed` makes the command exit with code 1 after saving its report. Typed persistence failures retain the available result, runId, and known statistics; expected blocked-source cases also reject host failures. Run rows exist only in fresh migrated temporary eval catalogs and are discarded with them. Model budgets use the same `CATALOG_MAX_*` environment settings as research runs.

The cases in `src/ingestion/evals/cases/` cover Tomorrowland, Wacken, Roskilde, Sziget, Glastonbury, and an Afro Nation Portugal blocked-source regression. `suite.json` lists the case files and shared date, provenance, and taxonomy. Each festival folder contains `case.json` (initial catalog, source metadata, and expectations) and `page.md` (captured page content). Each source names its Markdown file with `markdownFile`, relative to its case file; multiple pages can use separate files. Sziget also includes HTTP snapshots of its linked tickets and travel pages; the tickets snapshot retains the partial response obtained with rendering disabled. The loader reads Markdown verbatim, without formatting or trimming it. Website content was fetched afresh on 2026-10-03 and saved as bounded page snapshots with continuous Markdown, final URLs, and retrieval timestamps. Snapshots contain neither citation block IDs nor a separate source-link array. The fixture adapter derives internal traversal/provenance links from the saved Markdown without fetching pages. The Afro Nation case records HTTP 403 metadata captured on 2026-10-08, with an empty content file and deterministic empty search results; it is a controlled failure replay, not a full search capture. Its case date overrides the shared date, leaving the existing five cases unchanged. Domain date is fixed separately from elapsed-time budgets. Refreshing a snapshot requires reviewing its expected results too.

Mastra `runEvals` and custom `createScorer` checks evaluate final catalog changes after the writer transaction. Completeness measures required assertions met; correctness measures forbidden assertions avoided. Citations are not assertions in the model-direct contract. Passing requires both. Ordinary factual cases reject failed research and empty results. The blocked-source case instead expects a valid model-declared failed response with null data, a source-failure explanation, and no operations or changes. Empty partial/success responses and provider, limit, validation, or writer failures do not pass that case. Partial results in ordinary cases remain assessed by their factual assertions. Catalog/eval reports use version 2 only; captured-page fixture schema versions are independent. Reports include runId, assertion failures, model/prompt/fixture versions, tokens, reported model cost, estimated search cost, and duration. Historical version-2 reports without runId/searchCostBasis remain readable. These cases measure model quality; they are not an apply gate.

When reviewing failures or revising cases, check the source context for the exact Event and edition. Known errors include treating a sibling festival as the target, assigning a later announcement to an older edition, using an office address as a venue, and treating a newsletter signup as ticketing. An excerpt's presence on a page does not establish that it supports the proposed fact. Compare model and prompt runs on the same fixtures and assertions, repeat them to expose variability, and rerun after changing retrieval or workflow behavior.

### Local Studio ingestion

Run `npm run catalog:studio`, open `http://127.0.0.1:4111` in the built-in Browser, then choose Workflows → `catalog-ingestion`. The eight steps show live progress. Inspection needs no model key or catalog; execution needs the existing migrated `DATABASE_PATH` and OpenRouter configuration from `.env`.

Input examples:

```json
{ "mode": "add", "name": "Festival name" }
```

```json
{ "mode": "refresh", "eventId": "EVENT_ID", "dryRun": false, "republish": false }
```

`check` accepts one Event ID in Studio. `dryRun` defaults to true and `republish` to false; actor is fixed to `catalog-research`. A preview rolls back catalog changes but retains its durable report. Apply starts fresh research, without reusing a preview. The result shows `engineRunId`, `ingestionRunId`, research/catalog outcomes, persistence status, counts, known usage and safe error codes. The complete private version-2 report is in the catalog’s `ingestion_runs.report_json`, keyed by `ingestionRunId`; CLI `--report` still exports private reports.

Use Studio’s native cancellation while a run is active. Observed cancellation prevents later writes and retains known usage/confirmed commits; cleanup waits for active work. Final persistence failure exposes `run_persistence_failed` and the ingestion ID, leaving the row running without repeating work. Start a new full run after interruption. Per-step execution, resume, restart and time travel are rejected.

Studio attempts share its observability store in the same process. Finishing an attempt leaves inspection and subsequent runs available. Close Studio before recording from a separate CLI process against that DuckDB file.

### Local trace inspection

Close Studio before research; DuckDB requires exclusive process ownership of its file.

```sh
CATALOG_LOGGING=true CATALOG_TRACING=true npm run catalog -- refresh --event EVENT_ID --apply --report data/research-report.json
npm run catalog:studio
```

Open `http://127.0.0.1:4111` in the built-in Browser and select Observability → Logs or Traces. Studio registers the shared `catalog-ingestion` workflow. Inspecting its graph needs neither credentials nor a catalog connection; execution loads prerequisites lazily. The launcher resolves `DATABASE_PATH` and `CATALOG_OBSERVABILITY_DATABASE_PATH` before Mastra changes working directory. Research and the launcher resolve `CATALOG_OBSERVABILITY_DATABASE_PATH` (default `data/mastra-observability.duckdb`) to the same absolute path. The catalog remains SQLite. The old `CATALOG_TRACE_DATABASE_PATH` no longer selects recording or inspection; historical SQLite files are left untouched and have no legacy inspection route.

`CATALOG_LOGGING=true` enables selected application events independently of `CATALOG_TRACING=true`. Both default off. `CATALOG_LOG_LEVEL` supports `debug`, `info` (default), `warn`, and `error`; the same threshold controls stored events and native Pino JSON on stderr. Stdout and private v2 reports retain their existing format. Trace eligibility remains apply-only with a real agent. Dry runs and injected generators create no spans; logging can still record their host lifecycle. If neither signal is eligible, no observability store is created. Every event uses the durable report/ingestion runId. Initialization or file-lock failure emits a fixed diagnostic and continues research without recording; close the other owner and retry only when you intentionally want a new research run. Never delete a lock held by a running process. Parallel eval cases need separate per-process observability paths if recording is required.

When logging is enabled, the same native PinoLogger is passed to Mastra with runId and known eventId context. For add runs, subsequent logs acquire eventId after an existing match or a committed creation; dry-run creation IDs are not bound. SDK diagnostics use stderr at the configured level; `loggerOptions.export` remains false, so only explicitly bridged application events reach Studio. With logging disabled, Mastra logging remains disabled.

Logs use Mastra PinoLogger's ordinary debug/info/warn/error methods and scoped `child({...})` context. Producers pass plain objects with selected fields, such as source character count and response status/URL. They do not pass source Markdown, prompts/history, full responses, transport data, SDK objects or raw errors. Selected completed-step commentary and provider-returned reasoning use explicit `shrinkText(text)` at a 4,000 Unicode-code-point default; producers may record original length and a truncation flag. There is no per-event payload schema, runtime field allowlist, recursive sanitizer or whole-record 8 KiB cap. Debug events follow the same producer selection rule. Studio and native stderr JSON receive the selected fields. The [ingestion guide](ingestion-process.md#inspect-local-agent-traces) describes examples and trace fields.

Step text is observed through `onStepFinish`, once per channel, with step/attempt and origin. It may appear after tool results. Unfinished steps may have no text; unavailable reasoning is not reconstructed. Tool results contain selected source character counts and retrieval metadata only. Complete final values, explanations and diffs remain in the private report. Log producers calculate straightforward write dispositions and counts when emitted, without depending on a trace summary.

Trace labels, explicit source fields and terminal validation/write outcomes survive DuckDB's supported event-sourced export. The owner ends spans, then attempts flush and shutdown, each bounded to two seconds. Recording remains best effort: overlapping background work, failed cleanup or forced termination can lose events. Closed stderr pipes and asynchronous output errors disable further progress/diagnostic writes to that stream while research and durable finalization continue. Required durable run storage still controls success; a run-finalization failure logs “Required run finalization failed” with `errorCode: run_persistence_failed`, preserves a confirmed catalog commit and rethrows the original error.

For native run selection after Studio closes, use the installed store API in a TypeScript script executed with `tsx`:

```ts
import { DuckDBStore } from "@mastra/duckdb";
async function inspect() {
  const store = new DuckDBStore({ path: "/absolute/path/mastra-observability.duckdb" });
  await store.init();
  try {
    const domain = (await store.getStore("observability"))!;
    const page = await domain.listLogs({
      filters: { runId: "RUN_ID" },
      pagination: { page: 0, perPage: 100 },
    });
    console.log(page.logs.filter(log => log.message === "Model commentary observed at step completion"));
    // Increment page until pagination.hasMore is false. Message/field selection is a client filter.
  } finally { await store.close(); }
}
void inspect();
```

Studio exposes severity and trace filters; selected step/attempt fields and runId appear in record details. Use its running API or the stopped-process store recipe for run selection; do not open another writer against the live Studio file. Local files have no automatic retention. Stop research and Studio before deleting a disposable observability store:

```sh
rm -f data/mastra-observability.duckdb data/mastra-observability.duckdb.wal
```

For a custom path, delete that DuckDB file and its `.wal` while processes are stopped. Catalog records, historical SQLite traces and research reports are separate.

### Durable ingestion runs

Migrate the selected catalog before using the updated research command. Migration `0004_ingestion-runs` adds the private `ingestion_runs` table without backfill or catalog changes. Stop web/writer processes, back up SQLite, run `npm run db:migrate`, then restart the matching release. An application rollback may retain this unused additive table.

Each validated festival attempt stores safe invocation settings and a running row before context, sources, or model work. Its final private version-2 report is saved with token counts, model cost, estimated search cost, duration, and accounting completeness in the same final update. `mode` is plain text and `event_id` is nullable without a foreign key; public reads do not expose runs. Input contains invocation settings, never retrieved Markdown, full Event context, API keys, or database/report paths. Dry-run keeps this history outside catalog rollback; transient creation IDs stay only in its report, while existing or committed Events populate nullable `event_id`.

Unexpected post-start errors finalize failed with bounded `workflow_failed`, preserving available accounting and committed outcomes. Finalization errors throw safe `run_persistence_failed` with runId/available report and leave the row running with null final fields; insert errors abort before work. Neither replays research nor undoes commits. Report operations’ operationKey links to catalog audit changes; enabled spans retain runId in sanitized metadata. Trace diagnostics cannot invalidate runs or evals. Multi-target checks continue, and both errors make CLI/eval acceptance fail. File-export errors cannot change final rows. Search costs carry `usage.searchCostBasis=estimate` and CLI text says “estimated search USD”; retry attempts do not prove billing, retrieval charges are unavailable, and an unknown full model cost loses any earlier subtotal while preserving known tokens. Workflow callers must use a migrated connection outside an enclosing transaction.

### Schema migration and experiment copies

Migration `0002_application_validation` transfers business checks to the application while preserving stored values, indexes, and structural protections. It rebuilds the six affected tables and removes the taxonomy facet-agreement and single-assignment triggers; earlier migrations remain unchanged. Apply it with the matching application release: stop web and writer processes, take a consistent backup, run `npm run db:migrate`, then restart. Restore the backup together with its matching application version if rollback is needed.

Shared vocabularies, price schemas, and pure validators live in `src/catalog/domain`. Operations validate incoming payloads, and the writer validates the merged final Event/Occurrence record before saving it in the transaction. For seed writes, `validateCatalogValues` checks defaults, explicit nulls, complete price blocks, and the applicable business rules; relation queries and inserts must run in the same transaction. When validating a taxonomy edit, supply its complete final record so both parent and children can be checked. Development/eval loaders and normal test helpers use this boundary, while fixtures still omit audit entries. Direct SQL is reserved for migrations and tests of database constraints or deliberately invalid stored data; it can now bypass business validation. Future write paths must use the shared validators.

SQLite continues to enforce keys, uniqueness, required columns, exclusive ownership, positive versions/capacity, paired and ordered dates, paired and bounded coordinates, the price-details JSON array, taxonomy self-parent/cycle protection, alias ownership, and immutable audit/aliases. Allowed vocabulary values, publication prerequisites, price semantics, date/coordinate status relationships, matching parent/child facets, and single event-type/format assignments are application responsibilities.

Ticket variants live in the JSON array `occurrences.price_details`, defaulting to `[]`; each named category may have its own availability. Migration `0003_remove-unused-source-storage` removes the unused source registry and edition-wide availability storage. Research uses saved external links and records inspected sources in private JSON reports. The migration preserves retained record values, IDs, versions, links, ticket variants, terms, operation receipts, remaining indexes, and immutable audit triggers; existing audit history is not rewritten. Use `npm run db:migrate`, whose connection-level migration helper handles SQLite table rebuilds and checks foreign keys and integrity afterwards.

Before experiments, take a consistent **full database backup**, verify `PRAGMA integrity_check`, and make a second full working copy from that backup. SQLite's backup API includes committed WAL data; copying only the main file is insufficient. For example, `better-sqlite3` provides `await source.backup(destination)` on a read-only source connection. Keep the original and backup untouched, migrate the working copy, and pass its path explicitly to catalog commands. Test `add` against a separate migrated database containing only curated taxonomy reference data and no events. The four acceptance targets are 2000trees, Boom Festival, Afro Nation Portugal, and Zurich Openair; they are command targets, not an exported subset.

Restore the backup with its matching application version for rollback before live changes. Later corrections should be audited; never remove audit entries as an automatic undo.

## Operations

- `docker compose up --build` is the production-like startup target. Use health checks, clean shutdown, explicit repeatable migrations, named volumes for required persistent data, and pinned production image/runtime versions.
- Back up live SQLite with a consistent SQLite backup operation and test restoration; copying only the live main file in WAL mode is insufficient.
- Respect source terms, robots guidance, rate limits, and privacy. Prefer supported feeds or APIs where practical.

## Reference project

`/Users/karo/projects/eventmap` is a read-only product reference, not a codebase to migrate wholesale. Useful concepts include shared map/list data, recurring identities, uncertain date/location fields, and public detail routes. Avoid its dated dependencies, split frontend/admin apps, array-order assumptions for upcoming editions, seed data in migrations, and committed database files. The selected complete-summary delivery needs measured payload/rendering performance and server-rendered list parity; do not copy an unbounded full-detail payload design. Do not modify the reference project unless the user asks.
