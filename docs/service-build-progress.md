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

## Next action

Before any public deployment, verify the account-side Mapbox restrictions, launch-host allowlist, monitoring, and budget alerts; keep that deployment gate unchecked until then.
