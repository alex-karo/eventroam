---
type: Guide
title: Ingestion process
description: A short guide to local festival research and catalog updates.
status: stable
tags: [catalog, ingestion]
---

# Ingestion process

The owner can use the local CLI, loopback Studio, or hosted Studio with the same preview and apply rules. Hosted Studio requires external ingress authentication and one owner for its DuckDB file. See [application containers](development.md#application-containers) for commands and settings.

Ingestion finds or refreshes festival facts in the catalog. An owner starts each run through the CLI or Studio; there is no scheduled refresh.

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

Each festival attempt runs one Mastra workflow with eleven sequential steps:

| Step                  | Responsibility                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `initialize-run`      | Initialize native state after the shared start hook validates settings and creates the durable attempt. |
| `load-context`        | Load saved Event facts, editions, links, and vocabulary.                                                |
| `read-initial-source` | Create the shared source session and read its initial saved link when available.                        |
| `research-festival`   | Run the research agent with the shared source session and budget.                                       |
| `validate-research`   | Check findings, targets, scope and country before editing.                                              |
| `edit-research`       | Run one tool-free editor to choose explicit actions.                                                    |
| `validate-editor-plan` | Validate editor actions and targets without preparing writes.                                            |
| `resolve-location` | Prepare shared geocoding, run Location, and prepare the combined item plan. |
| `apply-catalog-item`  | Preview or atomically apply eligible operations; retain write failures for the report.                  |
| `build-report`        | Combine three agent outputs, actual changes, source history, questions, and budget counters.             |
| `finalize-run`        | Persist the private report, return the bounded summary and release owned resources.                     |

CLI and Studio execute this same graph in their own Node process. Native Mastra workflow state accumulates research context, source-read metadata, model output, prepared changes, receipts and reports. Page Markdown stays in the in-memory source session for research and is excluded from workflow state and step outputs. Each step returns its own inspectable result; the server-owned attempt retains only budget, source session, connections, trace and terminal lifecycle. The application does not separately attach credentials, prompts or live resources to workflow data. Retained model responses can repeat prompt or public source text without filtering. The final step persists once; terminal hooks recover from their final state. Mastra discards state updates from throwing steps, so an interrupted phase finalizes its available local data before propagating a safe error. Cleanup waits for active work. Finalization failure remains visible without repeating research or writes.

Workflow retries, snapshots and automatic restart are disabled. Per-step execution, resume, restart and time travel are unsupported. Start a fresh attempt against current catalog state after interruption.

## Start a run

```sh
npm run catalog -- add --name "Festival name"
npm run catalog -- refresh --event EVENT_ID
npm run catalog -- refresh --event EVENT_ID --event ANOTHER_EVENT_ID --scope current
```

`add` researches a festival by name and creates it only when new. A recognized existing Event returns `skipped` and its ID without changes; use `refresh` to update it. `refresh` researches distinct Events independently. Add and `--scope full` (default) check Event summary/shared links, the latest completed Edition, and the ongoing or nearest announced future Edition. Both Edition slots may create new records. `--scope current` checks only the ongoing or nearest announced future Edition. Other saved history and farther future Editions provide context for matching, country checks, and classification reuse. Current assumes a prior full run established Event identity/shared links. It omits Event findings and focuses on Edition dates, schedule status, location, tickets, and classification. Size, precise coordinates, and detailed address are optional checks. `check` is unsupported. The database must already exist and be migrated. See the [development guide](development.md#local-catalog-research) for setup and options, or its [Studio instructions](development.md#local-studio-ingestion) for the workflow form.

## Load catalog context

`refresh` loads current facts and saved links for each selected Event. `add` loads catalog context to check whether the festival already exists. Research receives shared evidence/output rules plus only its add, full or current assignment; omitted refresh scope selects full. The full prompt does not include current-only stop/completion exceptions.

## Research and propose facts

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. The agent uses `readPage` for relevant known links and prior results first. `searchWeb` is permitted for an unknown, inaccessible, or wrong official source; a material identity/date conflict; or an essential identification, date, or publication-required gap in an already evidenced Edition. Permission does not require a search. An empty Edition slot or absent announcement alone does not justify search. A recurring Event description alone does not establish a specific past Edition for a search. Missing optional prices or size alone does not justify search. Explicit evidence that no next Edition is announced can complete the check. Stop when the relevant question is resolved. Current stops on an identity contradiction and requests full; it does not discover a replacement website. Search highlights are leads. Inspect destination pages before using their facts. Search and page reads share the run limits. OpenRouter's Exa plugin and default search mode remain in use.

When a direct page request returns HTTP 403 and `FIRECRAWL_KEY` is set in `.env`, ingestion tries Firecrawl once for that URL. It also tries Firecrawl once for an HTTP 200 HTML page when the existing JavaScript signal finds a script other than JSON-LD and fewer than 200 characters of body text outside navigation. A short ordinary page with an analytics script can meet that signal. The HTTP 200 path uses rendered HTML only if it contains at least 200 such characters; otherwise the direct page remains partial with `javascript_required`. A selected render keeps its Markdown and available direct HTTP text, including JSON-LD, within the usual source limits. Firecrawl failure leaves the direct page partial. The 403 path continues to use raw HTML and remains blocked without a key. Both fallbacks consume another page request and respect the remaining run time and response-size limit; other HTTP errors do not trigger Firecrawl.

### Choose facts and editions

The model decides which Event and edition each fact belongs to, then returns one result with `status`, `data`, `errors`, and `unresolved`. It can suggest dates, venues, prices, and links, but it cannot write to the catalog. It is instructed not to guess dates, prices, or an unannounced next edition; unknown facts can stay out of the proposal.

The result describes research completion, not announcement completeness. `success` means the relevant checks are complete; an announced year/date with no published venue or prices can succeed with omitted fields. After reasonable relevant checks, say “not found on inspected pages” unless explicit evidence supports “not yet announced”; describe those limits in source summaries without inventing or clearing facts.

`partial` requires useful data and a specific unfinished core check plus its cause in `unresolved`: an unrecovered relevant source failure, material conflict, or exhausted budget. Refresh completeness covers announcement/selection research and every assigned Event/Edition field. Missing values after completed checks are allowed; an unattempted assigned check requires partial. Add covers the previous and current/next Edition slots; duplicate add needs only identity. Missing optional size, coordinates, socials, or a completed schedule status does not force partial. A recovered page failure can coexist with success. `failed` uses null data when no usable result exists. For refresh, repeating input identity, saved facts, or URLs is not a useful finding: unavailable sources with no usable findings require failed, not an empty partial candidate. Source-verified unchanged facts still count; duplicate-add identity matching remains sufficient. Errors describe execution problems; questions describe what remains unknown.

Each finding has `{ value, reason }`; evidence stays in `sources[].information`. Unknown fields are omitted. Where allowed, `value:null` means a saved value is affirmatively disproven without a known replacement; it does not authorize a write. Existing Event names, aliases and slugs stay unchanged; an observed name mismatch remains informational.

`sizeEstimate` is approximate festival size in people, supported by participant evidence rather than venue occupancy or repeated daily admissions. Relevant historical attendance needs an explained basis; missing evidence preserves saved size.

### Agent contracts

```ts
type ResearchInput = {
  currentDate: string; // ISO timestamp fixed once per run
  // Other research inputs remain unchanged.
};
type Finding<T> = { value: T; reason: string };
// Research output shape stays {status, data, errors, unresolved}.
// Dates/coordinates/tickets remain grouped.
type ResearchClassification = Finding<TermId[]>; // Complete intended list.

type EditorInput = {
  research: ResearchResult;
  catalog: SavedEvent | null;
  vocabulary: Term[];
  mode: "add" | "refresh";
  scope: "full" | "current" | null;
  currentDate: string;
};
type Action<T> =
  | { action: "accept" } // Copy the same-field research value/reason.
  | { action: "set"; value: T; reason: string }
  | { action: "clear" | "keep"; reason: string };
// clear is allowed only on clearable fields; set never accepts null.
type EditorPlan = {
  event: { fields: EventActions; reason?: string } | null;
  previousEdition: EditionPlan | null;
  currentOrNextEdition: EditionPlan | null;
  unresolved: ResearchQuestion[];
};
// Actions use named fields. Omission preserves values.
type EditionPlan = {
  editionKey: string;
  fields: EditionActions;
  reason?: string; // Required for a new Edition.
};
// Research data has the same two required nullable slots with Edition findings.
// A null editor slot preserves the Edition and skips its publication check.
```

One editor serves add and refresh. It receives supplied research and saved state, has no tools, and makes at most one generation under the shared deadline/configuration without retries or correction loops. Failed/invalid research, country rejection and duplicate add skip it. Add may decline creation with `event:null`, no Editions and an unresolved reason; refresh uses the Event fixed by validated input; add uses research eventName. Editor returns no Event IDs/names or nested target/create objects. Each non-null editor slot must match the key in the same research slot, including keep-only plans. A null research slot requires a null editor slot. Existing keys update; new keys require a creation reason. Invalid editing writes nothing and preserves research output/status.

### Choose the refresh target

The model receives scope, frozen `currentDate`, all saved Edition keys/dates/time zones and research rules; supported fields come from the output schema and countries from saved Editions. It chooses the ongoing Edition first, otherwise the nearest supported future Edition; ambiguity stays in existing unresolved questions. Add and full also select the latest actually completed Edition. Completion or ordering can be known without exact dates; do not invent dates. Selection is reflected in the final proposals and existing explanations; there is no resolver tool or intermediate selection call. Static context describes the task, not completed research. Current retains every saved key and temporal/country/matching clue, links, terms and complete ticket blocks, but omits Event summary/homeScope/publication metadata and Edition publication metadata, detailed address and size. Full research and the editor retain the complete existing fact projection; host snapshots are unchanged.

Ongoing wins through the inclusive local final day; otherwise select the nearest supported future start. Ties, overlaps, uncertain ordering/matching remain unresolved. A sole future year-only announcement can qualify. Keys remain stable across corrected dates/years. Several programme periods of one realization use one key, the first start date, and the last end date. The inclusive range includes gaps and remains ongoing during those gaps. Distinct realizations can share a year. Saved statuses do not exclude candidates without inspected evidence. A cancelled or postponed Edition without a completed programme cannot be previous. Cancellation/postponement without replacement dates is excluded from current/next; supported replacements retain the matched key.

Run full before current to establish Event identity and shared links; this is an operating precondition, with no stored flag or run-history check. Current does not repeat that validation. If inspected material clearly contradicts identity, current returns failed/null with an identity question requesting full, without replacement-site discovery, editing or writes. Unavailable sources are diagnosed without website recovery. Full retains wrong-site discovery and association inspection; search snippets/name matches are insufficient. Verified recovery can correct the Event website. An unresolved material identity contradiction prevents all writes/publication: full returns partial with useful target findings, otherwise failed/null.

### Preserve or replace values

Both models receive the same [classification rules](../openspec/specs/catalog/classification/spec.md): at most one event type and one format. The editor corrects supported conflicts with a complete `set` and reason. Otherwise, it keeps or omits classification and reports uncertainty. Count errors identify the field, facet, limit, and conflicting IDs.

Research and editor use the same format rules. `openair` means the main public programme operates in an open-air site setting. `indoor` means it operates in enclosed indoor spaces. `mixed-indoor-outdoor` takes priority when substantial programme parts use both settings. One physical feature, support facility, branding, or camping alone does not decide format. Omit an unsupported finding and preserve the saved value. Unknown format does not block publication.

The editor chooses accept/set/clear/keep for named fields. Set supplies a non-null typed value; clear explicitly removes a clearable value; keep and omission preserve it. Dates and coordinates are complete grouped replacements; clear resets both components and their state/precision to unknown. Saved time zones remain unchanged. Classification accept/set supplies the full intended term-ID list. Preparation rejects unknown IDs, duplicates, and single-value facet conflicts, then removes selected ancestors when descendants are also selected. It keeps siblings and broad-only terms, and does not infer descendants. Change reasons explain removed ancestors, including in previews. Raw model output stays unchanged. Direct catalog writes still reject redundant ancestors. A tickets finding with a supported price supplies all variants/basePrice to write, replacing the saved block without copying unverified old offers. Research classification is a complete value/reason finding that retains unchallenged saved terms. For an existing current Edition, assess its announcement and retain unchallenged terms or omit classification. For a new current Edition, research may explicitly reuse the nearest preceding comparable saved Edition after inspecting announcement continuity; its reason names the donor key and continuity basis. Changed programme/format excludes refuted terms; a nearby year/weekend alone does not prove comparability. Omission never triggers inheritance. Accept copies a finding; set supplies a corrected complete value. One typed preparation pass resolves acceptance and checks same-field support before generating writer operations.

Ticket variants carry their own availability and qualifications. Concessions, day tickets and upgrades cannot establish full-programme base prices. When at least one ticket price is supported, research proposes the observed offers as one replacement block. For example, a new Regular EUR 110 full-programme price replaces saved Regular EUR 100 and removes an unverified saved Student EUR 60 offer if Student checkout is inaccessible; the unfinished check remains unresolved. If no price is supported, research omits tickets and the saved block stays unchanged. A failed source read, missing price, availability-only update or closure-only notice does not automatically clear it.

All model amounts use major units and validated uppercase three-letter currency codes. Amount and currency must appear together. The adapter converts base-price `minAmount/maxAmount` to integer minor units using currency precision: EUR 100.50 → 10050, JPY 1000 → 1000, KWD 1.234 → 1234. Excess precision and unsafe integers fail without rounding. Variant amounts remain in major units. Exact/from bounds match; range maximum exceeds minimum. Free full-programme admission requires neither currency nor amounts; null base price means unknown.

Links have one Event website, optional instagram/facebook/youtube/tiktok/x/other social slots, and one ticket URL per edition. `x` accepts X or Twitter account URLs. Research supplies association evidence; the editor chooses set/clear/keep per owner/kind slot. Set replaces that slot, clear removes it, and keep/omission preserves it; other owners and kinds are untouched. Inaccessible destinations alone never authorize clearing.

`data.sources` describes useful inspected pages once, with URL and information found, including edition context and partial-page limits. It has no direct fact-to-page associations. Source summaries are separate from public links and the host's actual retrieval history.

Current may succeed with no selected Edition when useful inspected sources complete announcement checks under the trusted identity baseline. Ambiguous selection returns partial with no arbitrary target and an unfinished question. The model reports known unfinished mandatory checks as partial. Omitted optional size, coordinate or address checks do not require partial status. Success describes the operation and does not certify complete checks. No usable inspected findings requires failed/null. A hard limit without a usable result retains the limit reason, budget counters, source-read history and available model questions. It does not require or invent a complete list of unfinished checks.

## Resolve location

Research retains the five place text fields and optional coordinate findings. Editor owns identity, accepted Edition keys and non-location actions. An accepted key can have empty editor fields. A null editor slot stays null. After editor validation, one Location assignment assesses both accepted slots. If neither slot is accepted, Location is skipped and valid Event actions can still proceed. Location cannot restore declined creation or change Edition keys.

Code first reverse geocodes each saved target point, or its unique latest earlier donor if no target point exists. It forward geocodes the research description, falling back to saved text only when no new description exists. Explicit withdrawals do not restore old text. A new venue never receives an old address as a search hint. Equal coordinates or whitespace-normalized descriptions with the same country share results across slots. Two equal slots usually need two requests; distinct inputs can need four.

Location receives final dates, saved history, festival context, research findings and source summaries, available editor explanations, initial results and registered point IDs. Its only tool is forward `geocode` for useful refinements or alternate spellings. Initial requests and tools share six calls per Event, including agent cache hits, one cache and the run deadline/cancellation. Successful empty matches are cached; failures are not. Uncached requests have no automatic retries. Location has at most eight model steps. `CATALOG_LOCATION_MODEL` defaults to the normal model. Missing `GEOAPIFY_KEY` gives bounded unavailable context; saved and source points remain usable.

Location returns decisions in the same named slots without repeating Edition keys. Code uses the accepted input key for each slot, including unresolved questions. Location input omits the constant editor status and keeps its available explanations. It includes the full bounded `editor.unresolved` array without filtering or merging Research questions. Location uses relevant questions as context and need not repeat them in its output; they cannot restore a declined slot. Every accepted Location slot must return keep, set or clear with a reason for each text field. Coordinate actions are keep, inherit a registered donor, select a registered point, or clear a disproved saved point. The agent returns point IDs, never numeric coordinates. Keep preserves the target only. If the target has no point and its donor is unsuitable, keep leaves coordinates absent without inheriting. Clear requires an existing saved value in that target; it cannot clear an absent value or remove a donor. Inherit copies donor coordinates and precision exactly; the writer rechecks that donor inside the item transaction. Select can lower the same target's overstated precision with evidence, but cannot increase it or use another target's saved point.

Prefer coordinates that the festival's official site explicitly gives for the target Edition's venue, unless supplied evidence gives a concrete reason to reject them, such as another Edition, another object, or an outdated venue. They can replace a saved point or historical donor without a confirmed move or proof of an old mapping error. Distance from an old point or locality centre, locality-only results and failed geocoding do not alone disprove the site's venue point. Keep material unexplained discrepancies in unresolved; they do not by themselves prevent selection or require lower precision. Otherwise prefer applicable saved points. Distance, centrality, open-air format and provider confidence alone do not prove an error. A central park can be an open-air venue. Reverse results describe a nearby object, not containment, and cannot become replacement points. A confirmed move or mapping error can disprove an old point. If no applicable saved, donor, source or venue candidate exists and the locality is established, use remaining calls to query that locality with its administrative area and country, without the venue name. Do not repeat an equivalent completed query. Use a supported city fallback if available and leave venue uncertainty explicit; clear a disproved point if no applicable replacement exists. Several venues require context for a representative point. Precision describes place type: exact is a confirmed venue, approximate is an approximate venue point, locality is a settlement and region is a region.

Code validates point and donor references, fields, slots, country and precision. The agent owns factual assessment and returns reasons without source URLs or source IDs. Supplied source summaries remain in the input and report, without a separate association between each Location decision and a source. Both owners' actions are combined before operation preparation and publication. One atomic writer applies the item. Valid Location questions can accompany independent ticket changes; invalid or failed Location applies nothing. There is no agent messaging or extra evidence service. A standalone Location command is deferred.

The v7 report retains raw `locationResponse`, `locationStatus`, Location model/prompt settings, initial and agent observations and the private point map. Observations retain direction and shared slot references; initial requests are not agent tool calls. A failed Location preserves research status and available diagnostics. A valid explicit refusal has `locationStatus: rejected` and a `location_rejected` error with the supplied reason. It stops all catalog writes and leaves the overall attempt failed. Isolated Location evaluations also fail and retain the reason. Malformed output uses `locationStatus: failed` and `location_failed`. Validation failures retain a fixed application rule message or bounded schema issue paths and codes, without raw exception or provider messages. Technical errors remain separate, including the existing deadline diagnostic.

## Validate the proposal

The system checks shape and same-slot keys. Current requires `previousEdition:null` and no Event summary or shared-link findings or actions. The two slots bound returned Editions; saved context has no Edition-count limit. Temporal choice, factual meaning and completeness remain model decisions assessed by evals. Conflicting saved countries fail before source/model calls (`country_baseline_conflict`). A known country from any saved Edition constrains every returned country, including new/unchanged facts and explicit null clearing; conflicts fail the entire Event (`country_conflict`) before editing; final Location country actions are checked again before operations. Correcting a bad baseline requires a separate authorized correction. The apply transaction rechecks every saved Edition ID/country; concurrent baseline changes abort all writes. The writer checks data rules, versions, and publication requirements. It can reject an invalid date, but it cannot tell whether a valid date is factually correct.

Accepted first-version limit: new Event slugs come from their names. If a distinct Event has the same generated slug as an existing Event or reserved alias, its item write fails and the run reports `write_failed`; the proposed slug remains visible in its operations. The run does not merge the two Events or choose a fallback slug automatically.

## Preview or apply

By default, the writer previews changes and rolls them back. The private run row and preview report persist, while catalog facts, versions, audits, and receipts roll back. A previewed new Event ID exists only in the report; the row’s `event_id` stays null. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts.

Publication requires an Edition year, complete date pair, country, one `event_type`, and at least one `topic` or `culture` term. Format is optional and can remain unknown. Any valid assigned value in these facets qualifies; venue, locality, region and coordinates are optional. An Event can publish through a historical Edition without an announced next-year Edition. A new undated Edition stays a draft.

## Review the report

For local debugging, opt in with `CATALOG_CAPTURE_TOOL_OUTPUTS=true` when starting the CLI or Studio process. Use the report's `runId` to open `data/catalog-debug/<runId>/`: numbered JSON files show the initial `inspectedSources` projection and each returned `readPage` or `searchWeb` result; page Markdown also appears in companion `.md` files. Repeated cached page calls have separate entries. These ignored files contain sensitive source content, so keep them local and delete them after inspection. Capture is best effort and does not change the report or catalog result.

Version 7 reports show `researchStatus` separately from catalog `outcome`, explained old/new changes, staged `errors`, `unresolved` questions, `sourceSummaries`, and technical retrieval history in `sources`. Add and refresh reports contain the frozen `currentDate`. Refresh also has `scope`. Reports include `limits` and `workload`; returned Edition counts include only non-null research slots. Research and editor use an explicit catalog-fact projection without database versions, timestamps or Edition/link storage IDs; the host keeps the full snapshot. Research uses that context and prompt rules, without a separate refresh object, copied country baseline or field registry. Reports do not duplicate that catalog snapshot or the prompt rules. There is no separate verification array, confirmed/changed comparison or returned-fact counter. Raw findings remain in `modelResponse`; the raw `editorResponse` retains its structured plan once, including invalid output. `editorStatus` is success/failed/not_run and `editorPromptVersion` identifies its instructions. Returned unchanged facts remain in the raw `modelResponse`; omitted facts preserve saved values without invented completion. The existing writer retains actual changed values and reasons in audit; no-op checks create no audit. Old report versions are unsupported, with no legacy gaps fallback. CLI and Studio share initialization after Mastra creates its run; every started attempt has a private `ingestion_runs` row and `runId`. The final report is saved automatically; `--report PATH` exports the same report, including the final raw response before normalization.

With `--apply`, success and partial results use the atomic writer. Failed research, editing or required Location writes nothing. Partial alone exits zero, as does a skipped duplicate add. Research, editor, Location or write failure exits nonzero. A write failure rolls back the entire Event item. The report retains research status, prepared operations, available raw research, editor and Location responses, source summaries, any name mismatch, and the write error. Applied `changes` stays empty; a separate proposed diff is not required. A partial result with no changes remains visibly partial/unchanged. Ordinary research retries only explicit OpenRouter `provider_unavailable` errors, at most three times with 10-second, 30-second, and 90-second exponential backoff within the same run deadline. A bounded Mastra iteration allowance preserves ordinary research capacity during those unavailable retries; observed request counts still include them. Other model errors are not retried; completed research steps and tool results are retained.

Research defaults to 15 ordinary model steps, with tools disabled on the last step to reserve a final response. `--agent-steps` or `CATALOG_MAX_AGENT_STEPS` changes that allowance. The application does not count or cap total input-context characters; current configuration and reports omit `modelInputChars`. Source-size/output limits, search safeguards and deadlines still apply. Linked pages have no traversal-depth limit. Provider context-window rejection is reported as a model failure.

Reports and explanations are private CLI output/files, not public website data or a separate hosted logging service. Public details expose only ticket category labels and availability; amount/terms/variant URLs and research metadata remain private. Unknown category availability has no badge. Discovery and details never derive a global sold-out/closed label from variants.

Reports contain no application token or cost totals and no usage-completeness flag. `report.budget` holds search, page, model-call, elapsed-time and remaining-limit counters. The private run table keeps identities, status, duration and the report JSON; the accounting migration removes its five token/cost columns and preserves historical rows and JSON. Current consumers reject unsupported report versions. Inspect available token and estimated cost metrics in Mastra Observability; absence is unknown, not zero.

Lifecycle status (`running`, `completed`, `failed`) is separate from research status and catalog outcome. Partial/no-op and skipped attempts complete; research, editor, writer, or unexpected workflow failures finalize failed. A late `workflow_failed` preserves committed outcomes and known accounting, but exits nonzero. A start-write failure aborts before work; a finalization failure reports `run_persistence_failed` with runId/available result and exits nonzero without undoing commits or replaying research. Other refresh targets continue. Optional report-file failure does not change the finalized row.

Abrupt interruption may leave a running row with null report, finish time, and final statistics, even after a catalog commit. That means completion is unknown. A rerun researches current state with a new runId and does not alter the earlier row. Event association is nullable and survives catalog deletion; use report operations’ `operationKey` to correlate saved audit changes.

## Evaluate ingestion

`npm run catalog:eval` runs six main cases once against fixed pages, searches, and geocoding responses. Each attempt starts from a fresh seed and applies the normal Research, Editor, Location, and writer flow in a disposable catalog. The owner's catalog is not changed. `--all` also runs all targeted regressions, for 51 cases in four separate groups.

Main results show required completeness, additional completeness, no checked errors, and scenario success. Missing additional facts lower completeness; wrong checked facts fail the case. A dimension with no expected facts is N/A. Gold data stays outside model input.

Results and diagnostics are saved as Mastra experiments in `data/mastra-evals.sqlite`, separate from catalog and observability storage. Inspect and compare them in Studio. Workflow output retains one real v7 report; isolated Location output retains its actual execution without an ingestion report. The eval command has no `--report` option. Ordinary ingestion report export still works.

Use `--model X` to select X for all three agents, including isolated Location. Compare runs with the same cases, repeat count, fixtures, and scorer revision. See the [eval guide](development.md#catalog-evals) for selection, fact units, storage paths, and comparison limits, and the [evaluation spec](../openspec/specs/operations/ingestion-evaluation/spec.md) for the contract.

## Inspect local agent traces

Set `CATALOG_TRACING=true` to save one trace per Event for apply, preview and evaluation, including injected dependencies. Tracing is off by default. Research, Editor, Location, source tools and initial geocoding share the execution trace. Mocks and initial preparation do not invent model tokens or costs. Eligible traced runs also save native execution metrics, independently of logging. The shared log/trace/metric file is `data/mastra-observability.duckdb`; `CATALOG_OBSERVABILITY_DATABASE_PATH` selects another local path, separate from catalog files/sidecars and the optional report. The old trace-path setting no longer selects recording or inspection; historical SQLite files remain untouched. DuckDB and the catalog remain separate. Close Studio before research, then reopen Studio after research exits.

The root's name and display name identify the canonical Event, mode, context edition and terminal result. For example, `Festival · ctx:2026 · created:2023 · refresh · partial` distinguishes saved context from the committed historical edition. Details retain up to ten entries per edition role with omitted counts. Keys and years are separate: `2026 [key:summer]`, corrected `2027 [key:2026]`, and unknown `? [key:2026]`. Years are never guessed from keys or dates. Unsaved discoveries stay in the private report.

Read spans show attempted/final URLs, retrieval outcome, technical reason, method, completeness, caching, and separate source/tool truncation observations; unobserved truncation is unknown. A normally completed tool can still say `failed:request_failed`. Search spans show the existing query, up to five candidate URLs and returned/retained/omitted counts, distinguishing successful empty searches, budget-reserved `not_run`, and failures. URLs keep their path, query and fragment, including token-like public values. Only their length is limited; tracing does not rewrite requests or detect secrets in public source text.

The root copies `researchStatus`, `editorStatus`, `locationStatus` and catalog `outcome` from the report, alongside structural/target validation of research, separate `editorPlanValidation` and `semanticValidation=not_run`. A rejected editor plan reports failed validation while retaining the research checks. Logs retain ordinary write completion/error events and the dry-run flag; logs and trace output omit transaction-disposition and committed-operation-count summaries. Writer results and report receipts retain operation details. If reporting fails after a write, telemetry does not promise a separate commit/count summary. Native technical error status does not claim factual verification. The private report can include a real `traceId` for correlation.

Host-owned trace input/output/metadata contains explicit selected fields: Event/edition labels, source URL/status/method, retrieval and validation outcomes, and available report results. Call sites shorten selected trace URLs to 512 UTF-8 bytes, queries to 1,200 bytes and candidate URLs to five, retaining returned/retained/omitted counts where useful. There is no generic host projection allowlist or whole-record 8/16 KiB cap. Automatic SDK-generated spans may carry prompts, messages or tool payloads; their content is suppressed at source where supported or removed by the smallest necessary fail-closed export exclusion. The private v7 report retains final model output.

The workflow ends the root after report construction, settles open children, then awaits flush and shutdown attempts. DuckDB uses the supported `event-sourced` exporter strategy; final name fields and safe projections are retained after reload, while interrupted/background persistence remains best effort. Persistence is best effort: overlapping background writes/flush/shutdown and forced termination may lose traces. Custom buffers, queues and exporter patches remain deferred. Tracing does not change reports, budgets, provider retries, catalog writes, durable runs or exit status. The durable runId remains available in trace metadata and correlates with stored application logs.

If the SDK content exclusion fails, the affected span is dropped with a fixed content-free diagnostic. Application logs use a narrow origin marker so SDK-generated logs are not automatically forwarded. Observability failure diagnostics are fixed and do not include raw payloads.

Operation timing belongs to native traces and metrics: agent/model/tool durations measure their SDK operation, not individual model-step log intervals. Model-step and tool-call logs no longer contain manually measured `durationMs`. Logging-only runs retain timestamped start/outcome events, context, commentary and reasoning. Budget deadlines, retry/step counters and whole-run report/completion-log duration remain independent.

Set `CATALOG_LOGGING=true` for selected application events at `CATALOG_LOG_LEVEL=info` (default), independently of tracing. Debug adds cache detail; warn/error restrict both sinks. Mastra PinoLogger uses ordinary level methods and scoped `child({...})` context. Stored events share the durable runId and available real trace/span IDs. Producers pass plain selected objects; source events retain character count and response status/URL without Markdown or full responses. Commentary and returned reasoning are separate completed-step events, each shortened explicitly with `shrinkText(text)` to at most 4,000 Unicode code points. Producers can include original/retained counts and a shortening flag. There is no generic field allowlist, recursive payload processing or whole-record 8 KiB cap.

An explicit editor rejection logs a rejected plan and uses the final trace label `editor-rejected`, retaining successful generation and failed plan validation. Preparation events include selected identity, edition keys/actual years, proposed field names/counts, validation codes/paths and model-reported unresolved question previews. Write completion events identify dry-run versus apply and affected field names. The “Research finished” message follows successful durable finalization; “Required run finalization failed” includes `errorCode: run_persistence_failed`; finalization preserves the original error and leaves any already committed changes intact. Successful previews and writes retain old and new values with reasons. Failed writes retain prepared operations and available model responses without requiring a separate proposed diff. Logging never adds model/provider requests or changes budgets/retries. Native Pino JSON on stderr and Studio records carry the selected fields. Completed-step text can follow tool outcomes, and unfinished-step text may be absent. SDK/config credentials are never selected as log arguments. No arbitrary credential redaction is promised for selected model commentary or reasoning; source diagnostic fields are not scanned for token-like public values. Completed commentary may include candidate text, while full provider response envelopes remain excluded.

### Execution metrics

The same tracing eligibility enables SDK metrics without an application-maintained list of names. Eligible metric events pass directly to native storage without additional application validation or projection. Current ingestion produces native agent, model-generation and tool duration/status metrics and available total input/output tokens with nested cache, text, reasoning, audio and image details. Cache/reasoning categories are subsets, not extra tokens. The catalog root and initial read are `GENERIC` spans and do not produce native duration metrics. SDK technical success can accompany a failed retrieval or rejected editorial plan; it does not mean successful catalog mutation.

The SDK propagates run/trace/span IDs and entity/parent/root context from execution spans. Entity IDs, types and names come from agent/tool configuration and are inherited by child spans. Group model usage by `entityId` and `model`: `festival-research`, `festival-editor` and `festival-location` identify the responsible agents. Tools retain their `readPage`, `searchWeb` and `geocode` identifiers and the root retains `catalog-research`. Explicit application trace labels remain unchanged. Selected usage, provider/model and status fields pass through as supplied by the SDK, without separate application validation; SDK span types are retained. Span processing still excludes raw model/tool content; the metric exporter does not independently filter labels, metadata or cached/direct SDK contexts, or supply missing context to spanless events.

The SDK uses complete provider-reported generation cost when available, including zero, or its available pricing estimate. Cost metadata identifies the basis through `source=provider_reported` or `pricing_id` and can include additional SDK accounting details. Spans preserve SDK cost context unchanged; manually supplied cost context has no separate application sanitization. Missing pricing leaves cost unknown. Sum cost only over `mastra_model_total_input_tokens` and `mastra_model_total_output_tokens`; adding text/cache/reasoning detail costs can double count consumption. A generation's reported charge is allocated once across those total-token records. Metrics are not the complete ingestion bill. Search charges remain outside native model generation. Missing pricing leaves costs unknown. Reports do not read metrics or calculate replacement totals.

Cancellation can close native generation spans before the SDK attaches final usage. HTTP failures can retain partial native tokens. Metric presence or labels do not prove a complete bill.

Metrics share the existing local store and bounded cleanup. CLI closes its owned store after flushing; Studio lends its store across attempts. Metrics survive reopen; historical spans/reports receive no backfill, and absent metrics are not zero usage. See the [development guide](development.md#local-trace-inspection) for a tested total-token query.

Run `npm run catalog:studio` to inspect saved logs, traces and Metrics after research exits. Studio inspection needs no model credentials or catalog connection. Its registered `catalog-ingestion` workflow can also execute research against an existing migrated catalog with OpenRouter configuration; preview is the default. See the [development guide](development.md#local-trace-inspection) for commands and cleanup.

The detailed contracts are [ingestion workflow](../openspec/specs/catalog/ingestion-workflow/spec.md), [source access](../openspec/specs/catalog/source-access/spec.md), [refresh scope](../openspec/specs/catalog/refresh-scope/spec.md), [ingestion updates](../openspec/specs/catalog/ingestion-updates/spec.md), [ingestion runs](../openspec/specs/catalog/ingestion-runs/spec.md), and [ingestion diagnostics](../openspec/specs/operations/ingestion-diagnostics/spec.md).

Editor returns either `status:ready` with a plan or `status:rejected` with a reason only. The provider schema reuses the required ready-field contracts: `previousEdition` and `currentOrNextEdition` are keyed objects or null, and `unresolved` is an array. Rejected transport output uses `event:null`, null Edition slots and an empty unresolved array. The adapter removes these empty branch fields before local validation. It owns the final festival-identity decision from research and saved context. Rejection stops all writes/publication and reports a failed item while editor generation remains successful. Full research explains a wrong saved website and verifies a replacement against independent saved identity clues in existing source summaries/fact reasons. The old URL alone does not define Event identity; matching names alone are insufficient. Search stops when its authorizing issue is resolved, and missing facts alone do not reopen it. Full passes unresolved identity contradictions to editing; current stops before editing when identity contradicts its baseline. Non-location editorial set/clear actions require a structured finding for the same field and Edition; source summaries explain findings but cannot create extra facts. Free ticket variants may store `amount: 0` without currency; positive amounts still require currency.

### Accepting research values

Editor can use `accept` to take a non-null same-field research value without repeating it, or `set` with a complete value/reason for a supported editorial transformation. Preparation resolves acceptance before writer operations and inherits the finding explanation; invalid/missing findings reject the whole plan. URL edits preserve meaningful components; text rewrites and list deduplication must preserve supported facts. Complete lists/blocks replace existing values without merging. Classification acceptance copies the complete research list, including unchallenged saved terms; editor checks preservation before accepting. Editions remain keyed decisions: omitted Editions are untouched; a new addressed key requires matching research and a creation reason.
