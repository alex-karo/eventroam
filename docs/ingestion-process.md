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
| `general-facts` | General confirms identity and selects only requested Edition slots. A confirmed duplicate add stops here. Add retains its Edition prerequisite; refresh can continue with independent Event work. |
| `tickets`, `classification`, `location`, `links` | Assigned owners run in parallel with the same frozen corpus and shared deadline. A branch without eligible assigned fields does no model or geocoding work. |
| `assemble-proposals` | Validate proposals, return repairable groups and attach saved values and point records. |
| `review-proposals` | Editor approves, rejects or returns groups. Review returned groups separately, then apply the complete review once. |
| `prepare-catalog-plan` | Prepare operations from approved proposals. |
| `apply-catalog-item` | Preview or atomically apply operations. |
| `build-report`, `finalize-run` | Save the report, return a bounded summary, and release owned resources. |

The CLI calls the Studio workflow API. Native workflow results retain source artifact references, evidence, each actual role response, and preparation results. Full Markdown stays in private files. The source list is part of the collection result; there is no separate manifest. All admitted work must settle before freeze and finalization. No role starts another collection after freeze. A required role failure prevents all catalog writes.

## Inspect saved runs

In Studio, open Workflows → catalog-ingestion → Recent runs. The shared private workflow store retains new CLI and Studio previews and apply runs after process exit, independently of logs and traces. It retains input, step progress, results, and execution/ingestion IDs; inspection needs no catalog connection or model credentials. See [storage and cleanup](ingestion-tools.md#workflow-history).

The UI can show which steps reached a saved result, research findings, editor and Location decisions, geocoding observations, prepared operations, and confirmed writes where saved. Workflow success, research status, editor status, Location status, catalog outcome, and report persistence status remain separate. Native success does not certify the other results. Token and cost totals require optional observability.

The UI shows the last saved state and accumulated results, not every snapshot revision or unsaved work. A stopped process may leave `running`. A catalog commit can succeed before its snapshot fails; durable reports and audit records remain the authority for writes. A history failure stops work and gives a nonzero CLI result even when a completed report exists. Native `/start` acknowledges early and cannot return a later failure; calls that await execution receive it. Start a fresh attempt after interruption; do not replay an old ID.

Saved state keeps current allowed model text and Location/geocoding results. Full source Markdown, credentials, prompts, provider transport data, raw exceptions, and separate request context are excluded. History covers the selected host and store only; previous reports receive no backfill.

## Start a run

```sh
pnpm run catalog add --input "Festival name or research note"
pnpm run catalog refresh --event EVENT_ID
pnpm run catalog refresh --event EVENT_ID --event ANOTHER_EVENT_ID --scope current
```

`add` researches one note about a possible Event and creates it only when new. A recognized existing Event returns `skipped` and its ID without changes; use `refresh` to update it. Add keeps its existing Edition prerequisite and uses the full assignment internally. External add input accepts no scope.

`refresh` researches distinct Events independently. CLI `--scope` accepts the `full` and `current` presets, with `full` as the default. Custom objects enter through Studio, assistant, or job submission. `check` is unsupported. The database must already exist and be migrated. See [ingestion tools](ingestion-tools.md#cli-research) for setup and input options.

### Research scope

A scope is a typed task object or a preset name. The assistant builds it from the owner's ordinary request before it submits work. The owner does not need to write structured input. This description-only scope works without an Edition:

```json
{
  "version": 1,
  "tasks": [{ "target": "event", "fields": ["description"] }]
}
```

Each task has one string target, a nonempty field list, an optional `instruction`, and optional `required` (default `true`). Omit the instruction to use standard field rules. A supplied instruction must not be blank. Its text passes unchanged through the applicable agents. Instructions add detail and grant no extra fields or targets. Unknown properties, versions, selectors, wrong-entity fields, and repeated target/field pairs fail before any attempt or external call. An invalid batch creates no jobs.

| Target | Allowed fields |
| --- | --- |
| `event` | `description`, `shortDescription`, `links.website`, `links.socials.instagram`, `links.socials.facebook`, `links.socials.youtube`, `links.socials.tiktok`, `links.socials.x`, `links.socials.other` |
| `currentOrNext`, `latestCompleted` | `year`, `displayName`, `scheduleStatus`, `sizeEstimate`, `dates`, `classification`, `location` |
| `currentOrNext` only | `tickets`, `links.tickets` |

Descriptions and each link slot are independent fields. Dates include the complete date pair and certainty. Classification, location, and tickets keep their complete-group rules. Location includes place text and coordinates, but not time zone. A task with several fields produces a separate completion result for each field.

Several tasks can use the same selector. They share one Edition binding. For example:

```json
{
  "version": 1,
  "tasks": [
    { "target": "currentOrNext", "fields": ["dates", "scheduleStatus"], "instruction": "Check the complete programme dates." },
    { "target": "currentOrNext", "fields": ["sizeEstimate"], "required": false }
  ]
}
```

Optional work uses supported facts found during assigned work. Missing optional facts cause no extra discovery and do not make research partial. Required means that the assigned check must complete; it does not require an invented value for an unpublished fact.

Both presets are task data and use the same validators and execution rules:

- `full`: all Event fields, both temporal selectors, all allowed Edition fields, and current/next ticket fields.
- `current`: all current/next Edition fields, including tickets and the ticket link; no Event or historical fields.

In both presets, `sizeEstimate` is optional. The location group keeps detailed address and coordinates optional. Field definitions are in [scope.ts](../src/ingestion/scope.ts).

Jobs retain the submitted preset name or custom object. At execution, one `NormalizedScope` keeps the task order and text, defaults each `required` value, and adds no missing instruction. The attempt saves it directly in `input_json.normalizedScope` before external work. A restarted job creates a fresh attempt: a preset uses the deployed definition at that time; a custom request keeps its submitted values and order. Dispatch checks the request and execution settings by value inside the attempt transaction. Earlier attempt scope and reports remain unchanged. Temporal selection uses each attempt's date and evidence.

## Load catalog context

`refresh` loads current facts and saved links for each selected Event. `add` loads catalog context to check whether the festival already exists. Research receives the fixed normalized scope, standard field rules, and supplied task instructions. The first Reader receives that assignment before navigation. Later roles derive fields, checks, context, and output schemas from the same assignment. Task order does not change field keys or target references.

## Research and propose facts

A supported announcement with a complete current programme date range uses `scheduled`, including replacement or provisional dates. Without a complete range it uses `announced`. An active cancellation uses `cancelled`. An announced postponement with no complete replacement range uses `postponed`; saved dates can be the old dates. A postponement alone does not justify clearing those saved dates. Once a complete replacement range is supported, the same Edition uses `scheduled`. `EventRescheduled` with current dates does not mean `postponed`. Keep the move and its evidence in the proposal or review reason. `dateState` records the certainty of the stored range, not whether it is the old or replacement range.

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. Research uses `inspectPage` for relevant known links and prior results first. `searchWeb` is permitted for an unknown, inaccessible, or wrong official source; a material identity/date conflict; an essential identification, date, or publication-required gap in an already evidenced Edition; or a concrete place for the ongoing or announced next festival. Permission does not require a search. An empty Edition slot or absent announcement alone does not justify search. A recurring Event description alone does not establish a specific past Edition for a search. Missing optional prices or size alone does not justify search. Explicit evidence that no next Edition is announced can complete the check. For place discovery, read useful travel, location or contact leads first, then use targeted search even if the country is known. Stop at a venue with city or area, a source-supported address or a map point. A field or forest needs no street address. Also stop when the organizer explicitly withholds the venue, no useful permitted step remains, or the shared budget ends. The missing venue does not prevent publication. An office, hotel or parking area is not the festival site without source support. Stop when the relevant question is resolved. Every refresh can recover a needed official source within the same discovery limits. Recovery alone grants no website write; `event.fields.links.website` must be assigned to change it. Search highlights are leads. Inspect destination pages before using their facts. Search and page reads share the run limits. OpenRouter's Exa plugin and default search mode remain in use.

Research must copy supplied and returned URLs exactly into `inspectPage`. It must not shorten, translate or rewrite their paths.

`readPage` retrieves Markdown, including supported My Maps points, source labels and years. Collection saves this text and gives it to Reader. Research receives a compact `inspectPage` result with the source identity, overview, page coverage, navigation leads, retrieval and processing outcomes, limitations and remaining budget. Coverage names collected information and explicit statements of nonpublication. Location coverage distinguishes a collected festival venue/address from only a town, country or office. Research does not seek the same place again merely because the short label omits its literal value or Edition year; Location checks the full quotation. Page silence is unknown. This helps Research choose pages; it does not support catalog changes or remove required checks. Research does not receive the page body. Reader extracts evidence without choosing a venue or Edition. A readable page can still have a limitation, so inspect its reason code and notices.

See the [source reader guide](source-reader.md) for extraction, Firecrawl fallback, map support, caching, response limits, and checks.

### Choose facts and editions

General selects identity and temporal targets from source evidence. Field specialists propose values. Models return domain decisions, check findings and unresolved questions. Code creates execution statuses, safe errors, skip reasons and report completion status. A verified unchanged field counts as completed work; a missing proposal does not certify a check. Each assigned role must account for its own checks.

A missing optional value can remain unknown without failure or extra discovery. An unfinished required check makes usable research partial. Independent supported Event work can proceed when Edition selection is unresolved. If General cannot confirm Event identity after useful collection, research remains partial, the catalog outcome is failed and no changes are prepared or written. Failed required output or no usable evidence stops writes. Source-verified values can remain useful after an unrelated retrieval failure.

### Agent contracts

| Agent | Input and prompt purpose | Output | Tools |
| --- | --- | --- | --- |
| Research | Fixed task scope, collection instructions, permitted sources, checks, page overviews, page coverage and remaining budget. | Check keys, source IDs and nullable source acquisition blockers; distinct owner questions. | `inspectPage`, permitted `searchWeb` |
| Reader | One whole canonical page with numbered segments, fixed task scope and extraction instructions. Keep necessary identity, temporal and observed country context. | Page overview, found information, explicit nonpublication, topics, years and segment selections. Code restores the literal passages and derives anchors. | None |
| General | Identity candidates, saved chronology, assigned permissions and relevant evidence. | Identity decision, duplicate or uncertain decision, fixed Edition targets and common facts. | None |
| Tickets | Current or next target, saved ticket block and ticket evidence. | One complete observed variants/base-price replacement, or omission. | None |
| Classification | Assigned fields and fixed targets, relevant saved context and evidence. Classification work receives terms and vocabulary; description-only work does not. | Complete assigned term lists and independent assigned descriptions. Term reuse includes an earlier Edition key and a continuity reason. | None |
| Location | Fixed targets, saved places, literal evidence, registered points and prepared reverse context. | Complete place decisions and registered point selection. | Forward `geocode` |
| Links | Fixed public slots, saved links, permissions and link evidence. No Tickets output. | Event website/social actions and current-or-next ticket link; omitted candidates and reasons. | None |
| Editor | Submitted proposals, eligible omissions, review paths, cited evidence, saved values, registered points and saved Markdown paths. | One decision and note per required path, plus any eligible omission it returns. | Native Mastra workspace grep |

See [agent code and ownership](project-structure.md#ingestion-ownership), [proposal assembly](../src/ingestion/proposals.ts), and [catalog preparation](../src/ingestion/catalog-plan.ts). Code assigns an evidence ID to each bound quotation. Editor receives one list of passages by ID. Proposed facts and repair records refer to entries in that list by `evidenceIds`.

Research reports source acquisition separately from interpretation. Each assigned collection check contains its key, relevant source IDs and `blocker`. A null blocker means no specific acquisition gap remains; it does not certify semantic sufficiency. A non-null blocker is a short text reason. Its field description recommends at most 300 characters; longer reasons remain valid and are retained in full. It names the source need and cause, such as an inaccessible source, unread lead, unprocessed text, missing required source or unresolved source conflict. It has no type or category. Only the affected check receives that blocker. General and specialists assess the full evidence and saved context. Missing fresh genre names or broader description alone does not require another source. A specialist finding cannot remove a real collection blocker. Missing required collection checks still make research partial. Field checks use proposal paths such as `event.fields.description`; `identity` and requested `<slot>.select` checks cover identity and selection. `description` and `shortDescription` have distinct keys. No unassigned field needs a finding. Code copies a blocked check key and cause into the report's unresolved items, even when no informative source summary is available. Separate model questions contain only a short message for an owner decision; they do not repeat check gaps or select fields or Editions. Research has no completion summary or empty evidence-reference arrays. General and specialists retain their source support and interpretation reasons. Saved evidence and report completion rules stay in use.

Decision reasons, owner questions, source summaries and diagnostics use length guidance in field descriptions instead of hard character limits. The same rule applies to Reader overviews, coverage labels, scope hints, uncertainty, year labels and limitations. Required nonempty text, exact source binding, catalog field validation and context budgets still apply.

Reader returns only `quote` and `topics` for self-contained evidence. It adds `context`, `editionClues` and `uncertainty` together when any is needed. Code fills empty metadata when it binds the passages. An invalid context selection discards the whole evidence item. General receives the fixed scope, identity task, field permissions, check keys and relevant saved facts. Its saved context excludes prices, taxonomy and coordinates. Editor receives the allowed decision paths and actions. Links lists only material ambiguous candidates in `omitted`, not routine rejected navigation or unrelated URLs; supported social accounts still need a proposal or ambiguity explanation.

### Choose the refresh target

General receives the fixed date, saved Edition keys, dates and time zones, relevant literal evidence, and concrete field permissions. For `latestCompleted`, it chooses the latest actually completed Edition in `previousEdition`. For `currentOrNext`, it chooses the ongoing Edition, otherwise the nearest supported announced future Edition, in `currentOrNextEdition`. Unassigned slots do no selection. Several tasks for a selector share one binding through specialists, Location, Editor and returns. References use these slot names, without request IDs or list positions. Keys stay stable across date corrections. Different realizations in one year can have separate keys. Saved history supplies context, not source proof.

Ongoing wins through the inclusive local final day; otherwise select the nearest supported future start. Ties, overlaps, uncertain ordering/matching remain unresolved. A sole future year-only announcement can qualify. Keys remain stable across corrected dates/years.

Several programme periods of one realization use one key, the first start date, and the last end date. The inclusive range includes gaps and remains ongoing during those gaps. Distinct realizations can share a year. Saved statuses do not exclude candidates without inspected evidence.

A cancelled or postponed Edition without a completed programme cannot be previous. An explicit statement that the applicable past programme ended can establish completion unless other evidence shows cancellation or an unresolved postponement. `EventRescheduled` metadata alone does not contradict completion. A completed programme with a complete date range uses `scheduled`, including when the saved status needs correction from `postponed`. Completion determines the previous slot; `completed` is not a schedule status. An active cancellation or a postponement without replacement dates is excluded from current/next, even when saved dates are in the future. If no eligible candidate remains, that slot is null and excluded saved Editions stay unchanged. Supported replacements retain the matched key.

A null requested slot is `absent` when the selection check confirms absence, or `unresolved` when selection remains open. Unrequested slots are `not_run`. Different selectors cannot bind the same Edition. A scope or fixed-target violation rejects the whole item. Selection by a saved Edition ID is unsupported; the assistant explains this limit and does not substitute a temporal selector. `tickets` and `links.tickets` with `latestCompleted` fail before research.

Saved history can support matching and interpretation, but grants no writes to unassigned records or fields. Supporting identity, temporal and observed country context can travel with the evidence. Identity and country contradictions still stop all writes. Every refresh can recover an official source needed for its assigned work; there is no prior-full requirement for current.

### Preserve or replace values

Ticket variants need an observed price, explicit availability or concrete admission terms. A category name or referral to an unread checkout alone stays an unresolved question, even when amount and currency would be absent. Editor returns a whole ticket block that contains such an unsupported variant while a return is available. Tickets can remove the unsupported variant or withdraw the block. At the return limit, Editor can reject the block. Supported unknown-price offers remain valid.

General owns common Edition facts, including attendance. Record the year and count qualifications in the attendance reason. Specialists own their fixed fields. A proposed change carries evidence IDs and a reason. Omission preserves saved data. A permitted clear needs affirmative support. New targets need source support. Editor validates meaning and applicability; it cannot supply a new value.

Dates, each ticket block, classification and each location bundle are indivisible review groups. Identity rejection stops the item. Rejection of a temporal premise removes that target and dependent changes without reassignment. Optional rejection preserves the saved field. An accepted target can still qualify for publication when all optional proposals are rejected.

Classification supplies one vocabulary slug for `eventType` and `format`, and lists of slugs for `topics`, `genres` and `cultures`. An omitted or null field keeps its saved terms. An empty list clears a field that accepts a list. Added or removed terms need source evidence. If evidence refutes a saved type or format and supports no replacement, Classification reports the conflict in `unresolved`. The application resolves slugs to term IDs and builds the complete term list for Editor. Explicit `reuseFrom: { editionKey, reason }` identifies an eligible earlier saved Edition of this Event and explains continuity. It need not be the nearest Edition. Preparation validates facets before removing redundant ancestors and records a deterministic explanation.

Classification reviews only assigned descriptions, including Event-only work with no Edition target. Add and the full preset assign both descriptions. Classification writes three to five sentences about the current format and atmosphere for the detailed text and one or two sentences about the current format for the short text. It uses the present tense and omits the festival name from both texts. Use the latest known format unless sources announce a change. Leave dates, lineups, prices, directions, attendance and one-time details in Edition data. Each description has its own proposal, check and Editor decision.

Tickets processes only `currentOrNextEdition`, including an ongoing festival. Historical ticket blocks stay unchanged. A supported replacement contains supported ordinary admission variants and a nullable base price. Payment-plan offers and terms are excluded. Their details do not require owner questions or keep ticket checks unfinished. Admission prices are not calculated from payments. Concessions, day tickets and upgrades cannot establish the full-programme base price. No supported replacement means preservation of the whole saved block, including any old URLs. New ingestion offers have no URL field. Other catalog operations retain their offer URL support.

Model amounts use major units and validated uppercase currency codes. Base-price conversion uses each currency's precision without rounding. Variant amounts stay in major units. Tickets can normalize local currency notation when the official source country and language identify the currency. An ambiguous symbol alone cannot support a numeric price. Availability and qualifications belong to each offer. Closed sales do not imply sold out.

Links works independently from Tickets. It owns one Event website, social slots, and one current-or-next ticket link. Prefer a ticket overview. Without an overview, one distinct supported product destination can qualify; repeated anchors do not create several destinations. Unread checkout can be a supported link but cannot prove a price. Preserve meaningful query parameters. Historical ticket links remain unchanged.

### Accepting research values

Editor uses the same fixed date as General and Location. It approves supported field proposals. It returns a disputed proposal to its owner while a return is available. The note names the disputed claim and asks for a supported correction or withdrawal of the whole group. Editor can also return an eligible omission when evidence supports a concrete correction. An absent optional value alone does not require a return. The specialist decides the value under its original instructions. Editor can approve a supported revision or explained withdrawal without using further returns.

Review decisions use paths such as `event.fields.shortDescription`, `currentOrNextEdition.fields.tickets` and `currentOrNextEdition.fields.links.tickets`. General owns common Edition facts. Classification owns terms and both descriptions. Tickets owns ticket prices and variants. Links owns website, social and ticket URLs. Location owns each Edition's place. Item and target decisions allow approval or rejection. Edition selection stays fixed.

Validation can return a group before the first Editor review if the rule identifies its owner and group. The workflow first checks the whole reply for invalid targets, country conflicts, and unknown evidence, source, or point references. These boundary failures still stop writes. An unknown term or reuse Edition can go back to Classification with the invalid value and the rule for choosing a replacement.

Each group can return up to three times in total. Validation, Editor review, and local reply corrections share this limit. The workflow sends one request per owner in each round. It merges valid requested groups and retries only groups with local errors. A valid peer revision stays available for Editor. A local error does not stop another owner. An omitted revision needs a reason for its exact group path. A short field name does not qualify. An explained withdrawal preserves the saved value and leaves the applicable check open.

At the limit, code rejects a group that still has a local validation error. It removes that proposal and its dependent changes. It cannot restore the disputed original proposal. The first Editor review includes usable validation repairs. Later reviews decide only usable groups from that return round. A valid third revision can still receive approval. A submitted field allows approval or return while its owner and allowance are available. When a return is unavailable, it allows approval or rejection. All accepted changes pass the normal publication and atomic write checks.

If a complete Editor reply fails validation, Editor can correct it once. The request states the failed rules and keeps the same review paths, allowed decisions, and saved-page results. The correction uses the shared deadline. A second invalid reply stops the run before catalog writes.

Editor checks proposals against their evidence, saved values and related proposals. It also checks concrete gaps in assigned groups, even when a specialist omits the value. If the evidence leaves a specific issue open, Editor searches a relevant saved page when the result can change an allowed decision. It returns an eligible group with the source and an exact excerpt when the evidence supports a correction or fills a gap. An inconclusive search leaves the question open.

Editor uses native workspace grep. The workspace lists exact file paths, URLs and available overviews. Code checks the source hash before each search. Before approving a new or changed fact in a returned group, Editor checks the saved page for the fact and its context. This also applies to the first review after a validation return.

Returning specialists use their original input and the return note. The note can contain an excerpt from a saved page. Specialists have no tools on a return and can use an empty evidence list for the returned group. The workflow checks any references they supply and keeps the Reader evidence intact. Location can use a previously registered point.

## Resolve location

Location runs in parallel with Tickets, Classification and Links after General. It receives only selected targets with an assigned location group, the fixed scope, evidence, saved places and the saved detailed description when available. Without an assigned location group, Location and geocoding do no work. Code prepares reverse context for a saved target point, or its unique eligible earlier `previousPoint`. Forward queries belong to Location.

Initial requests and agent calls share six geocoding calls, a cache, cancellation and the run deadline. Location has at most eight model steps. `CATALOG_LOCATION_MODEL` defaults to the normal model. Missing credentials return bounded unavailable context.

Each addressed slot returns keep, set or clear for every text field. Coordinate actions are keep, clear, select a registered `pointId`, or `reusePrevious`. The latter needs no point ID: code binds the supplied earlier point to its Edition, version, pair and precision and rechecks it in the write transaction. Missing or ambiguous earlier points cannot be reused. Keep preserves only the target.

Source coordinate pairs remain beside their literal object and year context. Reverse results describe nearby objects and never create a replacement point. Unknown or wrong-target point IDs fail validation. Precise points need venue support; a city result cannot become an exact venue point. Missing optional coordinates do not force geocoding.

When an independent source establishes the Edition place, a matching selected forward geocoding candidate can supply its absent country. Location explicitly sets `countryCode` from that candidate and cites the place evidence. Editor checks the selected point and its country against the place evidence and any saved country baseline. The source passage need not repeat the country name. A query country filter alone is not evidence. This rule does not establish a venue, address or administrative area. Without an established place or an assigned candidate country, the country stays unknown.

## Validate the proposal

The system checks shape, assigned fields and fixed slot keys in original and revised proposals. Dynamic schemas expose assigned output fields. Code checks scope again after joining results and when it prepares catalog operations. Replacement operations can retain unassigned sibling links; only logical changes need permission. Editor returns cannot add a field or change a target. The two slots bound returned Editions; saved context has no Edition-count limit. Temporal choice, factual meaning and completeness remain model decisions assessed by evals.

Conflicting saved countries fail before source or model calls (`country_baseline_conflict`). General cites the countries where sources place the festival, even when both Edition slots are empty. The system compares those countries with the saved Edition countries before Editor. A conflict stops the whole refresh (`country_conflict`). The report names the countries and links to the source. Final Location actions also fail if they replace or clear a known country. Correcting a saved country requires a separate authorized correction.

The apply transaction rechecks every saved Edition ID/country; concurrent baseline changes abort all writes. The writer checks data rules, versions, and publication requirements. It can reject an invalid date, but it cannot tell whether a valid date is factually correct.

Before writing, ingestion checks the proposed schedule status and dates together with any saved values the plan keeps. If a `scheduled` Edition would lack a start or end date, the run reports `invalid_plan` and saves no catalog changes.

Accepted first-version limit: new Event slugs come from their names. If a distinct Event has the same generated slug as an existing Event or reserved alias, its item write fails and the run reports `write_failed`; the proposed slug remains visible in its operations. The run does not merge the two Events or choose a fallback slug automatically.

## Preview or apply

By default, the writer previews changes and rolls them back. The private run row and preview report persist, while catalog facts, versions, audits, and receipts roll back. A previewed new Event ID exists only in the report; the row’s `event_id` stays null. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts. A temporal target can reuse a saved Edition or create a new one when its assigned facts meet existing creation rules. The run does not fill omitted fields to satisfy a dependency. A proposed scheduled Edition without complete dates rejects the whole item. Ordinary unresolved work can leave independent supported changes available.

Only accepted assigned Editions use normal publication rules, including unchanged eligible targets. Their parent Event can publish. Unrelated saved Editions do not trigger publication. Event-only work preserves Event and Edition publication state, even with a published saved child. Preview and republish controls remain stronger than these rules. Current without a usable target makes no catalog changes. Full can update Event fields without a usable Edition. Scope has no separate creation, publication or recovery controls.

Use the [publication rules](../src/catalog/domain/festival-edition-publication.ts) to check why an Edition can publish or must stay a draft.

## Review the report

Use [saved source evidence](ingestion-tools.md#saved-source-evidence) to inspect canonical pages and Reader output. Keep these artifacts private.

Report version 8 stores the normalized scope directly, target outcomes under `previousEdition` and `currentOrNextEdition`, separate `checks.collection` and `checks.interpretation` results, and skipped roles with reasons. Target outcomes are `bound`, `absent`, `unresolved`, or `not_run`; bound targets retain their key and available ID. It separates research, editor, and Location status from the catalog outcome. It includes old/new changes with reasons, errors by stage, unresolved questions, source summaries, retrieval history, limits, and workload. Add and refresh retain the fixed run date; refresh also retains scope.

Raw model responses remain available, including invalid Editor output. Versions 7 and 8 can record each return with its path, owner, trigger, note and available result. A final local failure has an exact-path unresolved item and makes required research partial, even if the original role check was verified. An earlier failure that later recovers remains in repair history without making research partial by itself. A run can complete with partial research and saved independent changes. Its catalog outcome, operations and receipts describe the actual result. The workflow releases the native conversation when the attempt ends. Reports and workflow history keep the decisions and evidence used in the attempt. Omitted facts preserve saved values. Actual mutations and reasons also appear in the writer audit. No-op checks create no audit.

Every started attempt has a private `ingestion_runs` row and durable `runId`. Studio saves the final report automatically. Open the workflow's build-report step to inspect it. Saved-report inspection supports versions 7 and 8 and reports unsupported versions explicitly. Version 7 keeps its original check keys and meaning; no normalized scope is invented for old rows. See [report contracts](../src/ingestion/report.ts) for new reports and the [SQL skill](../src/mastra/catalog-assistant/skills/catalog-sql/SKILL.md) for saved inspection.

With `--apply`, success and partial results use the atomic writer. Failed research, editing or required Location writes nothing. Partial alone exits zero, as does a skipped duplicate add. Research, editor, Location or write failure exits nonzero. A write failure rolls back the entire Event item. The report retains research status, prepared operations, available raw research, editor and Location responses, source summaries, any name mismatch, and the write error. Applied `changes` stays empty; a separate proposed diff is not required. A partial result with no changes remains visibly partial/unchanged.

Ordinary research retries only explicit OpenRouter `provider_unavailable` errors, at most three times with 10-second, 30-second, and 90-second exponential backoff within the same run deadline. A bounded Mastra iteration allowance preserves ordinary research capacity during those unavailable retries; observed request counts still include them. Other model errors are not retried; completed research steps and tool results are retained.

Research defaults to 15 ordinary model steps, with tools disabled on the last step to reserve a final response. Set `CATALOG_MAX_AGENT_STEPS` for Studio to change that allowance. Reader checks a configurable whole-page input allowance with a reserve. Topic packets have a bounded input size and fail explicitly on overflow. Source-size/output limits, search safeguards and deadlines still apply. Linked pages have no traversal-depth limit. Provider context-window rejection is reported as a model failure.

Reports and explanations remain in private run history. Public details expose only ticket category labels and availability; amount/terms/variant URLs and research metadata remain private. Unknown category availability has no badge. Discovery and details never derive a global sold-out/closed label from variants.

Reports contain no application token or cost totals and no usage-completeness flag. `report.budget` holds search, page, model-call, elapsed-time and remaining-limit counters.

Inspect available token and estimated cost metrics in Mastra Observability. Treat missing metrics as unknown.

Lifecycle status (`running`, `completed`, `failed`) is separate from research status and catalog outcome. Partial/no-op and skipped attempts complete; research, editor, writer, or unexpected workflow failures finalize failed.

A late `workflow_failed` exits nonzero. Use the saved report and audit history to check for committed changes.

A start-write failure aborts before research. A finalization failure reports `run_persistence_failed` with the run ID and any available result. The command exits nonzero. Earlier commits remain and other refresh targets continue.

Abrupt interruption may leave a running row with null report, finish time, and final statistics, even after a catalog commit. That means completion is unknown. A rerun researches current state with a new runId and does not alter the earlier row. Event association is nullable and survives catalog deletion; use report operations’ `operationKey` to correlate saved audit changes.

## Evaluate ingestion

Use the [eval guide](ingestion-evals.md#run-evals) to test ingestion against fixed sources in a disposable catalog. Run cases from the CLI and inspect saved experiments in Studio.

## Inspect local agent traces

Logs and traces help diagnose execution. They are optional and best effort. They do not replace the durable run report or writer audit. See [Ingestion tools](ingestion-tools.md#local-trace-inspection) for recording, queries, and cleanup.

- Set `CATALOG_TRACING=true` for traces and native metrics. Set `CATALOG_LOGGING=true` independently for application and native SDK logs. Local commands keep both off by default. Compose enables both for Studio.
- Start Studio with logging or tracing before calling the catalog CLI. For separate eval runs with diagnostics, see the [eval guide](ingestion-evals.md#usage-and-storage-failures).
- Studio traces use the native workflow `runId`. Trace metadata retains the durable `ingestionRunId`, which matches the `runId` in application logs and saved reports. A missing trace does not mean the catalog write failed.
- Inspect retrieval status and reason codes separately from tool execution status. A completed tool can return a failed retrieval. Native technical success does not verify facts or catalog changes.
- The workflow root has the fixed name `catalog-ingestion`. Metadata identifies the Event, mode, native workflow run ID and durable ingestion run ID, with experiment IDs when available. Output copies only `researchStatus`, `editorStatus`, `locationStatus` and catalog `outcome`. Workflow steps and the report hold phase, validation and Edition details.
- Keep diagnostics private. Native spans and SDK logs can retain prompts, messages, model responses, tool results and errors. Mastra's standard `SensitiveDataFilter` redacts supported span secret fields; arbitrary text and logs have no general redaction guarantee. The application does not attach configuration credentials. Canonical source files are required private artifacts.

In Studio trace lists, use **Columns → Add metadata column** to show `eventName`, `scope`, and `outcome`. Add runs use the requested name and null scope. Refresh runs use the saved canonical name after context loads; their submitted scope is a preset name or custom task object. The report and attempt input hold the effective normalized definition. Outcome comes from the available final report. For an apply run, `published` means the run published an Event or Edition. For a dry run, it means the preview passed publication checks; catalog changes were rolled back. Outcome does not describe the current publication state of every record. Old traces are not rewritten.

Native tool spans retain their standard results. Application logs retain retrieval status, reason codes, method, URLs, caching and processing coverage. The workflow records initial source inspection as a separate step. No processor restores custom span fields after SDK completion.

Pino writes JSON to stderr and Mastra forwards calls to Studio Logs. Delivery uses native Mastra behavior. Events outside SDK contexts can have no top-level correlation; application log data retains the durable `runId`. Completed model commentary and returned reasoning are separate events, each limited to 4,000 Unicode code points. Studio assistant tools use the same logging configuration without enabling chat traces.

The workflow ends its root after report construction, settles children, then attempts flush before shutdown. Studio keeps its store open across attempts. SDK observability warnings and errors use native messages; application lifecycle guards retain fixed codes. Telemetry remains best effort and does not change model requests, budgets, retries, catalog writes, reports, scoring or exit status. See the [diagnostic tools](ingestion-tools.md#local-trace-inspection) and `src/ingestion/runtime/` for the contract and implementation.

### Execution metrics

Native metrics describe eligible agent, model, and tool operations. They do not provide a complete ingestion bill. Logging-only runs retain timestamped events, not native operation durations or token totals.

- Missing usage or pricing is unknown. Mock calls do not invent tokens or costs.
- Group model usage by `entityId` and `model` to distinguish Research, Editor, and Location.
- Sum cost only over `mastra_model_total_input_tokens` and `mastra_model_total_output_tokens`. Cache and reasoning details are subsets; adding their costs can double count usage.
- Cost uses provider-reported charges when available, including zero, or available SDK pricing estimates. Studio includes the reported `usage.cost` for each completed OpenRouter search request in Model Cost. This amount includes model inference and the Exa search.
- Cancellation and HTTP failure can leave partial usage. Metric presence does not prove a complete bill.
- Reports keep budget counters and do not calculate replacement cost totals. Historical runs are not backfilled.

Use the [total-token query](ingestion-tools.md#local-trace-inspection) to inspect saved metrics without running research. The store has no automatic retention.

## Add research notes

Add accepts one complete free-text note through CLI --input or Studio input. A name, URL, coordinates, and tentative details are search leads. The collector receives the full note. General and the page reader use inspected evidence and do not receive the raw note as an Event name.

A map page that repeats a supplied pin, or a reverse lookup that names its city, does not establish where the festival takes place. Without independent place evidence or a supported point, coordinates stay empty. If another source confirms only the Edition city, Location can use a registered city point with locality precision and leave the venue unresolved.

## Studio catalog chat

Use the [catalog assistant](ingestion-tools.md#studio-catalog-assistant) to find and add Events, refresh saved Events, and inspect reports. See [Background execution](ingestion-tools.md#background-execution) for batch progress and cancellation.

## Deploy the scope contract

Deploy the workflow, assistant tools, prompts, fixtures, report inspection queries and guides together. Use one Studio server for the queue. Stop the old server and back up private catalog and workflow storage before the update. No database schema migration is needed.

An older worker cannot execute saved custom requests or interpret version 8 reports. Before rollback, stop queue execution and keep the backup. Inspect pending and interrupted jobs before starting an older worker; do not let it consume custom jobs. Preset names remain valid requests, but new attempts use the preset and execution rules of the deployed worker. Keep version 8 history available to a compatible reader.
