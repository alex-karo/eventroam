---
type: Guide
title: Ingestion process
description: Research, field decisions, publication, and report interpretation.
status: stable
tags: [catalog, ingestion]
---

# Ingestion process

The owner can use the local CLI, loopback Studio, or hosted Studio with the same preview and apply rules. Hosted Studio requires external ingress authentication and one owner for its DuckDB file. See [application containers](infrastructure.md#application-containers) for commands and settings.

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

Each attempt uses this fixed Mastra graph. Workflow retries and restart are disabled.

| Step | Responsibility |
| --- | --- |
| `initialize-run`, `load-context` | Validate the request, create the durable attempt, and load catalog context. |
| `read-initial-source` | Save the initial source and run Reader. |
| `collect-sources` | Research chooses sources; freeze the source list and evidence after admitted work settles. |
| `general-facts` | General confirms identity and selects the two Edition slots. A confirmed duplicate add stops here. Refresh cannot return a duplicate-add decision. |
| `tickets`, `classification`, `location`, `links` | Four independent parallel branches use the same frozen corpus and shared deadline. |
| `assemble-proposals` | Validate fixed proposals and attach saved values and point records. |
| `review-proposals` | Editor approves or rejects submitted fields and groups. |
| `prepare-catalog-plan` | Prepare operations from approved proposals. |
| `apply-catalog-item` | Preview or atomically apply operations. |
| `build-report`, `finalize-run` | Save the report, return a bounded summary, and release owned resources. |

CLI and Studio execute the same graph. Native workflow results retain source artifact references, evidence, each actual role response, and preparation results. Full Markdown stays in private files. The source list is part of the collection result; there is no separate manifest. All admitted work must settle before freeze and finalization. No role starts another collection after freeze. A required role failure prevents all catalog writes.

## Inspect saved runs

In Studio, open Workflows → catalog-ingestion → Recent runs. The shared private workflow store retains new CLI and Studio previews and apply runs after process exit, independently of logs and traces. It retains input, step progress, results, and execution/ingestion IDs; inspection needs no catalog connection or model credentials. See [storage and cleanup](ingestion-tools.md#workflow-history).

The UI can show which steps reached a saved result, research findings, editor and Location decisions, geocoding observations, prepared operations, and confirmed writes where saved. Workflow success, research status, editor status, Location status, catalog outcome, and report persistence status remain separate. Native success does not certify the other results. Token and cost totals require optional observability.

The UI shows the last saved state and accumulated results, not every snapshot revision or unsaved work. A stopped process may leave `running`. A catalog commit can succeed before its snapshot fails; durable reports and audit records remain the authority for writes. A history failure stops work and gives a nonzero CLI result even when a completed report exists. Native `/start` acknowledges early and cannot return a later failure; calls that await execution receive it. Start a fresh attempt after interruption; do not replay an old ID.

Saved state keeps current allowed model text and Location/geocoding results. Full source Markdown, credentials, prompts, provider transport data, raw exceptions, and separate request context are excluded. History covers the selected host and store only; previous reports receive no backfill.

## Start a run

```sh
pnpm run catalog add --name "Festival name"
pnpm run catalog refresh --event EVENT_ID
pnpm run catalog refresh --event EVENT_ID --event ANOTHER_EVENT_ID --scope current
```

`add` researches a festival by name and creates it only when new. A recognized existing Event returns `skipped` and its ID without changes; use `refresh` to update it. `refresh` researches distinct Events independently. Add and `--scope full` (default) check Event summary/shared links, the latest completed Edition, and the ongoing or nearest announced future Edition. Both Edition slots may create new records. `--scope current` checks only the ongoing or nearest announced future Edition. Other saved history and farther future Editions provide context for matching, country checks, and classification reuse.

Current assumes a prior full run established Event identity/shared links. It omits Event findings and focuses on Edition dates, schedule status, location, tickets, and classification. Size, precise coordinates, and detailed address are optional checks. `check` is unsupported. The database must already exist and be migrated. See the [ingestion tools](ingestion-tools.md#cli-research) for setup and options, or its [Studio instructions](ingestion-tools.md#local-studio-ingestion) for the workflow form.

## Load catalog context

`refresh` loads current facts and saved links for each selected Event. `add` loads catalog context to check whether the festival already exists. Research receives shared evidence/output rules plus only its add, full or current assignment; omitted refresh scope selects full. The full prompt does not include current-only stop/completion exceptions.

## Research and propose facts

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. The agent uses `readPage` for relevant known links and prior results first. `searchWeb` is permitted for an unknown, inaccessible, or wrong official source; a material identity/date conflict; or an essential identification, date, or publication-required gap in an already evidenced Edition. Permission does not require a search. An empty Edition slot or absent announcement alone does not justify search. A recurring Event description alone does not establish a specific past Edition for a search. Missing optional prices or size alone does not justify search. Explicit evidence that no next Edition is announced can complete the check. Stop when the relevant question is resolved. Current stops on an identity contradiction and requests full; it does not discover a replacement website. Search highlights are leads. Inspect destination pages before using their facts. Search and page reads share the run limits. OpenRouter's Exa plugin and default search mode remain in use.

`readPage` returns page evidence as Markdown with retrieval status, a truncation signal, and remaining budget. It includes supported My Maps points in the same call and keeps source labels and years. Research assesses that evidence; the reader does not choose a venue or Edition. A readable page can still have a limitation, so inspect its reason code and notices.

See the [source reader guide](source-reader.md) for extraction, Firecrawl fallback, map support, caching, response limits, and checks. The [source-access spec](../openspec/specs/catalog/source-access/spec.md) defines the contract.

### Choose facts and editions

General selects identity and temporal targets from source evidence. Field specialists propose values. Models return domain decisions, check findings and unresolved questions. Code creates execution statuses, safe errors, skip reasons and report completion status. A verified unchanged field counts as completed work; a missing proposal does not certify a check. Each assigned role must account for its own checks.

A missing optional value can remain unknown without failure. An unfinished assigned check makes usable research partial. Failed required output or no usable evidence stops writes. Source-verified values can remain useful after an unrelated retrieval failure.

### Agent contracts

| Agent | Input and prompt purpose | Output | Tools |
| --- | --- | --- | --- |
| Research | Concrete collection instructions, permitted sources, checks, page overviews and remaining budget. No raw mode or scope. | Check findings, completion reason and questions. | `inspectPage`, permitted `searchWeb` |
| Reader | One whole canonical page and extraction instructions. Keep literal passages, distant headings and qualifications. | Page overview, topics, years, literal quotes with literal context. Code derives anchors. | None |
| General | Identity candidates, saved chronology, assigned permissions and relevant evidence. | Identity decision, duplicate or uncertain decision, fixed Edition targets and common facts. | None |
| Tickets | Current or next target, saved ticket block and ticket evidence. | One complete observed variants/base-price replacement, or omission. | None |
| Classification | Fixed targets, saved terms and history, vocabulary and relevant evidence. | Complete term lists; explicit earlier Edition key and continuity reason when reused. | None |
| Location | Fixed targets, saved places, literal evidence, registered points and prepared reverse context. | Complete place decisions and registered point selection. | Forward `geocode` |
| Links | Fixed public slots, saved links, permissions and link evidence. No Tickets output. | Event website/social actions and current-or-next ticket link; omitted candidates and reasons. | None |
| Editor | Submitted proposals, cited evidence, saved values with owners and versions, and registered points. | Approve/reject at every supplied fixed key; no replacement values. | Bounded local `readEvidence` |

See [role contracts](../src/ingestion/roles/contracts.ts), [proposal assembly](../src/ingestion/proposals.ts), and [catalog preparation](../src/ingestion/catalog-plan.ts). Quotes use code-assigned IDs beside their text. Models do not calculate line numbers or join separate saved-state reference arrays.

### Choose the refresh target

General receives the fixed date, saved Edition keys, dates and time zones, relevant literal evidence, and concrete field permissions. It chooses the latest actually completed Edition and the ongoing Edition, otherwise the nearest supported announced future Edition. Keys stay stable across date corrections. Different realizations in one year can have separate keys. Saved history supplies context, not source proof.

Ongoing wins through the inclusive local final day; otherwise select the nearest supported future start. Ties, overlaps, uncertain ordering/matching remain unresolved. A sole future year-only announcement can qualify. Keys remain stable across corrected dates/years.

Several programme periods of one realization use one key, the first start date, and the last end date. The inclusive range includes gaps and remains ongoing during those gaps. Distinct realizations can share a year. Saved statuses do not exclude candidates without inspected evidence.

A cancelled or postponed Edition without a completed programme cannot be previous. Cancellation/postponement without replacement dates is excluded from current/next; supported replacements retain the matched key.

Run full before current to establish Event identity and shared links; this is an operating precondition, with no stored flag or run-history check.

Current does not repeat that validation. If inspected material clearly contradicts identity, current returns failed/null with an identity question requesting full, without replacement-site discovery, editing or writes. Unavailable sources are diagnosed without website recovery.

Full retains wrong-site discovery and association inspection; search snippets/name matches are insufficient. Verified recovery can correct the Event website. An unresolved material identity contradiction prevents all writes/publication: full returns partial with useful target findings, otherwise failed/null.

### Preserve or replace values

General owns description and common Edition facts. Specialists own their fixed fields. A proposed change carries evidence IDs and a reason. Omission preserves saved data. A permitted clear needs affirmative support. New targets need source support. Editor validates meaning and applicability; it cannot supply a new value.

Dates, each ticket block, classification and each location bundle are indivisible review groups. Identity rejection stops the item. Rejection of a temporal premise removes that target and dependent changes without reassignment. Optional rejection preserves the saved field. An accepted target can still qualify for publication when all optional proposals are rejected.

Classification is a complete list. Retained saved terms need no fresh evidence; added or removed terms need support. Explicit `reuseFrom: { editionKey, reason }` identifies an eligible earlier saved Edition of this Event and explains continuity. It need not be the nearest Edition. Preparation validates facets before removing redundant ancestors and records a deterministic explanation.

Tickets processes only `currentOrNextEdition`, including an ongoing festival. Historical ticket blocks stay unchanged. A supported replacement contains all observed priced variants and a nullable base price. Concessions, day tickets and upgrades cannot establish the full-programme base price. No supported replacement means preservation of the whole saved block, including any old URLs. New ingestion offers have no URL field. Other catalog operations retain their offer URL support.

Model amounts use major units and validated uppercase currency codes. Base-price conversion uses each currency's precision without rounding. Variant amounts stay in major units. Tickets can normalize local currency notation when the official source country and language identify the currency. An ambiguous symbol alone cannot support a numeric price. Availability and qualifications belong to each offer. Closed sales do not imply sold out.

Links works independently from Tickets. It owns one Event website, social slots, and one current-or-next ticket link. Prefer a ticket overview. Without an overview, one distinct supported product destination can qualify; repeated anchors do not create several destinations. Unread checkout can be a supported link but cannot prove a price. Preserve meaningful query parameters. Historical ticket links remain unchanged.

### Accepting research values

Editor only approves or rejects submitted values. It receives cited source text and can read bounded surrounding text from saved Markdown for validation. An exact anchored quote can still refer to the wrong Edition or an office. Editor cannot research, rewrite values, geocode, or start a correction loop.

## Resolve location

Location runs in parallel with Tickets, Classification and Links after General. It receives both selected targets, evidence and saved places. Code prepares reverse context for a saved target point, or its unique eligible earlier `previousPoint`. Forward queries belong to Location.

Initial requests and agent calls share six geocoding calls, a cache, cancellation and the run deadline. Location has at most eight model steps. `CATALOG_LOCATION_MODEL` defaults to the normal model. Missing credentials return bounded unavailable context.

Each addressed slot returns keep, set or clear for every text field. Coordinate actions are keep, clear, select a registered `pointId`, or `reusePrevious`. The latter needs no point ID: code binds the supplied earlier point to its Edition, version, pair and precision and rechecks it in the write transaction. Missing or ambiguous earlier points cannot be reused. Keep preserves only the target.

Source coordinate pairs remain beside their literal object and year context. Reverse results describe nearby objects and never create a replacement point. Unknown or wrong-target point IDs fail validation. Precise points need venue support; a city result cannot become an exact venue point. Missing optional coordinates do not force geocoding.

## Validate the proposal

The system checks shape and same-slot keys. Current requires `previousEdition:null` and no Event summary or shared-link findings or actions. The two slots bound returned Editions; saved context has no Edition-count limit. Temporal choice, factual meaning and completeness remain model decisions assessed by evals.

Conflicting saved countries fail before source/model calls (`country_baseline_conflict`). A known country from any saved Edition constrains every returned country, including new/unchanged facts and explicit null clearing; conflicts fail the entire Event (`country_conflict`) before editing; final Location country actions are checked again before operations. Correcting a bad baseline requires a separate authorized correction.

The apply transaction rechecks every saved Edition ID/country; concurrent baseline changes abort all writes. The writer checks data rules, versions, and publication requirements. It can reject an invalid date, but it cannot tell whether a valid date is factually correct.

Accepted first-version limit: new Event slugs come from their names. If a distinct Event has the same generated slug as an existing Event or reserved alias, its item write fails and the run reports `write_failed`; the proposed slug remains visible in its operations. The run does not merge the two Events or choose a fallback slug automatically.

## Preview or apply

By default, the writer previews changes and rolls them back. The private run row and preview report persist, while catalog facts, versions, audits, and receipts roll back. A previewed new Event ID exists only in the report; the row’s `event_id` stays null. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts.

Publication requires an Edition year, complete date pair, country, one `event_type`, and at least one `topic` or `culture` term. Format is optional and can remain unknown. Any valid assigned value in these facets qualifies; venue, locality, region and coordinates are optional. An Event can publish through a historical Edition without an announced next-year Edition. A new undated Edition stays a draft.

## Review the report

Use [saved source evidence](ingestion-tools.md#saved-source-evidence) to inspect canonical pages and Reader output. Keep these artifacts private.

The current report separates research, editor, and Location status from the catalog outcome. It includes old/new changes with reasons, errors by stage, unresolved questions, source summaries, retrieval history, limits, and workload. Add and refresh retain the fixed run date; refresh also retains scope.

Raw model responses remain available, including invalid editor output. Returned unchanged facts can be inspected there. Omitted facts preserve saved values; they do not prove that a check was complete. Actual mutations and reasons also appear in the writer audit. No-op checks create no audit.

Every started attempt has a private `ingestion_runs` row and durable `runId`. The final report is saved automatically. `--report PATH` exports the same report. Current consumers reject older report versions. See [ingestion runs](../openspec/specs/catalog/ingestion-runs/spec.md) and `src/ingestion/report.ts` for the exact report shape.

With `--apply`, success and partial results use the atomic writer. Failed research, editing or required Location writes nothing. Partial alone exits zero, as does a skipped duplicate add. Research, editor, Location or write failure exits nonzero. A write failure rolls back the entire Event item. The report retains research status, prepared operations, available raw research, editor and Location responses, source summaries, any name mismatch, and the write error. Applied `changes` stays empty; a separate proposed diff is not required. A partial result with no changes remains visibly partial/unchanged.

Ordinary research retries only explicit OpenRouter `provider_unavailable` errors, at most three times with 10-second, 30-second, and 90-second exponential backoff within the same run deadline. A bounded Mastra iteration allowance preserves ordinary research capacity during those unavailable retries; observed request counts still include them. Other model errors are not retried; completed research steps and tool results are retained.

Research defaults to 15 ordinary model steps, with tools disabled on the last step to reserve a final response. `--agent-steps` or `CATALOG_MAX_AGENT_STEPS` changes that allowance. Reader checks a configurable whole-page input allowance with a reserve. Topic packets have a bounded input size and fail explicitly on overflow. Source-size/output limits, search safeguards and deadlines still apply. Linked pages have no traversal-depth limit. Provider context-window rejection is reported as a model failure.

Reports and explanations are private CLI output/files, not public website data or a separate hosted logging service. Public details expose only ticket category labels and availability; amount/terms/variant URLs and research metadata remain private. Unknown category availability has no badge. Discovery and details never derive a global sold-out/closed label from variants.

Reports contain no application token or cost totals and no usage-completeness flag. `report.budget` holds search, page, model-call, elapsed-time and remaining-limit counters.

The private run table keeps identities, status, duration and the report JSON; the accounting migration removes its five token/cost columns and preserves historical rows and JSON. Current consumers reject unsupported report versions. Inspect available token and estimated cost metrics in Mastra Observability; absence is unknown, not zero.

Lifecycle status (`running`, `completed`, `failed`) is separate from research status and catalog outcome. Partial/no-op and skipped attempts complete; research, editor, writer, or unexpected workflow failures finalize failed.

A late `workflow_failed` preserves committed outcomes and known accounting, but exits nonzero.

A start-write failure aborts before work; a finalization failure reports `run_persistence_failed` with runId/available result and exits nonzero without undoing commits or replaying research. Other refresh targets continue. Optional report-file failure does not change the finalized row.

Abrupt interruption may leave a running row with null report, finish time, and final statistics, even after a catalog commit. That means completion is unknown. A rerun researches current state with a new runId and does not alter the earlier row. Event association is nullable and survives catalog deletion; use report operations’ `operationKey` to correlate saved audit changes.

## Evaluate ingestion

`pnpm run catalog:eval` runs five main cases once against fixed pages, searches, and geocoding responses. Each attempt starts from a fresh seed and applies the normal Research, Editor, Location, and writer flow in a disposable catalog. The owner's catalog is not changed. `--all` also runs all targeted regressions, for 50 cases in four separate groups.

Main results show required completeness, additional completeness, no checked errors, and scenario success. Missing additional facts lower completeness; wrong checked facts fail the case. A dimension with no expected facts is N/A. Gold data stays outside model input.

Results and diagnostics are saved as Mastra experiments in `data/mastra-evals.sqlite`, separate from catalog and observability storage. Inspect and compare them in Studio. Workflow output retains one real v7 report; isolated Location output retains its actual execution without an ingestion report. The eval command has no `--report` option. Ordinary ingestion report export still works.

Use `--model X` to select X for all eight agents, including isolated Location. Compare runs with the same cases, repeat count, fixtures, and scorer revision. See the [eval guide](ingestion-evals.md#run-evals) for selection, fact units, storage paths, and comparison limits, and the [evaluation spec](../openspec/specs/operations/ingestion-evaluation/spec.md) for the contract.

## Inspect local agent traces

Logs and traces help diagnose execution. They are optional and best effort. They do not replace the durable run report or writer audit. See [Ingestion tools](ingestion-tools.md#local-trace-inspection) for recording, queries, and cleanup.

- Set `CATALOG_TRACING=true` for traces and native metrics. Set `CATALOG_LOGGING=true` independently for application and native SDK logs. Both default off.
- Close Studio before a separate CLI process records data. Only one process can own the DuckDB file. Reopen Studio after the CLI exits.
- Correlate saved runs, logs, and traces through the durable `runId` and any available real trace/span IDs. A missing trace does not mean the catalog write failed.
- Inspect retrieval status and reason codes separately from tool execution status. A completed tool can return a failed retrieval. Native technical success does not verify facts or catalog changes.
- The root has the fixed name `catalog-research`. Metadata identifies the Event, mode and durable run ID, with workflow and experiment IDs when available. Output copies only `researchStatus`, `editorStatus`, `locationStatus` and catalog `outcome`. Workflow steps and the report hold phase, validation and Edition details.
- Keep diagnostics private. Native spans and SDK logs can retain prompts, messages, model responses, tool results and errors. Mastra's standard `SensitiveDataFilter` redacts supported span secret fields; arbitrary text and logs have no general redaction guarantee. The application does not attach configuration credentials. Canonical source files are required private artifacts.

Native tool spans retain their standard results. Application logs retain retrieval status, reason codes, method, URLs, caching and projection truncation. The initial read span retains retrieval metadata without a projection truncation claim. No processor restores custom span fields after SDK completion.

Pino writes JSON to stderr and Mastra forwards calls to Studio Logs. Delivery uses native Mastra behavior. Events outside SDK contexts can have no top-level correlation; application log data retains the durable `runId`. Completed model commentary and returned reasoning are separate events, each limited to 4,000 Unicode code points. Studio assistant tools use the same logging configuration without enabling chat traces.

The workflow ends its root after report construction, settles children, then attempts flush before shutdown. CLI closes its owned store; Studio lends its store across attempts. SDK observability warnings and errors use native messages; application lifecycle guards retain fixed codes. Telemetry remains best effort and does not change model requests, budgets, retries, catalog writes, reports, scoring or exit status. See the [diagnostics spec](../openspec/specs/operations/ingestion-diagnostics/spec.md) and `src/ingestion/runtime/` for the contract and implementation.

### Execution metrics

Native metrics describe eligible agent, model, and tool operations. They do not provide a complete ingestion bill. Logging-only runs retain timestamped events, not native operation durations or token totals.

- Missing usage or pricing is unknown. Mock calls do not invent tokens or costs.
- Group model usage by `entityId` and `model` to distinguish Research, Editor, and Location.
- Sum cost only over `mastra_model_total_input_tokens` and `mastra_model_total_output_tokens`. Cache and reasoning details are subsets; adding their costs can double count usage.
- Cost uses provider-reported charges when available, including zero, or available SDK pricing estimates. Search charges remain outside model-generation costs.
- Cancellation and HTTP failure can leave partial usage. Metric presence does not prove a complete bill.
- Reports keep budget counters and do not calculate replacement cost totals. Historical runs are not backfilled.

Use the [total-token query](ingestion-tools.md#local-trace-inspection) to inspect saved metrics without running research. The CLI closes its owned store; Studio keeps its shared store across attempts. Neither store has automatic retention. See the [diagnostics contract](../openspec/specs/operations/ingestion-diagnostics/spec.md) for details.

## Studio catalog chat

Open Agents → `catalog-assistant` in Studio. Ask it to select Events, preview or update one to three Events, or explain a saved ingestion result. Reads and explanations do not start ingestion. An explicit update request permits apply; preview uses dryRun true. Unclear targets or write intent require clarification.

Refresh uses existing ingestion rules, one Event at a time, with one selection per owner message. Scope defaults to full; current is also supported. Republish stays off. Cancellation stops later Events and preserves known commits. Closing a tab does not guarantee cancellation; inspect saved attempts after interruption. Process restart does not replay work.

The assistant loads catalog schema, report guidance, and SQL examples from the [catalog-sql skill](../src/mastra/catalog-assistant/skills/catalog-sql/SKILL.md). It reads current facts and private reports through read-only SQL. Results are limited to 200 rows and 64 KiB and identify truncation. SQL runs inside Studio without a hard timeout or active-query cancellation; costly queries can block other work. Report analysis uses saved evidence and is not a new source check.

Conversation history uses separate persistent storage. See the [ingestion tools](ingestion-tools.md#studio-catalog-assistant) for storage and offline fixture commands, and the [assistant contract](../openspec/specs/catalog/studio-assistant/spec.md) for execution rules.
