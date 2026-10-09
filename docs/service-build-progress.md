---
type: Progress
title: Service build progress
description: Dated record of fixture-backed build completion and remaining deployment work.
status: stable
tags: [progress, development]
---

# Service build progress

Current section: 5 — Map and responsive discovery  
Fix rounds: 0 of 2  
Status: development-fixture build complete and committed

## Acceptance checklist

- [x] Mapbox GL JS renders via a small client adapter with public token, style, visible attribution, clustered markers, and approximate-location labels; missing token/WebGL leaves the list usable.
- [x] Desktop displays map and list together; narrow screens provide a keyboard-usable Map/List switch without losing filters or selected edition.
- [x] Both views consume the same filtered summaries. Unlocated editions remain in the list, with accurate total, mapped, and unlocated counts independent of viewport.
- [x] Marker/list selection loads full public Occurrence details on demand through a publication-gated endpoint; errors can retry, stale responses cannot replace newer selections, and ordinary direct links remain usable.
- [x] Map movement does not refetch or filter results. Direct links, mobile and keyboard flows, selection persistence, clustering, and map-unavailable fallback received focused verification.

## Decisions

- Sections 1–4 committed as `1863314`, `b626c9c`, `2ebad02`, and `955ed9f`; section 5 is the current commit. All passed independent review for the development-fixture build.
- The public development build uses fictional fixtures. Local source research is recorded below; imports, public-content/SEO completion, and deployment remain deferred.
- Optional findings remain parked: section 1 documentation cleanup; section 2 taxonomy immutability, UTC normalization, and partial-fixture recovery.
- Section 3 optional notes remain parked: stricter origin validation and extra route/render fixtures.
- Section 4 optional findings remain parked: descriptive chips, opener-specific focus restoration, and automated browser regression coverage.
- Mapbox token restrictions and usage monitoring are a required pre-deployment gate. Production deployment is deferred; document the exact gate now without creating or exposing an account token.
- Section 5 code review and independent live Mapbox review passed with no blocking findings. Lint, format, type check, 27 tests, build, HTTP, fallback, live tiles/attribution/clustering/selection, and browser flows pass. Details: `/tmp/eventroam-section5-review.md` and `/tmp/eventroam-section5-live-review.md`.
- The ignored `.env` contains a working local public token. Account-side restrictions, launch-host allowlist, usage monitoring, and budget alerts remain unverified and required before public deployment.

## Compact discovery refresh (2026-10-02)

- Implemented the approved compact proposal: slim search header, list/map workspace, floating filter pickers, denser edition rows, and contextual details. Mobile keeps results and Map/List switching accessible without a large heading block.
- Map points use smaller visual circles with larger invisible hit targets, compact clusters, informative previews, and fit/zoom controls. Initial fitting waits for a visible map and handles locations across the date line.
- Verified filtering, cancellation and focus restoration, history, empty search/reset, invalid pending filters, mobile error recovery, detail selection/Escape, direct edition links, and live Mapbox selection at desktop and 320px/390px mobile widths. Type checking, lint, formatting, 41 tests, and the production build pass.
- No catalog/API changes, dependencies, migrations, or production deployment were required.
- Astra review regressions corrected: discovery row styles no longer affect public event history, mobile map controls share a row below wrapping filter chips, and name-search validation has visible accessible feedback outside pickers. Browser checks reproduced and verified all three fixes, including search recovery and preservation of applied results.

## Local source-backed catalog workflow (2026-10-03)

