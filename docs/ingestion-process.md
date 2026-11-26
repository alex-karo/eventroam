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

Open the [architecture map](../README.md#architecture) for **Festival ingestion**. Select **Sequence** to see how Research uses page summaries and links to choose the next page, then compare the default preview with an explicit apply. From **Reader**, open **Evidence and editorial review** to follow the selected passages through General, the four specialists, and Editor.

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
| `initialize-run`, `load-context` | Validate the request and create the durable attempt. Check add notes for a known Event before source work. Load saved facts only for a refresh target. |
| `read-initial-source` | Save the initial source and run Reader. |
| `collect-sources` | Research chooses sources; freeze the source list and evidence after admitted work settles. |
| `general-facts` | General confirms source identity and selects the two Edition slots. It does not compare Events or decide duplicates. Runs without a known Edition stop here. |
| `tickets`, `classification`, `location`, `links` | Four independent parallel branches use the same frozen corpus and shared deadline. |
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

`add` researches one note about a possible Event. It checks for a saved Event before source collection. A recognized existing Event returns `skipped` and its ID without changes; use `refresh` to update it. `refresh` researches distinct Events independently. Add and `--scope full` (default) check both festival descriptions, shared links, the latest completed Edition, and the ongoing or nearest announced future Edition. Both Edition slots may create new records. `--scope current` checks only the ongoing or nearest announced future Edition. Other saved history and farther future Editions provide context for matching, country checks, and classification reuse. A run needs a selected Edition or a saved Edition with `scheduled` or `announced` status. If neither condition holds, it stops before specialists and reports “Insufficient information about editions”. Current scope with a qualifying saved Edition and no selected target reports an unchanged catalog. Unresolved selection can still make research partial.

Current assumes a prior full run established Event identity/shared links. It omits Event findings and focuses on Edition dates, schedule status, location, tickets, and classification. Size, precise coordinates, and detailed address are optional checks. `check` is unsupported. The database must already exist and be migrated. See the [ingestion tools](ingestion-tools.md#cli-research) for setup and options, or its [Studio instructions](ingestion-tools.md#local-studio-ingestion) for the workflow form.

## Load catalog context

`refresh` loads current facts and saved links for its selected Event. `add` checks for duplicates locally and loads taxonomy, without loading saved Events or Edition history into research context. Research receives shared evidence/output rules plus only its add, full or current assignment; omitted refresh scope selects full. The full prompt does not include current-only stop/completion exceptions.

Before Reader or any source or model call, add checks the complete saved Event name and aliases in the note. Country and URL are optional extra signals. One name candidate with a matching known country can return `skipped` without a URL. A full official Event URL can resolve a name candidate when country is absent or unknown. A name alone or shared hostname is insufficient. Missing country keeps a candidate in consideration. Conflicting signals, conflicting saved countries, and unresolved candidates continue ordinary research.

Country input uses an assigned two-letter code as a complete comma-, semicolon-, or line-separated field, or after `country:`. Case does not matter. For example, `example fest, us` can skip one saved US Event. Text inside matched names and URL tokens supplies no country code. Other country wording stays available for ordinary research. Several explicit countries prevent an early skip.

The check compares full official Event URLs, including social links. A different path, such as saved `https://example.com/` and supplied `https://example.com/en/index`, does not block a unique name-and-country match. A shared host alone cannot resolve a match. An exact URL for a different Event is a conflict.

This local check reads names, country codes, and relevant link fields. An early match loads no full catalog or Edition history. It trusts the note and saved catalog without fresh source confirmation. Incorrect input or different Events with the same name and country can cause a wrong skip. Use refresh to update an existing Event. If the shortcut does not apply, the full original note reaches ordinary collection. Unresolved adds send no saved Event list to Research or General. General establishes source identity and selects Editions; it does not check the catalog for duplicates. A missed local match can lead to a duplicate Event. The local check does not prove uniqueness.

## Research and propose facts

A supported announcement with a complete current programme date range uses `scheduled`, including replacement or provisional dates. Without a complete range it uses `announced`. An active cancellation uses `cancelled`. An announced postponement with no complete replacement range uses `postponed`; saved dates can be the old dates. A postponement alone does not justify clearing those saved dates. Once a complete replacement range is supported, the same Edition uses `scheduled`. `EventRescheduled` with current dates does not mean `postponed`. Keep the move and its evidence in the proposal or review reason. `dateState` records the certainty of the stored range, not whether it is the old or replacement range.

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. Research completes relevant known and linked page reads before using `searchWeb`. Search needs remaining budget and one question the inspected pages leave open.

- Find an official source if no inspected official page confirms the Event.
- Resolve incompatible dates for the same programme. A notice that replaces earlier dates resolves the conflict.

A full programme range reported in the overview or coverage completes date collection. General uses the collected sources to select the Edition. An explicit notice from the organizer that the next Edition is unannounced or its dates will follow closes the date question. Gather ticket, programme, and other optional details from known and linked pages.

Use known and linked sources to determine whether a past Edition took place. Leave its outcome unresolved if those sources provide no confirmation.

Collect the country, town, venue, address and coordinates from inspected pages, including useful travel and contact links. An office, hotel or parking area qualifies only if the source places the programme there. Publication requires an established country. Town, venue, address and coordinates are optional.

The `searchWeb` description asks for at most one call per model step. A repeat needs an open question and a different likely source. Use search highlights as leads and read destination pages for evidence. Search and page reads share the run limits. A fatal collection error blocks further requests to the search provider. Search uses the OpenRouter Exa plugin in its default mode.

Research must copy supplied and returned URLs exactly into `inspectPage`. It must not shorten, translate or rewrite their paths.

`readPage` retrieves Markdown, including supported My Maps points, source labels and years. Collection saves this text and gives it to Reader. Research receives a compact `inspectPage` result with the source identity, overview, page coverage, navigation leads, retrieval and processing outcomes, limitations and remaining budget. Coverage names collected information and explicit statements of nonpublication. Location coverage distinguishes a collected festival venue/address from only a town, country or office. Research does not seek the same place again merely because the short label omits its literal value or Edition year; Location checks the full quotation. Page silence is unknown. This helps Research choose pages; it does not support catalog changes or remove required checks. Research does not receive the page body. Reader extracts evidence without choosing a venue or Edition. A readable page can still have a limitation, so inspect its reason code and notices.

See the [source reader guide](source-reader.md) for extraction, Firecrawl fallback, map support, caching, response limits, and checks.

### Choose facts and editions

General selects identity and temporal targets from source evidence. Field specialists propose values. Models return domain decisions, check findings and unresolved questions. Code creates execution statuses, safe errors, skip reasons and report completion status. A verified unchanged field counts as completed work; a missing proposal does not certify a check. Each assigned role must account for its own checks.

A missing optional value can remain unknown without failure. An unfinished assigned check makes usable research partial. If General cannot confirm Event identity after useful collection, research remains partial, the catalog outcome is failed and no changes are prepared or written. Failed required output or no usable evidence stops writes. Source-verified values can remain useful after an unrelated retrieval failure.

### Agent contracts

| Agent | Input and prompt purpose | Output | Tools |
| --- | --- | --- | --- |
| Research | Concrete collection instructions, permitted sources, checks, page overviews, page coverage and remaining budget. No raw mode or scope. | Check keys, source IDs and nullable source acquisition blockers; distinct owner questions. | `inspectPage`, permitted `searchWeb` |
| Reader | One whole canonical page with numbered segments and extraction instructions. | Page overview, found information, explicit nonpublication, topics, years and segment selections. Code restores the literal passages and derives anchors. | None |
| General | Source evidence, assigned permissions, and one saved Event with its chronology for refresh. No Event list for add. | Source identity or uncertain decision, fixed Edition targets and common facts. | None |
| Tickets | Current or next target, saved ticket block and ticket evidence. | One complete observed variants/base-price replacement, or omission. | None |
| Classification | Fixed targets, saved terms and history, vocabulary and relevant evidence. Add and full also receive saved descriptions. | Complete term lists and optional festival descriptions on add and full. Term reuse includes an earlier Edition key and a continuity reason. | None |
| Location | Fixed targets, saved places, literal evidence, registered points and prepared reverse context. | Complete place decisions and registered point selection. | Forward `geocode` |
| Links | Fixed public slots, saved links, permissions and link evidence. No Tickets output. | Event website/social actions and current-or-next ticket link; omitted candidates and reasons. | None |
| Editor | Submitted proposals, eligible omissions, review paths, cited evidence, saved values, registered points and saved Markdown paths. Classification and description reviews also receive collected programme evidence. | One decision and note per required path, plus any eligible omission it returns. | Native Mastra workspace grep |

See [agent code and ownership](project-structure.md#ingestion-ownership), [proposal assembly](../src/ingestion/proposals.ts), and [catalog preparation](../src/ingestion/catalog-plan.ts). Code assigns an evidence ID to each bound quotation. Editor receives one list of passages by ID. Proposed facts and repair records refer to entries in that list by `evidenceIds`.

Research reports source acquisition separately from interpretation. Each assigned collection check contains its key, relevant source IDs and `blocker`. A null blocker means no specific acquisition gap remains; it does not certify semantic sufficiency. A non-null blocker is a short text reason. Its field description recommends at most 300 characters; longer reasons remain valid and are retained in full. It names the source need and cause, such as an inaccessible source, unread lead, unprocessed text, missing required source or unresolved source conflict. It has no type or category. Only the affected check receives that blocker. General and specialists assess the full evidence and saved context. Missing fresh genre names or broader description alone does not require another source. A specialist finding cannot remove a real collection blocker. Missing collection checks still make research partial. Code copies a blocked check key and cause into the report's unresolved items, even when no informative source summary is available. Separate model questions contain only a short message for an owner decision; they do not repeat check gaps or select fields or Editions. Research has no completion summary or empty evidence-reference arrays. General and specialists retain their source support and interpretation reasons. Saved evidence and report completion rules stay in use.

Decision reasons, owner questions, source summaries and diagnostics use length guidance in field descriptions instead of hard character limits. The same rule applies to Reader overviews, coverage labels, scope hints, uncertainty, year labels and limitations. Required nonempty text, exact source binding, catalog field validation and context budgets still apply.

Reader returns only `quote` and `topics` for self-contained evidence. It adds `context`, `editionClues` and `uncertainty` together when any is needed. Code fills empty metadata when it binds the passages. An invalid context selection discards the whole evidence item. General receives its identity task, field permissions, check keys and relevant saved facts, without other roles' instructions, prices, taxonomy or coordinates. Editor receives the allowed decision paths and actions. Links lists only material ambiguous candidates in `omitted`, not routine rejected navigation or unrelated URLs; supported social accounts still need a proposal or ambiguity explanation.

### Choose the refresh target

General receives the fixed date, saved Edition keys, dates and time zones, relevant literal evidence, and concrete field permissions. It chooses the latest actually completed Edition and the ongoing Edition, otherwise the nearest supported announced future Edition. Keys stay stable across date corrections. Different realizations in one year can have separate keys. Saved history supplies context, not source proof.

Ongoing wins through the inclusive local final day; otherwise select the nearest supported future start. Ties, overlaps, uncertain ordering/matching remain unresolved. A sole future year-only announcement can qualify. Keys remain stable across corrected dates/years.

Several programme periods of one realization use one key, the first start date, and the last end date. The inclusive range includes gaps and remains ongoing during those gaps. Distinct realizations can share a year. Saved statuses do not exclude candidates without inspected evidence.

A cancelled or postponed Edition without a completed programme cannot be previous. An explicit statement that the applicable past programme ended can establish completion unless other evidence shows cancellation or an unresolved postponement. `EventRescheduled` metadata alone does not contradict completion. A completed programme with a complete date range uses `scheduled`, including when the saved status needs correction from `postponed`. Completion determines the previous slot; `completed` is not a schedule status. An active cancellation or a postponement without replacement dates is excluded from current/next, even when saved dates are in the future. If no eligible candidate remains, that slot is null and excluded saved Editions stay unchanged. Supported replacements retain the matched key.

Run full before current to establish Event identity and shared links; this is an operating precondition, with no stored flag or run-history check.

Current applies the search rules above to the ongoing or next Edition. A supported venue, locality or programme change within the saved country does not alone contradict Event identity or require full refresh. An absent saved locality is unknown. Source evidence must still establish the Event name and association. If a material identity or country conflict remains, current stops before editing and requests a full refresh.

Full can correct the Event website after an inspected page confirms its official association. An unresolved material identity contradiction blocks writes and publication. Full returns partial with useful target findings, otherwise failed/null.

### Preserve or replace values

Ticket variants need an observed price, explicit availability or concrete admission terms. A category name or referral to an unread checkout alone stays an unresolved question, even when amount and currency would be absent. Editor returns a whole ticket block that contains such an unsupported variant while a return is available. Tickets can remove the unsupported variant or withdraw the block. At the return limit, Editor can reject the block. Supported unknown-price offers remain valid.

General owns common Edition facts, including attendance. Record the year and count qualifications in the attendance reason. Specialists own their fixed fields. A proposed change carries evidence IDs and a reason. Omission preserves saved data. A permitted clear needs affirmative support. New targets need source support. Editor validates meaning and applicability; it cannot supply a new value.

Dates, each ticket block, classification and each location bundle are indivisible review groups. Identity rejection stops the item. Rejection of a temporal premise removes that target and dependent changes without reassignment. Optional rejection preserves the saved field. An accepted target can still qualify for publication when all optional proposals are rejected.

Classification supplies one vocabulary slug for `eventType` and `format`, and lists of slugs for `topics`, `genres` and `cultures`. An omitted or null field keeps its saved terms. An empty list clears a field that accepts a list. Added or removed terms need source evidence. If evidence refutes a saved type or format and supports no replacement, Classification reports the conflict in `unresolved`. The application resolves slugs to term IDs and builds the complete term list for Editor. Explicit `reuseFrom: { editionKey, reason }` identifies an eligible earlier saved Edition of this Event and explains continuity. It need not be the nearest Edition. Preparation validates facets before removing redundant ancestors and records a deterministic explanation.

When the selected Edition's programme is unclear, Classification can infer a topic from the official name and a substantial programme for that topic at an earlier Edition of the same Event. Cite evidence for both facts and check current sources for changes. Apply the other vocabulary requirements for the topic.

On add and full, Classification also reviews both festival descriptions, including full refresh with empty target slots when a saved Edition passes the gate. Classification writes three to five sentences about the current format and atmosphere for the detailed text and one or two sentences about the current format for the short text. It uses the present tense and omits the festival name from both texts. Use the latest known format unless sources announce a change. Leave dates, lineups, prices, directions, attendance and one-time details in Edition data. Each optional field has its own proposal and Editor decision.

Tickets processes only `currentOrNextEdition`, including an ongoing festival. Historical ticket blocks stay unchanged. A supported replacement contains supported ordinary admission variants and a nullable base price. Payment-plan offers and terms are excluded. Their details do not require owner questions or keep ticket checks unfinished. Admission prices are not calculated from payments. Concessions, day tickets and upgrades cannot establish the full-programme base price. No supported replacement means preservation of the whole saved block, including any old URLs. New ingestion offers have no URL field. Other catalog operations retain their offer URL support.

Model amounts use major units and validated uppercase currency codes. Base-price conversion to minor units uses each currency's precision without rounding. Variant amounts stay in major units. Tickets uses the seller's currency for each published price. When the currency is implicit, the sale market and price notation can establish the local currency. Tickets explains inferred or corrected currencies in the proposal reason and cites the source. If the currency is unknown, the literal price stays in the offer terms. A separate qualifying price can establish the base price. If the seller shows the same offer in several currencies, its primary published price can establish the base price. Editor checks the same support in initial and repeat reviews. Availability and qualifications belong to each offer. Closed sales do not imply sold out.

Links works independently from Tickets. It owns one Event website, social slots, and one current-or-next ticket link. Prefer a ticket overview. Without an overview, one distinct supported product destination can qualify; repeated anchors do not create several destinations. Unread checkout can be a supported link but cannot prove a price. Preserve meaningful query parameters. Historical ticket links remain unchanged.

### Accepting research values

Editor uses the same fixed date as General and Location. It approves supported field proposals. It returns a disputed proposal to its owner while a return is available. The note names the disputed claim and asks for a supported correction or withdrawal of the whole group. Editor can also return an eligible omission when evidence supports a concrete correction. An absent optional value alone does not require a return. The specialist decides the value under its original instructions. Editor can approve a supported revision or explained withdrawal without using further returns.

The model reply has one decision for each required path, such as `event.fields.shortDescription` or `currentOrNextEdition.fields.tickets`. A separate list holds requests for missing facts with a live owner and returns available. An absent group needs no approval or rejection. The report records all accepted decisions as a list by path. General owns common Edition facts. Classification owns terms and both descriptions. Tickets owns ticket prices and variants. Links owns website, social and ticket URLs. Location owns each Edition's place. Item and target decisions allow approval or rejection. Edition selection stays fixed.

Validation can return a group before the first Editor review if the rule identifies its owner and group. The workflow first checks the whole reply for invalid targets, country conflicts, and unknown evidence, source, or point references. These boundary failures still stop writes. An unknown term or reuse Edition can go back to Classification with the invalid value and the rule for choosing a replacement.

Each group can return up to three times in total. Validation, Editor review, and local reply corrections share this limit. The workflow sends one request per owner in each round. It merges valid requested groups and retries only groups with local errors. A valid peer revision stays available for Editor. A local error does not stop another owner. An omitted revision needs a reason for its full group path. An approved withdrawal preserves the saved value and settles that question. Repair history retains the reason. Other open questions, unfinished assigned checks, source limitations and final group failures can still make research partial.

At the limit, code rejects a group that still has a local validation error. It removes that proposal and its dependent changes. It cannot restore the disputed original proposal. The first Editor review includes usable validation repairs. Later reviews decide only usable groups from that return round. A valid third revision can still receive approval. A submitted field allows approval or return while its owner and allowance are available. When a return is unavailable, it allows approval or rejection. All accepted changes pass the normal publication and atomic write checks.

If a complete Editor reply fails validation, Editor can correct it once. The request states the failed rules and keeps the same review paths, allowed decisions, missing groups and saved-page results. The correction uses the shared deadline. A second invalid reply stops the run before catalog writes.

Editor checks proposals against their evidence, saved values and related proposals. It reads the full relevant passage to check what it establishes for the Event, Edition and field. If the evidence leaves a specific issue open, Editor can search a relevant saved page under its search rules. It returns an eligible group with the source and an exact excerpt when the evidence supports a correction or supplies a concrete missing fact.

Editor uses native workspace grep. The workspace lists exact file paths, URLs and available overviews. Code checks the source hash before each search. Before approving a new or changed fact in a returned group, Editor checks the saved page for the fact and its context. This also applies to the first review after a validation return.

Returning specialists use their original input and the return note. The note can contain an excerpt from a saved page. Specialists have no tools on a return and can use an empty evidence list for the returned group. The workflow checks any references they supply and keeps the Reader evidence intact. Location can use a previously registered point.

## Resolve location

Location runs in parallel with Tickets, Classification and Links after General. It receives both selected targets, evidence, saved places and the saved detailed description when available. Code prepares reverse context for a saved target point, or its unique eligible earlier `previousPoint`. Forward queries belong to Location.

Initial requests and agent calls share six geocoding calls, a cache, cancellation and the run deadline. Location has at most eight model steps. `CATALOG_LOCATION_MODEL` defaults to the normal model. Missing credentials return bounded unavailable context.

Each addressed slot returns keep, set or clear for every text field. Coordinate actions are keep, clear, select a registered `pointId`, or `reusePrevious`. The latter needs no point ID: code binds the supplied earlier point to its Edition, version, pair and precision and rechecks it in the write transaction. Missing or ambiguous earlier points cannot be reused. Keep preserves only the target.

Source coordinate pairs remain beside their literal object and year context. Reverse results describe nearby objects and never create a replacement point. Unknown or wrong-target point IDs fail validation. Precise points need venue support; a city result cannot become an exact venue point. Missing optional coordinates do not force geocoding.

When an independent source establishes the Edition place, a matching selected forward geocoding candidate can supply its absent country. Location explicitly sets `countryCode` from that candidate and cites the place evidence. Editor checks the selected point and its country against the place evidence and any saved country baseline. The source passage need not repeat the country name. A query country filter alone is not evidence. This rule does not establish a venue, address or administrative area. Without an established place or an assigned candidate country, the country stays unknown.

## Validate the proposal

The system checks shape and same-slot keys. Current requires `previousEdition:null` and no description or shared-link findings or actions. Classification omits both description fields from its current-scope schema. Code checks scope again after joining the specialist results. The two slots bound returned Editions; saved context has no Edition-count limit. Temporal choice, factual meaning and completeness remain model decisions assessed by evals.

Conflicting saved countries fail before source or model calls (`country_baseline_conflict`). General cites the countries where sources place the festival, even when both Edition slots are empty. The system compares those countries with the saved Edition countries before Editor. A conflict stops the whole refresh (`country_conflict`). The report names the countries and links to the source. Final Location actions also fail if they replace or clear a known country. Correcting a saved country requires a separate authorized correction.

The apply transaction rechecks every saved Edition ID/country; concurrent baseline changes abort all writes. The writer checks data rules, versions, and publication requirements. It can reject an invalid date, but it cannot tell whether a valid date is factually correct.

Before writing, ingestion checks the proposed schedule status and dates together with any saved values the plan keeps. If a `scheduled` Edition would lack a start or end date, the run reports `invalid_plan` and saves no catalog changes.

Accepted first-version limit: new Event slugs come from their names. If a distinct Event has the same generated slug as an existing Event or reserved alias, its item write fails and the run reports `write_failed`; the proposed slug remains visible in its operations. The run does not merge the two Events or choose a fallback slug automatically.

## Preview or apply

By default, the writer previews changes and rolls them back. The private run row and preview report persist, while catalog facts, versions, audits, and receipts roll back. A previewed new Event ID exists only in the report; the row’s `event_id` stays null. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts.

Use the [publication rules](../src/catalog/domain/festival-edition-publication.ts) to check why an Edition can publish or must stay a draft.

## Review the report

Use [saved source evidence](ingestion-tools.md#saved-source-evidence) to inspect canonical pages and Reader output. Keep these artifacts private.

The current report separates Research, Editor, and Location status from the catalog outcome. It includes field changes with reasons, errors by stage, unresolved questions, retrieval history, limits, and budget counts. Source summaries contain the source URL and Reader overview. Research blockers appear in unresolved questions. Add and refresh retain the fixed run date. Refresh also retains scope.

An early add skip has optional `inputDuplicate` with the Event ID, matched name or alias, and supporting `countryCode` or full `officialUrl`. Older reports can omit this field. Here, `researchStatus: "success"` means the early rule completed. Research, Reader, General, Editor, and Location do no work. Source lists, model responses, operations, receipts, and changes are empty, and page, search, and model-call counts are zero. The durable attempt completes with the existing Event ID in preview and apply. This report records a request/catalog match. Older reports can contain a General duplicate decision from inspected sources; new runs check duplicates only before source collection. Failed and missing reports remain distinct.

Report version 8 keeps the response `object` for General, Classification, Editor, and Location. For response errors, it also keeps available `text`. Inspect workflow history for successful reply text when the provider returned it. The report can record each return with its path, owner, trigger, note and available result. A final local failure has an exact-path unresolved item and makes research partial, even if the original role check was verified. An earlier failure that later recovers remains in repair history without making research partial by itself. A run can complete with partial research and saved independent changes. Its catalog outcome, operations and receipts describe the actual result. The workflow releases the native conversation when the attempt ends. Reports and workflow history keep the decisions and evidence used in the attempt. Omitted facts preserve saved values. Actual mutations and reasons also appear in the writer audit. No-op checks create no audit.

Every started attempt has a private `ingestion_runs` row and durable `runId`. Studio saves the final report automatically. Open the workflow's build-report step to inspect an ordinary report. An early report is in load-context and the final saved state. The catalog SQL skill supports report versions 7 and 8. See the [report contract](../src/ingestion/contracts.ts) for the current shape.

With `--apply`, success and partial results use the atomic writer. Failed research, editing or required Location writes nothing. Partial alone exits zero, as does a skipped duplicate add. Research, editor, Location or write failure exits nonzero. A write failure rolls back the entire Event item. The report retains research status, prepared operations, available reply objects, source summaries, any name mismatch, and the write error. Applied `changes` stays empty; a separate proposed diff is not required. A partial result with no changes remains visibly partial/unchanged.

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

In Studio trace lists, use **Columns → Add metadata column** to show `eventName`, `scope`, and `outcome`. Add runs use the requested name and null scope. Refresh runs use the saved canonical name after context loads; their scope is `full` or `current`. Outcome comes from the available final report. For an apply run, `published` means the run published an Event or Edition. For a dry run, it means the preview passed publication checks; catalog changes were rolled back. Outcome does not describe the current publication state of every record. Old traces are not rewritten.

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

## Inspect ingestion metrics in PostHog

Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` in production
Studio. Leave them empty for local runs. `CATALOG_TRACING` controls AI traces
separately.
Use `run_id` to link stage events to the durable ingestion run. Filter by
`mode`, `scope`, and `dry_run` to compare equivalent runs.

| Event | How to read it |
| --- | --- |
| `ingestion_research_finished` | Average `pages_read` for unique URLs read successfully per run, including the initial source. Average `searches_completed` for completed provider searches per run. A completed search can return zero candidates. For coverage, sum `checks_with_evidence` and divide by the sum of `assigned_checks` on events that have `checks_with_evidence`. This includes zero coverage and excludes runs without a valid summary. Show the share of events with a valid summary next to coverage. A covered check has no blocker and cites a page with bound evidence. |
| `ingestion_reader_finished` | One event per canonical page that reaches Reader. For `complete` or `limited` pages, average `evidence_count` and `marked_percent` to give each page equal weight. For the share of all processed text, divide the sum of `marked_utf16_units` by the sum of `page_utf16_units` and multiply by 100. Marked area includes quotes and context. Overlapping ranges count once. Skipped and failed pages have no coverage value. |
| `ingestion_editor_finished` | One event per review with duration, review calls, and status. Review calls count Editor invocations. |
| `ingestion_editor_group_reviewed` | For first-pass approval, use groups with `first_proposed=true` and a `first_decision`. Count the share with `first_decision=approve`. Track proposed groups without a first decision separately. `proposal_returns` counts returns of present proposals. `omission_returns` counts returns of missing proposals. Count one return per group per round when its owner revision starts, even if validation retries it. `validation_returns` counts returns before the first review. An approved group can still depend on other groups and on a successful catalog write. |
| `ingestion_catalog_write_finished` | For actual catalog changes, filter by `dry_run=false` and sum `changed_operations`. Use `outcome` to group write results, including `unchanged` and `failed`. `changed_operation_kinds` lists the kind of each changed operation. |

Events contain counts, fixed values, and technical IDs. They use no person
profiles. The SDK sends queued events in the background when the queue reaches
20 events or its 10-second timer expires. When the sender starts to shut down,
it drops new events and gives the SDK up to two seconds to send pending events.
Delivery is best effort. Use the catalog audit for confirmed writes when a
stage event is missing. Eval experiments do not send stage events.

## Add research notes

Add accepts one complete free-text note through CLI --input or Studio input. The [early duplicate check](#load-catalog-context) can use a complete name or alias with country or URL support to skip a saved Event. This is an exception to the search-leads rule for skipping only. Other notes reach the collector unchanged. New facts need inspected evidence. General and the page reader use that evidence and do not receive the raw note as an Event name.

A map page that repeats a supplied pin, or a reverse lookup that names its city, does not establish where the festival takes place. Without independent place evidence or a supported point, coordinates stay empty. If another source confirms only the Edition city, Location can use a registered city point with locality precision and leave the venue unresolved.

## Studio catalog chat

Use the [catalog assistant](ingestion-tools.md#studio-catalog-assistant) to find and add Events, refresh saved Events, and inspect reports. See [Background execution](ingestion-tools.md#background-execution) for batch progress and cancellation.
