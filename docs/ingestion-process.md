---
type: Guide
title: Ingestion process
description: A short guide to local festival research and catalog updates.
status: stable
tags: [catalog, ingestion]
---

# Ingestion process

Ingestion finds or refreshes festival facts in the catalog. An owner starts each run locally; there is no scheduled refresh.

## Process at a glance

1. [Start a run](#start-a-run) — choose a festival or existing Event.
2. [Load catalog context](#load-catalog-context) — get current facts and saved links.
3. [Research and propose facts](#research-and-propose-facts) — read pages and suggest edition-specific changes.
   - [Find and read sources](#find-and-read-sources)
   - [Choose facts and editions](#choose-facts-and-editions)
   - [Preserve or replace values](#preserve-or-replace-values)
4. [Validate the proposal](#validate-the-proposal) — check structure and data rules.
5. [Preview or apply](#preview-or-apply) — inspect a dry run or save a fresh run.
6. [Save changes](#save-changes) — write each Event atomically and handle publication.
7. [Review the report](#review-the-report) — see changes, sources, and unresolved questions.

## Workflow steps

Each festival attempt runs one Mastra workflow with ten sequential steps:

| Step | Responsibility |
| --- | --- |
| `initialize-run` | Initialize native state after the shared start hook validates settings and creates the durable attempt. |
| `load-context` | Load saved Event facts, editions, links, and vocabulary. |
| `read-initial-source` | Create the shared source session and read its initial saved link when available. |
| `research-festival` | Run the research agent with the shared source session and budget. |
| `validate-research` | Check findings, targets, scope and country before editing. |
| `edit-research` | Run one tool-free editor to choose explicit actions. |
| `prepare-plan` | Validate the plan and convert typed actions into operations. |
| `apply-catalog-item` | Preview or atomically apply eligible operations; retain write failures for the report. |
| `build-report` | Combine research/editor output, actual changes, source history, questions, and known usage. |
| `finalize-run` | Persist the private report, return the bounded summary and release owned resources. |

CLI and local Studio execute this same graph in their own Node process. Native Mastra workflow state accumulates research context, source reads, model output, prepared changes, receipts and reports. Each step returns its own inspectable result; the server-owned attempt retains only budget, source session, connections, trace and terminal lifecycle. Credentials, prompts and live resources never enter workflow data. The final step persists once; terminal hooks recover from their final state. Mastra discards state updates from throwing steps, so an interrupted phase finalizes its available local data before propagating a safe error. Cleanup waits for active work. Finalization failure remains visible without repeating research or writes.

Workflow retries, snapshots and automatic restart are disabled. Per-step execution, resume, restart and time travel are unsupported. Start a fresh attempt against current catalog state after interruption.

## Start a run

```sh
npm run catalog -- add --name "Festival name"
npm run catalog -- refresh --event EVENT_ID
npm run catalog -- refresh --event EVENT_ID --event ANOTHER_EVENT_ID --scope current
```

`add` researches a festival by name and creates it only when new. A recognized existing Event returns `skipped` and its ID without updating facts, links, editions, or publication; use `refresh` to update it. `refresh` researches distinct Events independently. `--scope full` (default) rechecks every saved Edition, including history/farther future; `--scope current` rechecks one ongoing or nearest future Edition. Both recheck filled and empty Event fields and announcements, and may add one missing selected Edition. `check` is unsupported. An Event is the continuing festival; each separate edition is an Edition. The database must already exist and be migrated. See the [development guide](development.md#local-catalog-research) for setup and options, or its [Studio instructions](development.md#local-studio-ingestion) for the local workflow form.

## Load catalog context

`refresh` loads current facts and saved links for each selected Event. `add` loads catalog context to check whether the festival already exists.

## Research and propose facts

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. For `add`, the model discovers a source by festival name. The agent follows relevant links to answer open questions, searches when those links are not enough, and stops once it has useful facts.

When a direct page request returns HTTP 403 and `FIRECRAWL_KEY` is set in `.env`, ingestion tries Firecrawl once for that URL. Its raw HTML goes through the same Markdown extraction. The fallback consumes another page request and respects the remaining run time and response-size limit. Other HTTP errors do not trigger Firecrawl; without a key, 403 remains a blocked source.

### Choose facts and editions

The model decides which Event and edition each fact belongs to, then returns one result with `status`, `data`, `errors`, and `unresolved`. It can suggest dates, venues, prices, and links, but it cannot write to the catalog. It is instructed not to guess dates, prices, or an unannounced next edition; unknown facts can stay out of the proposal.

The result describes research completion, not announcement completeness. `success` means the relevant checks are complete; an announced year/date with no published venue or prices can succeed with omitted fields. After reasonable relevant checks, say “not found on inspected pages” unless explicit evidence supports “not yet announced”; describe those limits in source summaries without inventing or clearing facts.

`partial` requires useful data and a specific unfinished core check plus its cause in `unresolved`: an unrecovered relevant source failure, material conflict, or exhausted budget. Refresh completeness covers announcement/selection research and every assigned Event/Edition field. Missing values after completed checks are allowed; an unattempted assigned check requires partial. Add covers historical and announced Editions; duplicate add needs only identity. Missing optional size, coordinates, socials, or a completed schedule status does not force partial. A recovered page failure can coexist with success. `failed` uses null data when no usable result exists. For refresh, repeating input identity, saved facts, or URLs is not a useful finding: unavailable sources with no usable findings require failed, not an empty partial candidate. Source-verified unchanged facts still count; duplicate-add identity matching remains sufficient. Errors describe execution problems; questions describe what remains unknown.

Each finding has `{ value, reason }`; evidence stays in `sources[].information`. Unknown fields are omitted. Where allowed, `value:null` means a saved value is affirmatively disproven without a known replacement; it does not authorize a write. Existing Event names, aliases and slugs stay unchanged; an observed name mismatch remains informational.

`sizeEstimate` is approximate festival size in people, supported by participant evidence rather than venue occupancy or repeated daily admissions. Relevant historical attendance needs an explained basis; missing evidence preserves saved size.

### Agent contracts

```ts
type ResearchInput = {
  currentDate: string; // renamed; ISO timestamp fixed once per run
  // Other research inputs remain unchanged.
};
type Finding<T> = { value: T; reason: string };
// Research output shape stays {status, data, errors, unresolved}.
// Dates/coordinates/tickets remain grouped.
type ResearchClassification = Finding<TermId[]>; // Complete intended list.

type EditorInput = {
  research: ResearchResult; catalog: SavedEvent | null;
  vocabulary: Term[]; mode: "add" | "refresh";
  scope: "full" | "current" | null; currentDate: string;
};
type Action<T> =
  | { action: "accept" } // Copy the same-field research value/reason.
  | { action: "set"; value: T; reason: string }
  | { action: "clear" | "keep"; reason: string };
// clear is allowed only on clearable fields; set never accepts null.
type EditorPlan = {
  event: { fields: EventActions; reason?: string } | null;
  editions: {
    editionKey: string; fields: EditionActions; reason?: string
  }[]; // reason is required for new Event/Edition creation.
  unresolved: ResearchQuestion[];
};
// Actions use named fields. Omission preserves values.
// A considered Edition can use fields:{}; an omitted Edition is not processed.
```

One editor serves add and refresh. It receives supplied research and saved state, has no tools, and makes at most one generation under the shared deadline/configuration without retries or correction loops. Failed/invalid research, country rejection and duplicate add skip it. Add may decline creation with `event:null`, no Editions and an unresolved reason; refresh uses the Event fixed by validated input; add uses research eventName. Editor returns no Event IDs/names or nested target/create objects. Edition keys resolve against saved state: existing keys update, new keys require matching research and a creation reason. Invalid editing writes nothing and preserves research output/status.

### Choose the refresh target

The model receives scope, frozen `currentDate`, all saved Edition keys/dates/time zones and research rules; supported fields come from the output schema and countries from saved Editions. It chooses the ongoing Edition first, otherwise the nearest supported future Edition; ambiguity stays in existing unresolved questions. Full also rechecks every saved Edition. Selection is reflected in the final proposals and existing explanations; there is no resolver tool or intermediate selection call. Static context describes the task, not completed research.

Ongoing wins through the inclusive local final day; otherwise select the nearest supported future start. Ties, overlaps, uncertain ordering/matching remain unresolved. A sole future year-only announcement can qualify. Keys remain stable across corrected dates/years; two weekends in one year are separate identities. Saved statuses do not exclude candidates without inspected evidence. Cancellation/postponement without replacement dates is excluded; supported replacements retain the matched key.

When a saved site belongs to a namesake, the agent must find and inspect the correct festival website. Search snippets/name matches are insufficient. Successful recovery proposes a replacement and continues; exhausted recovery returns failed/null data and zero operations. No separate identity field is added.

### Preserve or replace values

The editor chooses accept/set/clear/keep for named fields. Set supplies a non-null typed value; clear explicitly removes a clearable value; keep and omission preserve it. Dates and coordinates are complete grouped replacements; clear resets both components and their state/precision to unknown. Saved time zones remain unchanged. Classification set supplies the full intended term-ID list; tickets set supplies all intended variants/basePrice, preserving unchallenged saved entries. Research classification is a complete value/reason finding that retains unchallenged saved terms. Accept copies that list; set supplies a corrected complete list. One typed preparation pass resolves acceptance and checks same-field support before generating writer operations.

Ticket variants carry their own availability and qualifications. Concessions, day tickets and upgrades cannot establish full-programme base prices. Incomplete findings or inaccessible pages do not justify deletion. The editor may preserve uncertain blocks and report questions while applying independently supported changes.

All model amounts use major units and validated uppercase three-letter currency codes. Amount and currency must appear together. The adapter converts base-price `minAmount/maxAmount` to integer minor units using currency precision: EUR 100.50 → 10050, JPY 1000 → 1000, KWD 1.234 → 1234. Excess precision and unsafe integers fail without rounding. Variant amounts remain in major units. Exact/from bounds match; range maximum exceeds minimum. Free full-programme admission requires neither currency nor amounts; null base price means unknown.

Links have one Event website, optional instagram/facebook/youtube/tiktok/x/other social slots, and one ticket URL per edition. `x` accepts X or Twitter account URLs. Research supplies association evidence; the editor chooses set/clear/keep per owner/kind slot. Set replaces that slot, clear removes it, and keep/omission preserves it; other owners and kinds are untouched. Inaccessible destinations alone never authorize clearing.

`data.sources` describes useful inspected pages once, with URL and information found, including edition context and partial-page limits. It has no direct fact-to-page associations. Source summaries are separate from public links and the host's actual retrieval history.

## Validate the proposal

The system checks shape and target IDs. Current accepts at most one returned Edition; full accepts at most one new key and a union of at most 20 saved/returned targets. Temporal choice and completeness remain model decisions assessed by evals. Conflicting saved countries fail before source/model calls (`country_baseline_conflict`). A known country from any saved Edition constrains every returned country, including new/unchanged facts and explicit null clearing; conflicts fail the entire Event (`country_conflict`) before editing; final editor country actions are checked again before operations. Correcting a bad baseline requires a separate authorized correction. The apply transaction rechecks every saved Edition ID/country; concurrent baseline changes abort all writes. The writer checks data rules, versions, and publication requirements. It can reject an invalid date, but it cannot tell whether a valid date is factually correct.

Accepted first-version limit: new Event slugs come from their names. If a distinct Event has the same generated slug as an existing Event or reserved alias, its item write fails and the run reports `write_failed`; the proposed slug remains visible in its operations. The run does not merge the two Events or choose a fallback slug automatically.

## Preview or apply

By default, the writer previews changes and rolls them back. The private run row and preview report persist, while catalog facts, versions, audits, and receipts roll back. A previewed new Event ID exists only in the report; the row’s `event_id` stays null. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts.

## Review the report

Version 5 reports show `researchStatus` separately from catalog `outcome`, explained old/new changes, staged `errors`, `unresolved` questions, `sourceSummaries`, and technical retrieval history in `sources`. Refresh reports contain top-level `scope` and `currentDate`, `limits` and `workload` (saved and returned Edition counts). Research and editor use an explicit catalog-fact projection without database versions, timestamps or Edition/link storage IDs; the host keeps the full snapshot. Research uses that context and prompt rules, without a separate refresh object, copied country baseline or field registry. Reports do not duplicate that catalog snapshot or the prompt rules. There is no selection/resolution outcome, separate verification array, confirmed/changed comparison or returned-fact counter. Raw findings remain in `modelResponse`; the raw `editorResponse` retains its structured plan once, including invalid output. `editorStatus` is success/failed/not_run and `editorPromptVersion` identifies its instructions. Returned unchanged facts remain in the raw `modelResponse`; omitted facts preserve saved values without invented completion. The existing writer retains actual changed values and reasons in audit; no-op checks create no audit. Old report versions are unsupported, with no legacy gaps fallback. CLI and Studio share initialization after Mastra creates its run; every started attempt has a private `ingestion_runs` row and `runId`. The final report is saved automatically; `--report PATH` exports the same report, including the final raw response before normalization.

With `--apply`, success and partial results use the atomic writer. Failed research or editing writes nothing. Partial alone exits zero, as does a skipped duplicate add. Research, editor or write failure exits nonzero. A write failure rolls back the entire Event item while retaining research status, raw output, source summaries, and any name mismatch. A partial result with no changes remains visibly partial/unchanged. Ordinary research retries only explicit OpenRouter `provider_unavailable` errors, at most three times with 10-second, 30-second, and 90-second exponential backoff within the same run deadline. A bounded Mastra iteration allowance preserves ordinary research capacity during those unavailable retries; observed request counts still include them. Other model errors are not retried; completed research steps and tool results are retained.

Research defaults to 15 ordinary model steps, with tools disabled on the last step to reserve a final response. `--agent-steps` or `CATALOG_MAX_AGENT_STEPS` changes that allowance. The application does not count or cap total input-context characters; current configuration and reports omit `modelInputChars`. Source-size/output limits, search safeguards and deadlines still apply. Linked pages have no traversal-depth limit. Provider context-window rejection is reported as a model failure.

Reports and explanations are private CLI output/files, not public website data or a separate hosted logging service. Public details expose only ticket category labels and availability; amount/terms/variant URLs and research metadata remain private. Unknown category availability has no badge. Discovery and details never derive a global sold-out/closed label from variants.

Token counts retain usage reported by completed model steps even if a later step fails or is interrupted. JSON reports set `usage.complete` to `false` when some token usage or execution accounting is unknown; the CLI marks those token counts as `partial`. `usage.modelCostUsd` sums available provider-reported model costs from research, editor and source discovery, retaining them after failures and when other calls omit costs or token counts. This sum may be partial even when `usage.complete` is `true`; the CLI labels it “known model USD”. It is `null` (`unavailable` in the CLI) only when no model cost was reported. A reported zero cost is preserved as zero. Search cost is a formula-based estimate, marked `usage.searchCostBasis=estimate` and labeled “estimated search USD”; retry attempts may contribute without proof they were billed. HTTP/Firecrawl supply no billed retrieval charges. Neither completeness nor known model cost proves exact all-service spending.

Lifecycle status (`running`, `completed`, `failed`) is separate from research status and catalog outcome. Partial/no-op and skipped attempts complete; research, editor, writer, or unexpected workflow failures finalize failed. A late `workflow_failed` preserves committed outcomes and known accounting, but exits nonzero. A start-write failure aborts before work; a finalization failure reports `run_persistence_failed` with runId/available result and exits nonzero without undoing commits or replaying research. Other refresh targets continue. Optional report-file failure does not change the finalized row.

Abrupt interruption may leave a running row with null report, finish time, and final statistics, even after a catalog commit. That means completion is unknown. A rerun researches current state with a new runId and does not alter the earlier row. Event association is nullable and survives catalog deletion; use report operations’ `operationKey` to correlate saved audit changes.

## Inspect local agent traces

Set `CATALOG_TRACING=true` to save one per-Event apply-run trace, including the initial source read and the agent's automatic model/tool spans. Tracing is off by default. Dry-run and fixture-injected candidates create no spans, even with the flag enabled; they create a store only when logging is independently enabled; their reports and durable run records still work. The shared log/trace file is `data/mastra-observability.duckdb`; `CATALOG_OBSERVABILITY_DATABASE_PATH` selects another local path, separate from catalog files/sidecars and the optional report. The old trace-path setting no longer selects recording or inspection; historical SQLite files remain untouched. DuckDB and the catalog remain separate. Close Studio before research, then reopen Studio after research exits.

The root's name and display name identify the canonical Event, mode, context edition and terminal result. For example, `Festival · ctx:2026 · created:2023 · refresh · partial` distinguishes saved context from the committed historical edition. Details retain up to ten entries per edition role with omitted counts. Keys and years are separate: `2026 [key:summer]`, corrected `2027 [key:2026]`, and unknown `? [key:2026]`. Years are never guessed from keys or dates. Unsaved discoveries stay in the private report.

Read spans show attempted/final URLs, retrieval outcome, technical reason, method, completeness, caching, and separate source/tool truncation observations; unobserved truncation is unknown. A normally completed tool can still say `failed:request_failed`. Search spans show the existing query, up to five candidate URLs and returned/retained/omitted counts, distinguishing successful empty searches, budget-reserved `not_run`, and failures. URLs keep their path, query and fragment, including token-like public values. Only their length is limited; tracing does not rewrite requests or detect secrets in public source text.

The root copies `researchStatus`, `editorStatus` and catalog `outcome` from the report, alongside structural/target validation of research, separate `editorPlanValidation` and `semanticValidation=not_run`, write disposition and a single count of confirmed changed operations. `committed`, `unchanged`, `rolled_back`, `not_attempted` and `unknown` describe writing separately from research completeness; unknown disposition has a null count. A report failure after commit preserves confirmed changes. A rejected editor plan reports failed validation and `not_attempted` writes while retaining the research checks. Native technical error status does not claim factual verification. Reports and durable run records retain their existing contracts, with no added trace reference.

Host-owned trace input/output/metadata contains explicit selected fields: Event/edition labels, source URL/status/method, retrieval and validation outcomes, write disposition and known committed counts. Call sites shorten selected trace URLs to 512 UTF-8 bytes, queries to 1,200 bytes and candidate URLs to five, retaining returned/retained/omitted counts where useful. There is no generic host projection allowlist or whole-record 8/16 KiB cap. Automatic SDK-generated spans may carry prompts, messages or tool payloads; their content is suppressed at source where supported or removed by the smallest necessary fail-closed export exclusion. The private v5 report retains final model output.

The workflow ends the root after report construction, settles open children, then awaits flush and shutdown attempts. DuckDB uses the supported `event-sourced` exporter strategy; final name fields and safe projections are retained after reload, while interrupted/background persistence remains best effort. Persistence is best effort: overlapping background writes/flush/shutdown and forced termination may lose traces. Custom buffers, queues and exporter patches remain deferred. Tracing does not change reports, budgets, provider retries, catalog writes, durable runs or exit status. The durable runId remains available in trace metadata and correlates with stored application logs.

If the SDK content exclusion fails, the affected span is dropped with a fixed content-free diagnostic. Application logs use a narrow origin marker so SDK-generated logs are not automatically forwarded. Observability failure diagnostics are fixed and do not include raw payloads.

Set `CATALOG_LOGGING=true` for selected application events at `CATALOG_LOG_LEVEL=info` (default), independently of tracing. Debug adds cache detail; warn/error restrict both sinks. Mastra PinoLogger uses ordinary level methods and scoped `child({...})` context. Stored events share the durable runId and available real trace/span IDs. Producers pass plain selected objects; source events retain character count and response status/URL without Markdown or full responses. Commentary and returned reasoning are separate completed-step events, each shortened explicitly with `shrinkText(text)` to at most 4,000 Unicode code points. Producers can include original/retained counts and a shortening flag. There is no generic field allowlist, recursive payload processing or whole-record 8 KiB cap.

An explicit editor rejection logs a rejected plan and uses the final trace label `editor-rejected`, retaining successful generation and failed plan validation. Preparation events include selected identity, edition keys/actual years, proposed field names/counts, validation codes/paths and model-reported unresolved question previews. Write events identify dry-run versus apply, affected IDs/field names and disposition. The “Research finished” message follows successful durable finalization; “Required run finalization failed” includes `errorCode: run_persistence_failed` and preserves the original error and any already committed changes. The final report retains complete values and diffs. Logging never adds model/provider requests or changes budgets/retries. Native Pino JSON on stderr and Studio records carry the selected fields. Completed-step text can follow tool outcomes, and unfinished-step text may be absent. SDK/config credentials are never selected as log arguments. No arbitrary credential redaction is promised for selected model commentary or reasoning; source diagnostic fields are not scanned for token-like public values. Completed commentary may include candidate text, while full provider response envelopes remain excluded.

Run `npm run catalog:studio` to inspect saved logs and traces after research exits. Studio inspection needs no model credentials or catalog connection. Its registered `catalog-ingestion` workflow can also execute research against an existing migrated catalog with OpenRouter configuration; preview is the default. See the [development guide](development.md#local-trace-inspection) for commands and cleanup.

The [source workflow specification](../openspec/specs/catalog/source-workflow/spec.md) defines the detailed behavior.

Editor returns either `status:ready` with a plan or `status:rejected` with a reason only. The provider schema reuses the required ready-field contracts: `editions` and `unresolved` are always arrays, with `[]` for empty lists. Rejected transport output uses `event:null` and empty arrays, which the adapter removes before local validation. It owns the final festival-identity decision from research and saved context. Rejection stops all writes/publication and reports a failed item while editor generation remains successful. Research uses saved location for recovery and passes identity contradictions as evidence/questions. Editorial set/clear actions require a structured finding for the same field and Edition; source summaries explain findings but cannot create extra facts. Free ticket variants may store `amount: 0` without currency; positive amounts still require currency.

### Accepting research values

Editor can use `accept` to take a non-null same-field research value without repeating it, or `set` with a complete value/reason for a supported editorial transformation. Preparation resolves acceptance before writer operations and inherits the finding explanation; invalid/missing findings reject the whole plan. URL edits preserve meaningful components; text rewrites and list deduplication must preserve supported facts. Complete lists/blocks replace existing values without merging. Classification acceptance copies the complete research list, including unchallenged saved terms; editor checks preservation before accepting. Editions remain keyed decisions: omitted Editions are untouched; a new addressed key requires matching research and a creation reason.
