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

## Start a run

```sh
npm run catalog -- add --name "Festival name"
npm run catalog -- refresh --event EVENT_ID
npm run catalog -- check --event EVENT_ID --event ANOTHER_EVENT_ID
```

`add` researches a festival by name and creates it only when new. A recognized existing Event returns `skipped` and its ID without updating facts, links, editions, or publication; use `refresh` or `check` to update it. `refresh` researches one existing Event. `check` uses the same research process for one or more Events. An Event is the continuing festival; each separate edition is an Occurrence. The database must already exist and be migrated. See the [development guide](development.md#local-catalog-research) for setup and options.

## Load catalog context

`refresh` and `check` load current facts and saved links for each selected Event. `add` loads catalog context to check whether the festival already exists.

## Research and propose facts

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. For `add`, the model discovers a source by festival name. The agent follows relevant links to answer open questions, searches when those links are not enough, and stops once it has useful facts.

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
    "sources": [{ "url": "https://example.org/2027", "information": "2027 programme dates; ticket prices require an unavailable booking page." }],
    "links": { "website": "https://example.org", "socials": {} },
    "editions": [{
      "key": "2027",
      "dates": {
        "value": { "startsOn": "2027-07-01", "endsOn": "2027-07-03", "state": "confirmed" },
        "reason": "The organizer confirms the full programme dates, replacing the tentative range."
      },
      "links": {}
    }]
  },
  "errors": [{ "code": "source_unavailable", "message": "The booking page could not be read." }],
  "unresolved": [{ "message": "Could not verify announced 2027 ticket prices because the linked ticket page was inaccessible.", "editionKey": "2027", "field": "tickets" }]
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

By default, the writer previews changes and rolls them back. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts.

## Review the report

Version 2 reports show `researchStatus` separately from catalog `outcome`, explained old/new changes, staged `errors`, `unresolved` questions, `sourceSummaries`, and technical retrieval history in `sources`. Old report versions are unsupported; there is no legacy `gaps` fallback. Successful changes enter private audit history with old and new values; unchanged facts add no entry. Use `--report PATH` to save a private JSON report that also retains the final `modelResponse` before normalization.

With `--apply`, success and partial results use the atomic writer. Failed research writes nothing. Partial alone exits zero, as does a skipped duplicate add. Research or write failure exits nonzero. A write failure rolls back the entire Event item while retaining research status, raw output, source summaries, and any name mismatch. A partial result with no changes remains visibly partial/unchanged. Automatic retries are not configured.

Reports and explanations are private CLI output/files, not public website data or a separate hosted logging service. Public details expose only ticket category labels and availability; amount/terms/variant URLs and research metadata remain private. Unknown category availability has no badge. Discovery and details never derive a global sold-out/closed label from variants.

The [source workflow specification](../openspec/specs/catalog/source-workflow/spec.md) defines the detailed behavior.
