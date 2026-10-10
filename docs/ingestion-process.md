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

Each festival attempt runs one Mastra workflow with eight sequential steps:

| Step | Responsibility |
| --- | --- |
| `initialize-run` | Validate input/settings and create the durable attempt before external work. |
| `load-context` | Load saved Event facts, editions, links, and vocabulary. |
| `read-initial-source` | Create the shared source session and read its initial saved link when available. |
| `research-festival` | Run the research agent with the shared source session and budget. |
| `prepare-candidate` | Validate the result and target, then prepare explained catalog operations. |
| `apply-catalog-item` | Preview or atomically apply eligible operations; retain write failures for the report. |
| `build-report` | Combine research, actual changes, source history, questions, and known usage. |
| `finalize-run` | Persist the private report, return the bounded summary and release owned resources. |

CLI and local Studio execute this same graph in their own Node process. Each attempt owns its budget, source session, intermediate work and private report. Credentials, pages and model output remain outside workflow state. The final step persists once; terminal hooks recover failures or cancellation that bypass it. Cleanup waits for active work. Finalization failure remains visible without repeating research or writes.

Workflow retries, snapshots and automatic restart are disabled. Per-step execution, resume, restart and time travel are unsupported. Start a fresh attempt against current catalog state after interruption.

## Start a run

```sh
npm run catalog -- add --name "Festival name"
npm run catalog -- refresh --event EVENT_ID
npm run catalog -- check --event EVENT_ID --event ANOTHER_EVENT_ID
```