- Added the local `add`, `refresh`, and `check` commands, with dry-run by default, an OpenRouter research agent hosted by a local research function, bounded source tools, and private change reports. Facebook/Instagram retrieval remains unsupported.
- Extended the shared writer with atomic item operations, structural publication gates, complete ticket-price replacement, and `closed` sales. Ticket variants and audit history stay out of public responses. The built-in Browser confirmed “Ticket sales closed” on a fictional edition.
- Created a consistent full backup of the local 769-event dataset before experiments. Migrations and research use separate complete working databases; the original and backup are retained untouched. An empty event catalog also needs curated classification reference terms before it can publish additions.
- Fixed-response tests cover publication, identity reuse, independent updates, prices, availability, budgets, and reruns. Four opt-in Chromium fixtures checked rendering and blocked private network targets.
- Added five fixed-source Mastra evals with captured pages, temporary catalogs, a frozen domain date, and required/forbidden change assertions. They measure model behavior without modifying the original catalog. See the [development guide](development.md#catalog-evals) for the current harness.

## Direct model proposals (2026-10-04)

- The owner chose one structured model proposal per run, accepted as factual without host citation, authority, conflict, or supersession checks. The adapter keeps schema and requested-target checks; the writer keeps structural publication rules, versions, audit attribution, and atomic item transactions.
- Removed snapshot preparation and validation feedback rounds. Dry-run now executes and rolls back the writer transaction on a writable catalog connection. Catalog audit entries retain attribution and old/new values; fixed-source evals still check required and forbidden catalog facts. Previous live acceptance results describe the earlier workflow and do not establish accuracy for this revision. Task 6.3 remains open.

## HTTP-only source retrieval (2026-10-04)

- Removed the Chromium fallback from local Ingestion. Sparse script-driven HTML now keeps its available HTTP Markdown and reports a partial `javascript_required` result. Public-address, redirect, response-size, and time limits remain in the HTTP reader.
- Removed render budgets and the direct runtime Playwright dependency. Website end-to-end tests still use Playwright Test. Fixed-source eval captures were retained, including Sziget's historical `renders_budget_exhausted` outcome; future model scores need a new baseline because the remaining-budget tool payload changed.

## Source workflow validation status

- The 2026-10-03 live trials used database copies and an earlier workflow. For 2000trees, the run added the expected 7–10 July 2027 dates without changing its 8–11 July 2026 dates; a repeat reused the Event and 2027 Occurrence without duplicates. No empty-catalog `add` produced an eligible published edition. Boom Festival yielded a supported-link preview; inaccessible or ambiguous Afro Nation Portugal and Zurich Openair sources were skipped without guessed changes. The original database and backup were left untouched.
- Later fixed-source experiments exposed edition leakage, sibling-festival and ticket-link confusion, unsupported location/classification claims, and incomplete date groups. An exact excerpt from an organizer page did not by itself prove that a claim applied to the proposed fact or edition. Prompt and model scores varied between runs; passing annotated assertions did not mean all useful facts were collected or that publication was eligible.
- GPT-6 Luna was selected as the default after a same-fixture prompt-v10 comparison passed 5/5 annotated cases, while DeepSeek V4.1 Flash and GLM 5.3 Flash each passed 0/5 in single runs. Subsequent Luna runs on revised fixtures passed 3/5 and 4/5. These results are historical: the model-direct workflow, source retrieval, and fixture expectations changed afterward, so they are not a current accuracy baseline.
- [Live acceptance task 6.3](../openspec/changes/archive/2026-10-05-source-backed-catalog-workflow/tasks.md) was marked complete after the 2026-10-05 live sample and a published `add`. The sample still showed semantic errors for Zurich Openair and Sziget Festival; the task checkbox does not establish an error-free accuracy result.

## Simplified research output (2026-10-08)

- Implemented `simplify-research-output`: strict status/data/errors/questions, named explained facts, grouped dates/coordinates, complete ticket blocks in major currency units, bounded official link slots including X/Twitter, and shared page summaries. Add is create-only; matched existing Events skip without operations. Existing names remain unchanged with private mismatch metadata.
- Reports and evals use version 2. Partial research can apply valid facts; failed research has no operations. Writer failures roll back the item while preserving research status, raw response, summaries, and mismatch metadata. Reasons attach to actual writer changes; no new classifier, semantic verifier, database migration, or compatibility layer was added.
- Public details display availability beside ticket category labels. Public payloads and list/map/detail views omit aggregate availability. The built-in Browser verified direct details, list, and selected preview against a temporary fictional database with mixed category states; private variant fields were absent. Live Mapbox markers were not exercised in this check (no token); GeoJSON regression tests cover removal of their aggregate flag.
- Type-check, lint, formatting, all 238 tests, strict OpenSpec validation, and documentation checks passed. Main specs are synchronized; the change was subsequently archived on 2026-10-09 after follow-up verification.
- Captured-page evals with `openai/gpt-6-luna`, medium reasoning, prompt `model-direct-v4`, and fixture schema 2 passed all 5 annotated cases in the final run. Tomorrowland, Wacken, and Glastonbury returned partial; Roskilde and Sziget returned success. Manual inspection checked contextual source summaries, grouped dates, reasons, ticket units/category states, and edition-owned links. Roskilde's DKK 2650 base pass became 265000 stored minor units; Sziget's EUR 349 base pass became 34900.
- Iteration exposed model variability: an intermediate Roskilde run omitted its announced next edition; the prompt now explicitly includes newly announced editions in refresh/check and distinguishes optional wire nulls from intentional clearing. The final Tomorrowland result was unnecessarily partial because the model wanted a completed schedule status, which this contract intentionally does not require. Passing assertions is not a guarantee of complete or error-free model interpretation. Private local reports: `/tmp/eventroam-simplify-research-output-eval.json`, `/tmp/eventroam-simplify-research-output-roskilde-v4.json`, and `/tmp/eventroam-simplify-research-output-final-eval.json`; these temporary files are not repository artifacts.

## Model-failure diagnostics follow-up (2026-10-08)

- Extended the existing `simplify-research-output` change with safe host-only `diagnostic` fields in text/JSON/eval reports: recognized error/cause types, HTTP status, provider/network code, and SDK retryability when available. Raw messages, bodies, headers, and secrets stay excluded; research limits retain precedence. No retries were enabled.
- Provider integration exposed Mastra returning an empty `retry` termination for HTTP 429/503 without throwing. Such results now become `model_failed` using request-local HTTP status, rather than `invalid_candidate`. Tests cover HTTP 400/429/503 with exactly one request, nested causes and limits, safe metadata, and CLI rendering. The full suite passed 243 tests before the final small refactor; the final focused suite passed 23 tests. Type-check, lint, formatting, OpenSpec, and documentation checks passed.
- The full Flex eval passed 5/5 assertions in 147.286 seconds; reported model cost was USD 0.0046168475. Roskilde and Sziget returned success; Tomorrowland, Wacken, and Glastonbury returned partial. No model failures recurred, so diagnostic metadata was verified with deterministic provider fixtures rather than a live failure. Wacken's official `/en/` URL is now accepted alongside `/de/` and the root.
- Manual review found remaining quality limitations despite passing assertions: Wacken omitted tickets after a blocked ticket-store link, although the fixture also contains an accessible ticket overview; Tomorrowland unnecessarily requested a completed schedule status; Sziget omitted a linked Instagram account because fetching it failed. Roskilde's six ticket categories and Sziget's three ticket categories were retained with expected prices. No stored facts were cleared. The private temporary report is `/tmp/eventroam-model-diagnostics-eval-20261008.json` and is not a repository artifact.

## Research completion clarification (2026-10-08)

- Prompt `model-direct-v5` and provider-visible status/question descriptions define success by completed research rather than complete announcements. Partial requires a specific unfinished core check and cause; optional unknowns, incomplete announcements, and the absence of a completed schedule status do not force partial. Missing facts remain omitted, and source summaries distinguish “not found” from explicitly “not announced”. JSON shape, host validation, and retry behavior are unchanged.
- Synced the existing change and owning spec. The 21 focused contract/agent/provider tests include verification that descriptions reach the provider schema; type-check, lint, formatting, OpenSpec, and docs checks passed. No live model eval was run for this prompt revision, so semantic improvement is not yet measured.

## Failed-research eval (2026-10-08)

- Added `afro-nation-portugal-blocked` to the default suite using HTTP 403 metadata from the ten-festival live dry run, with explicitly synthetic empty page/search replay. Its date is 2026-10-08; the original five cases retain their shared date. Reports include the effective case date and provenance.
- Expected source failure passes only with a model-declared failed response, null data, source diagnostics tied to unavailable reads, and no operations, changes, receipts, references, or useful-source summaries. Empty partial/success, provider, limit, validation, and writer failures fail scoring. Ordinary factual cases retain nonempty required/forbidden assertions.
- All 25 eval harness/scorer tests, type-check, targeted lint, and formatting passed. The saved live Afro Nation partial result is rejected. The new Luna/Flex model eval also reproduced that error: partial with empty findings, unchanged catalog, and zero scores in 16.491 seconds (reported model cost USD 0.000429275). This is a detected model-quality failure, not a passing eval. Prompt version and content remain unchanged. Private temporary report: `/tmp/eventroam-afro-blocked-eval-20261008.json`.

## Empty-research prompt clarification (2026-10-08)

- Clarified the prompt and status description: repeating supplied identity, facts, or URLs is not a usable refresh/check finding. With no usable source findings, return failed with null data and source diagnostics. Source-verified unchanged facts and duplicate-add identity matching remain valid. Prompt v5, eval assertions, host validation, and retries are unchanged.
- The blocked-source case passed three independent Luna/Flex repetitions, each returning failed with null data and source errors, with no operations or changes. Private report: `/tmp/eventroam-failed-prompt-repeat-20261008.json`.
- The full six-case Luna/Flex suite passed 6/6 in 123.656 seconds (reported model cost USD 0.007342325), including a fourth correct blocked-source failure. Wacken/Sziget returned success; Tomorrowland/Roskilde/Glastonbury returned partial with specific blocked core checks. No model or write failures occurred. Private report: `/tmp/eventroam-failed-prompt-full-20261008.json`.
- Type-check, targeted lint/formatting, 10 agent/contract tests, 23 eval tests, documentation checks, and strict OpenSpec validation passed.

## Review regression fixes (2026-10-09)

- Malformed source-summary and X/Twitter URLs now fail schema validation without throwing. Workflow regressions preserve the raw response and retrieval history, report invalid_candidate, and verify no writes; normalized valid-source duplicate checks remain intact.
- Returned model usage is collected before classifying an SDK retry termination as model_failed. A completed tool step followed by HTTP 503 retains 10 input tokens, 20 output tokens, and USD 0.125, with two requests and no retry. The unused modelFailed field was removed; failure codes remain authoritative.
- Tomorrowland's forbidden availability assertion now checks sold_out within price_details variants. A regression verifies that a Belgium category carrying Thailand's sold-out status fails correctness while required assertions remain satisfied. Prompt v5 and equivalent-link officiality behavior are unchanged.
- All 254 tests across 31 files, type-check, lint, and formatting passed. The additional live Tomorrowland eval could not assess model quality: its first request failed with model_failed (AI_APICallError, HTTP 200, retryable false), before a final candidate or usage was available. Private report: `/tmp/eventroam-review-r3-tomorrowland-20261009.json`. This is not a passing live eval; failure handling and the migrated assertion are covered by deterministic regressions.

## Minimal research tracing (2026-10-09)

- Added opt-in research-agent/model/tool tracing with pinned Mastra observability and LibSQL, a separate local SQLite trace file, and storage-only Studio inspection on localhost. Tracing is off by default; injected candidates, host stages, catalog writes, and eval workflow/scorers are outside the integration. Reports, usage callbacks, budgets, and provider retry policy retain their existing contracts.
- Persisted spans and JSON exports exclude prompts, pages, model responses, tool payloads, credentials, raw errors/stacks, and forwarded agent/SDK logs. The built-in Browser verified saved trace hierarchy and metadata after the research process exited. Application diagnostics use bounded fixed codes; the owner accepts additional technical errors/stacks from LibSQL's private local stderr logger.
- Cleanup explicitly attempts flush before shutdown. The owner accepts best-effort persistence and defers the reproduced SDK background-flush race: in-flight writes can overlap another flush or storage closure, losing spans or terminal updates. Custom buffering, write serialization, and dependency patches are deferred; the [design risks](../openspec/changes/archive/2026-10-09-minimal-research-tracing/design.md#risks--trade-offs) record the conditions and revisit criteria. Generation completion time is captured before cleanup so slow cleanup cannot turn an earlier HTTP failure into `limit_reached`.
- The pre-review implementation passed 320 tests across 34 files. After the cleanup-classification fix, all 42 focused tracing/provider/agent tests, type-check, lint, documentation checks, and strict OpenSpec validation passed. The separate balanced code review reproduced the logger, background-flush, database-override, and deadline-classification findings; the owner accepted the first three as scope exceptions and the deadline issue was fixed. Main source-workflow requirements are synchronized with these decisions.
- The six captured-page eval cases passed 6/6 with `openai/gpt-6-luna`, medium reasoning, prompt `model-direct-v5`, and the standard service tier, in 52.755 seconds with reported cost USD 0.01311142. Tracing remained enabled. Flex runs with tracing on and off both encountered provider failures; the comparison does not establish their root cause. Passing model assertions does not verify every trace is complete. Default provider tier configuration is unchanged. Private local reports are under ignored `data/catalog-evals/`.

## Next action

Before any public deployment, verify the account-side Mapbox restrictions, launch-host allowlist, monitoring, and budget alerts; keep that deployment gate unchecked until then.