`add` researches a festival by name and creates it only when new. A recognized existing Event returns `skipped` and its ID without updating facts, links, editions, or publication; use `refresh` or `check` to update it. `refresh` researches one existing Event. `check` uses the same research process for one or more Events. An Event is the continuing festival; each separate edition is an Occurrence. The database must already exist and be migrated. See the [development guide](development.md#local-catalog-research) for setup and options, or its [Studio instructions](development.md#local-studio-ingestion) for the local workflow form.

## Load catalog context

`refresh` and `check` load current facts and saved links for each selected Event. `add` loads catalog context to check whether the festival already exists.

## Research and propose facts

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. For `add`, the model discovers a source by festival name. The agent follows relevant links to answer open questions, searches when those links are not enough, and stops once it has useful facts.

When a direct page request returns HTTP 403 and `FIRECRAWL_KEY` is set in `.env`, ingestion tries Firecrawl once for that URL. Its raw HTML goes through the same Markdown extraction. The fallback consumes another page request and respects the remaining run time and response-size limit. Other HTTP errors do not trigger Firecrawl; without a key, 403 remains a blocked source.

### Choose facts and editions

The model decides which Event and edition each fact belongs to, then returns one result with `status`, `data`, `errors`, and `unresolved`. It can suggest dates, venues, prices, and links, but it cannot write to the catalog. It is instructed not to guess dates, prices, or an unannounced next edition; unknown facts can stay out of the proposal.

The result describes research completion, not announcement completeness. `success` means the relevant checks are complete; an announced year/date with no published venue or prices can succeed with omitted fields. After reasonable relevant checks, say “not found on inspected pages” unless explicit evidence supports “not yet announced”; describe those limits in source summaries without inventing or clearing facts.

`partial` requires useful data and a specific unfinished core check plus its cause in `unresolved`: an unrecovered relevant source failure, material conflict, or exhausted budget. Core checks cover identity, the latest completed or next announced edition/dates, location, and published ticket information; duplicate add needs only identity. Missing optional capacity, coordinates, socials, or a completed schedule status does not force partial. A recovered page failure can coexist with success. `failed` uses null data when no usable result exists. For refresh/check, repeating input identity, saved facts, or URLs is not a useful finding: unavailable sources with no usable findings require failed, not an empty partial candidate. Source-verified unchanged facts still count; duplicate-add identity matching remains sufficient. Errors describe execution problems; questions describe what remains unknown.

Each proposed fact has `{ value, reason }`. A reason explains its basis and why a correction supersedes the saved fact; it is required even for clearing or unchanged proposals. Event creation also needs `data.reason`. Existing Event names, aliases, and slugs stay unchanged; a different model `eventName` produces an informational `eventNameMismatch` in the report.

For example, an existing Event check can return:

```json
{
  "status": "partial",
  "data": {
    "eventId": "EVENT_ID",
    "eventName": "Example Festival",
    "sources": [
      {
        "url": "https://example.org/2027",
        "information": "2027 programme dates; ticket prices require an unavailable booking page."
      }
    ],
    "links": { "website": "https://example.org", "socials": {} },
    "editions": [
      {
        "key": "2027",
        "dates": {
          "value": {
            "startsOn": "2027-07-01",
            "endsOn": "2027-07-03",
            "state": "confirmed"
          },
          "reason": "The organizer confirms the full programme dates, replacing the tentative range."
        },
        "links": {}
      }
    ]
  },
  "errors": [
    {
      "code": "source_unavailable",
      "message": "The booking page could not be read."
    }
  ],
  "unresolved": [
    {
      "message": "Could not verify announced 2027 ticket prices because the linked ticket page was inaccessible.",
      "editionKey": "2027",
      "field": "tickets"
    }
  ]
}
```

### Preserve or replace values

Omitted fields preserve saved values. Explicit explained nulls clear only nullable facts. Dates are one complete start/end/state block; coordinates are one latitude/longitude/precision block. Clearing either clears the pair and sets its state or precision to unknown. Saved timezones remain unchanged, including after a move; new editions leave them unset. `scheduleStatus` is announced, scheduled, postponed, or cancelled; cancellation must be explicit. Classification adds terms then removes terms, so removal wins.

A supplied `tickets.value` replaces the complete `{ variants, basePrice }` block; omission preserves it and `{ "variants": [], "basePrice": null }` clears it. Eligibility-based concession tickets (such as youth, student, senior, or resident discounts) stay in variants but never set basePrice, including concession-only free admission. If only concession prices are known, basePrice is null. General-sale discounts are not excluded merely for being cheaper. Availability belongs to each labelled variant, including when its amount is unknown. An availability-only correction must still retain the complete intended ticket block. Inaccessible pages do not justify clearing saved facts.

All model amounts use major units and validated uppercase three-letter currency codes. Amount and currency must appear together. The adapter converts base-price `minAmount/maxAmount` to integer minor units using currency precision: EUR 100.50 → 10050, JPY 1000 → 1000, KWD 1.234 → 1234. Excess precision and unsafe integers fail without rounding. Variant amounts remain in major units. Exact/from bounds match; range maximum exceeds minimum. Free full-programme admission requires neither currency nor amounts; null base price means unknown.

Links have one Event website, optional instagram/facebook/youtube/tiktok/x/other social slots, and one ticket URL per edition. `x` accepts X or Twitter account URLs. The model assigns these directly; no second classifier runs. Each supplied slot replaces that owner's links of the same kind. Omitted or null slots preserve existing links; other owners and kinds are untouched.

`data.sources` describes useful inspected pages once, with URL and information found, including edition context and partial-page limits. It has no direct fact-to-page associations. Source summaries are separate from public links and the host's actual retrieval history.

## Validate the proposal

The system checks the proposal's shape and target IDs. The writer checks data rules, versions, and publication requirements. It can reject an invalid date, but it cannot tell whether a valid date is factually correct.

Accepted first-version limit: new Event slugs come from their names. If a distinct Event has the same generated slug as an existing Event or reserved alias, its item write fails and the run reports `write_failed`; the proposed slug remains visible in its operations. The run does not merge the two Events or choose a fallback slug automatically.

## Preview or apply

By default, the writer previews changes and rolls them back. The private run row and preview report persist, while catalog facts, versions, audits, and receipts roll back. A previewed new Event ID exists only in the report; the row’s `event_id` stays null. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts.

## Review the report

Version 2 reports show `researchStatus` separately from catalog `outcome`, explained old/new changes, staged `errors`, `unresolved` questions, `sourceSummaries`, and technical retrieval history in `sources`. Old report versions are unsupported; there is no legacy `gaps` fallback. Successful changes enter private audit history with old and new values; unchanged facts add no entry. Every started attempt has a `runId` shared by its private `ingestion_runs` row and output. The final report is saved automatically; use `--report PATH` to export a private JSON report that also retains the final `modelResponse` before normalization.

With `--apply`, success and partial results use the atomic writer. Failed research writes nothing. Partial alone exits zero, as does a skipped duplicate add. Research or write failure exits nonzero. A write failure rolls back the entire Event item while retaining research status, raw output, source summaries, and any name mismatch. A partial result with no changes remains visibly partial/unchanged. Ordinary research retries only explicit OpenRouter `provider_unavailable` errors, at most three times with 10-second, 30-second, and 90-second exponential backoff within the same run deadline. A bounded Mastra iteration allowance preserves ordinary research capacity during those unavailable retries; observed request counts still include them. Other model errors are not retried; completed research steps and tool results are retained.

Reports and explanations are private CLI output/files, not public website data or a separate hosted logging service. Public details expose only ticket category labels and availability; amount/terms/variant URLs and research metadata remain private. Unknown category availability has no badge. Discovery and details never derive a global sold-out/closed label from variants.

Token counts retain usage reported by completed model steps even if a later step fails or is interrupted. JSON reports set `usage.complete` to `false` when some usage is unknown; the CLI marks those token counts as `partial`. A full model cost is `null` (`unavailable` in the CLI) unless every call's usage and cost are known. A reported zero cost is preserved as zero. Search cost is a formula-based estimate, marked `usage.searchCostBasis=estimate` and labeled “estimated search USD”; retry attempts may contribute without proof they were billed. HTTP/Firecrawl supply no billed retrieval charges. Reports keep known tokens but discard a partial model-cost subtotal when full cost becomes unknown; completeness does not prove exact all-service spending.

Lifecycle status (`running`, `completed`, `failed`) is separate from research status and catalog outcome. Partial/no-op and skipped attempts complete; research, writer, or unexpected workflow failures finalize failed. A late `workflow_failed` preserves committed outcomes and known accounting, but exits nonzero. A start-write failure aborts before work; a finalization failure reports `run_persistence_failed` with runId/available result and exits nonzero without undoing commits or replaying research. Other check targets continue. Optional report-file failure does not change the finalized row.

Abrupt interruption may leave a running row with null report, finish time, and final statistics, even after a catalog commit. That means completion is unknown. A rerun researches current state with a new runId and does not alter the earlier row. Event association is nullable and survives catalog deletion; use report operations’ `operationKey` to correlate saved audit changes.

## Inspect local agent traces

Set `CATALOG_TRACING=true` to save one per-Event apply-run trace, including the initial source read and the agent's automatic model/tool spans. Tracing is off by default. Dry-run and fixture-injected candidates create no spans, even with the flag enabled; they create a store only when logging is independently enabled; their reports and durable run records still work. The shared log/trace file is `data/mastra-observability.duckdb`; `CATALOG_OBSERVABILITY_DATABASE_PATH` selects another local path, separate from catalog files/sidecars and the optional report. The old trace-path setting no longer selects recording or inspection; historical SQLite files remain untouched. DuckDB and the catalog remain separate. Close Studio before research, then reopen Studio after research exits.

The root's name and display name identify the canonical Event, mode, context edition and terminal result. For example, `Festival · ctx:2026 · created:2023 · check · partial` distinguishes saved context from the committed historical edition. Details retain up to ten entries per edition role with omitted counts. Keys and years are separate: `2026 [key:summer]`, corrected `2027 [key:2026]`, and unknown `? [key:2026]`. Years are never guessed from keys or dates. Unsaved discoveries stay in the private report.

Read spans show attempted/final URLs, retrieval outcome, technical reason, method, completeness, caching, and separate source/tool truncation observations; unobserved truncation is unknown. A normally completed tool can still say `failed:request_failed`. Search spans show the existing query, up to five candidate URLs and returned/retained/omitted counts, distinguishing successful empty searches, budget-reserved `not_run`, and failures. URLs keep their path, query and fragment, including token-like public values. Only their length is limited; tracing does not rewrite requests or detect secrets in public source text.

The root copies `researchStatus` and catalog `outcome` from the report, alongside structural/target validation, `semanticValidation=not_run`, write disposition and a single count of confirmed changed operations. `committed`, `unchanged`, `rolled_back`, `not_attempted` and `unknown` describe writing separately from research completeness; unknown disposition has a null count. A report failure after commit preserves confirmed changes. Native technical error status does not claim factual verification. Reports and durable run records retain their existing contracts, with no added trace reference.

Host-owned trace input/output/metadata contains explicit selected fields: Event/edition labels, source URL/status/method, retrieval and validation outcomes, write disposition and known committed counts. Call sites shorten selected trace URLs to 512 UTF-8 bytes, queries to 1,200 bytes and candidate URLs to five, retaining returned/retained/omitted counts where useful. There is no generic host projection allowlist or whole-record 8/16 KiB cap. Automatic SDK-generated spans may carry prompts, messages or tool payloads; their content is suppressed at source where supported or removed by the smallest necessary fail-closed export exclusion. The private v2 report retains final model output.

The workflow ends the root after report construction, settles open children, then awaits flush and shutdown attempts. DuckDB uses the supported `event-sourced` exporter strategy; final name fields and safe projections are retained after reload, while interrupted/background persistence remains best effort. Persistence is best effort: overlapping background writes/flush/shutdown and forced termination may lose traces. Custom buffers, queues and exporter patches remain deferred. Tracing does not change reports, budgets, provider retries, catalog writes, durable runs or exit status. The durable runId remains available in trace metadata and correlates with stored application logs.

If the SDK content exclusion fails, the affected span is dropped with a fixed content-free diagnostic. Application logs use a narrow origin marker so SDK-generated logs are not automatically forwarded. Observability failure diagnostics are fixed and do not include raw payloads.

Set `CATALOG_LOGGING=true` for selected application events at `CATALOG_LOG_LEVEL=info` (default), independently of tracing. Debug adds cache detail; warn/error restrict both sinks. Mastra PinoLogger uses ordinary level methods and scoped `child({...})` context. Stored events share the durable runId and available real trace/span IDs. Producers pass plain selected objects; source events retain character count and response status/URL without Markdown or full responses. Commentary and returned reasoning are separate completed-step events, each shortened explicitly with `shrinkText(text)` to at most 4,000 Unicode code points. Producers can include original/retained counts and a shortening flag. There is no generic field allowlist, recursive payload processing or whole-record 8 KiB cap.

Preparation events include selected identity, edition keys/actual years, proposed field names/counts, validation codes/paths and model-reported unresolved question previews. Write events identify dry-run versus apply, affected IDs/field names and disposition. The “Research finished” message follows successful durable finalization; “Required run finalization failed” includes `errorCode: run_persistence_failed` and preserves the original error and any already committed changes. The final report retains complete values and diffs. Logging never adds model/provider requests or changes budgets/retries. Native Pino JSON on stderr and Studio records carry the selected fields. Completed-step text can follow tool outcomes, and unfinished-step text may be absent. SDK/config credentials are never selected as log arguments. No arbitrary credential redaction is promised for selected model commentary or reasoning; source diagnostic fields are not scanned for token-like public values. Completed commentary may include candidate text, while full provider response envelopes remain excluded.

Run `npm run catalog:studio` to inspect saved logs and traces after research exits. Studio runs on localhost without model credentials or a catalog connection and registers no agents or mutation workflows. See the [development guide](development.md#local-trace-inspection) for commands and cleanup.

The [source workflow specification](../openspec/specs/catalog/source-workflow/spec.md) defines the detailed behavior.
