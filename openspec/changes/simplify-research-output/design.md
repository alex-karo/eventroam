# Design

## Context

See [proposal.md](proposal.md). The flow is `researchFestival → prepareResearch → applyCatalogItem → buildResearchReport`. The writer already supplies atomicity, actual old/new values, and no-op detection. Current recursive wire normalization would remove the new `data: null` failure marker.

## Goals / Non-Goals

**Goals:** One typed research decision with structural ownership and explained changes.

**Non-Goals:** Extra classifier/verifier calls, confidence scoring, source registry, partial transaction salvage, database audit changes, or historical-link cleanup.

## Decisions

### 1. Envelope and diagnostics

Always return `{ status, data, errors, unresolved }`; both arrays are required.

| Status | Meaning | Constraints |
| --- | --- | --- |
| `success` | Requested research complete, possibly unchanged | Non-null data; optional unknowns may remain |
| `partial` | Useful findings, material research incomplete | Non-null data; at least one unresolved question |
| `failed` | No usable result | Null data; at least one error or question; no operations |

`unresolved` entries are `{ message, editionKey?, field? }`: bounded, nonempty messages without code/severity/blocking. The model judges materiality: unknown optional capacity or an unannounced edition need not prevent success; an inaccessible page preventing a required price check does. Questions do not veto other valid facts. Neither empty changes nor the presence of errors determines status.

Errors are `{ code, message, url?, editionKey?, field? }`. Model codes: `source_unavailable`, `source_unsupported`, `source_blocked`, `limit_reached`. Host codes also include `model_failed`, `invalid_candidate`, `write_failed`; report stages are `source`, `research`, `validation`, `write`. Bound/sanitize messages and exclude credentials/provider payloads. A recovered read failure can coexist with success; host retrieval history records actual attempts.

Validate status/data/diagnostic combinations locally. Provider failure, malformed output, target mismatch, or exhaustion without a valid final response yields host-generated failure. Preserve available raw output; never recover facts from intermediate/malformed output. Reusing catalog outcome was rejected: `unchanged` says nothing about research completeness.

### 2. Typed data

Strict normalized shape; `LocalDate` and field enums retain catalog semantics; money uses the model-specific types below:

```ts
type Fact<T> = { value: T; reason: string };
type DateBlock = {
  startsOn: LocalDate; endsOn: LocalDate;
  state: "provisional" | "confirmed";
};
type CoordinateBlock = {
  latitude: number; longitude: number;
  precision: "exact" | "approximate" | "locality" | "region";
};
type Currency = string; // Valid uppercase three-letter ISO code, e.g. EUR
type BasePrice =
  | { kind: "free"; coverage: "full_programme"; qualification?: string }
  | { kind: "exact" | "from" | "range"; currency: Currency;
      minAmount: number; maxAmount: number;
      coverage: "full_programme"; qualification?: string };
type TicketVariant = {
  label: string; amount?: number; currency?: Currency; terms?: string;
  availability?: "unknown" | "available" | "sold_out" | "closed";
  url?: string;
};
type TicketBlock = { variants: TicketVariant[]; basePrice: BasePrice | null };
type Socials = {
  instagram?: string; facebook?: string; youtube?: string;
  tiktok?: string; x?: string; other?: string;
};
type ResearchData = {
  eventId?: string; eventName: string; reason?: string;
  sources: Array<{ url: string; information: string }>;
  summary?: Fact<string>;
  links: { website?: string; socials: Socials };
  editions: Array<{
    key: string; year?: Fact<number>;
    dates?: Fact<DateBlock | null>;
    scheduleStatus?: Fact<ScheduleStatus>;
    displayName?: Fact<string | null>;
    venueName?: Fact<string | null>; venueAddress?: Fact<string | null>;
    locality?: Fact<string | null>; administrativeArea?: Fact<string | null>;
    countryCode?: Fact<string | null>;
    coordinates?: Fact<CoordinateBlock | null>;
    capacityEstimate?: Fact<number | null>;
    classification?: { add?: Fact<string[]>; remove?: Fact<string[]> };
    tickets?: Fact<TicketBlock>;
    links: { tickets?: string };
  }>;
};
```

Named facts replace generic claims and repeated edition keys. Reject wrong types, unknown fields, duplicate edition keys, legacy claims/prices, nested `priceDetails`, descriptor `status`, `timeZone`, edition-level `ticketAvailability`, and standalone date/coordinate fields. Preserve requested Event/Occurrence target checks.

Every supplied fact needs a nonempty reason, at most 500 characters, including clearing and unchanged proposals. Explain the supported value and why a correction supersedes the saved value. No source references or model-supplied old values. Adjacent reasons avoid a separate path-indexed dictionary; grouped facts avoid repeated explanations.

`data.reason` is required only when creating an Event. Existing targets and skipped duplicate adds need none. `eventName` supplies a new Event's canonical name but never renames an existing Event or modifies its aliases/slug. Reasons never authorize retargeting, merging, or reassignment.

After validating/resolving an existing target, compare trimmed `eventName` with trimmed saved canonical name (case-sensitive, no fuzzy matching). On a difference, the host records private report `eventNameMismatch: { eventId, storedName, observedName }`; otherwise it is null. Preserve original values in the record. CLI text logs an informational line; JSON/saved reports retain the structured record for later production analysis. Keep it on skipped adds, dry runs, no-ops, and write failures. This is host metadata, not a model-output field, error, unresolved question, catalog change, or database audit entry. It does not affect research status, exit code, or other valid updates; invalid target IDs still fail normally.

### 3. Updates and preservation

`add` is create-only. The model may identify an existing Event to avoid duplication, but preparation must then return catalog outcome `skipped` with its ID and no operations, including edition, ticket, link, summary, or publication changes. Retain research status/diagnostics; skipped alone exits zero. The catalog summary is sufficient for duplicate matching; no full ticket context is needed because updates are prohibited. Unknown IDs remain invalid targets. `refresh/check` update only their requested existing Event. Test the host guard with an existing ID and proposed changed facts, regardless of prompt compliance.

Omitted fields preserve stored values. Grouped facts expand into existing writer fields in one transaction; they create no database columns.

| Proposal | Replacement / clearing |
| --- | --- |
| `dates` | Both local dates, end ≥ start, plus state; null clears dates and sets `unknown` |
| `coordinates` | Latitude [-90,90], longitude [-180,180], plus precision; null clears pair and sets `unknown` |
| `tickets` | Complete variants and base price; `{ variants: [], basePrice: null }` clears; null/incomplete block invalid |
| `classification` | Union `add`, subtract `remove`; removal wins; omitted/empty sides preserve other terms |

Date/coordinate corrections repeat unchanged components; missing or null individual components are invalid. Clearing scheduled dates requires a compatible status proposal; never invent one or bypass publication constraints. Address/location text and capacity remain independently editable.

`scheduleStatus` remains `announced | scheduled | postponed | cancelled`; cancellation must be explicit. Remove descriptor-status fallback and do not add `completed`; historical editions remain researchable. Omission preserves saved status or the writer's creation default.

Saved timezones survive even location changes; new records leave them unset. Discovery continues using saved zones or UTC. No timezone inference/geocoding or public date-filter change.

All model monetary amounts use nonnegative finite major units: variant `amount` and base `minAmount/maxAmount`. Every supplied paid amount requires a validated uppercase three-letter ISO currency (`EUR`, `USD`, etc.), using the existing currency validator rather than regex alone. Variant amount/currency are supplied together; unknown prices omit both. Free full-programme admission uses `kind: free` without invented currency or amount. For exact/from, max equals min; for range, max exceeds min. Reject legacy minMinor/maxMinor in model output.

Map variants to writer `priceDetails` unchanged; convert base amounts to integer minor units using the currency exponent (EUR 100.50 → 10050, JPY 1000 → 1000, KWD 1.234 → 1234). Use decimal-safe conversion, reject excess currency precision or unsafe integer results rather than round. Apply currency precision checks to variants too. Convert saved base-price context back to major units before passing it to the model. Free maps to existing zero-minor storage; database/operation units remain unchanged. Model reasons use displayed amounts; reported writer diffs retain their declared storage units. `label` and optional `terms` identify categories without a registry. Availability is per variant; `closed` means sales ended, not sold out. Amount/currency may both be absent. Never derive global availability or cancellation from variants. Stop reading/exposing occurrence ticketAvailability in public detail/discovery contracts. Its unused database column can remain; no data rewrite is needed. Public details expose only variant label/availability for this change, showing known status beside the category; unknown/missing status has no badge. Remove global availability labels, map flags/popups, and list badges; keep schedule status, base-price display, filters, and ordering unchanged. Audit/research metadata and other variant details remain private.

An availability-only correction still replaces the whole ticket block: retain supported unchanged variants/base price from input. If unsupported, omit the block and report the question. Failed reads or missing partial-page content never authorize clearing.

Wire normalization preserves `data: null`, nullable `Fact.value`, and `tickets.value.basePrice: null`. Null optional fact wrappers, identity reasons, or link slots mean omission; null required components remain invalid. Contextual reason checks follow normalization. Test independently of provider availability.

### 4. Sources and links

`sources` contains one entry per normalized HTTP(S) URL, preferring the final retrieved URL, bounded by the page budget. `information` is nonempty, at most 500 characters, and describes actual page information, edition context, and partial-content limits. Exclude unread/failed destinations without useful content. Validate shape/uniqueness, not semantic support. No URL/ID/index associations with facts. Source summaries, technical retrieval history, and public links have separate purposes.

Public response limits: one Event website, six optional social slots, one ticket URL per edition. `other` means an official social account outside named platforms, never miscellaneous evidence pages. `x` accepts X/Twitter accounts on either domain; add catalog kind `x` and label X (Twitter), without rewriting URLs or automatically reclassifying saved links. Reject arrays, extra platforms, and a separate `twitter` slot.

Map website to `official_site`, edition `links.tickets` to `ticketing`, socials to their kinds. The researching model determines officiality/ownership; a second classifier loses its page context and adds an unnecessary call. Omit ambiguous ticket ownership with a question. An account linked by an inspected official page need not itself be fetched. Evidence and variant URLs stay outside these navigation limits.

Each supplied link slot replaces all links of its mapped kind for that owner with the selected URL. Omitted/empty/null slots preserve saved links; this is not whole-list replacement. Other kinds and owners remain untouched, including an Event link when an edition supplies its own ticket link. Public inheritance remains unchanged. Equivalent normalized URLs are a no-op when the slot already has exactly that link; multiple saved links collapse to one on explicit replacement. A shared ticket URL can belong to multiple editions. Replacement is part of the same atomic, versioned write; invalid replacements leave old links intact. `other` maps to the existing owner/kind slot, with no new classifier or automatic cleanup of omitted slots.

### 5. Attribution and reports

Preparation builds an explanation map separate from write payloads, keyed by operation/field. Reporting resolves temporary IDs and database field names, expands date/coordinate/price reasons, and combines taxonomy reasons into `changes[].explanations`. Actual old/new values come from the writer. Generated keys, publication, and link changes need no fabricated reasons. Operation-level notes were rejected because they conflate multiple field explanations.

No-op facts retain reasons only in raw output; no duplicate changes/audit entries. Reasons and summaries stay private, without extending database audit storage.

Reports add `researchStatus`, replace `gaps` with errors/questions, and copy valid `data.sources` into `sourceSummaries`, even on no-op/write failure. Existing `sources` stays technical read history. Preserve raw `modelResponse`, operations, receipts, usage, and record outcomes; avoid another copy of normalized candidate data. Failed research has empty summaries and catalog outcome `failed`.

Success/partial candidates use the atomic writer. Write failure preserves research status, adds a write-stage error, and rolls back the item. Partial no-op remains visibly partial/unchanged. Dry runs use the existing flag and retain no writes.

CLI text/JSON show both statuses, diagnostics, explanations, and summaries. Failed research/write exits nonzero; partial alone exits zero. Catalog/eval reports use schema version 2; bump the prompt version. Producers and consumers support only the new contract; remove the historical eval `gaps` fallback. Old reports need no migration or compatibility reader; report consumers reject unsupported versions explicitly. Eval quality still uses required/forbidden factual assertions, not citations or a blanket rejection of partial results.

## Risks / Trade-offs

- Plausible but incorrect completeness/reasons → captured-page evals, not a second verifier.
- Lost fact-to-page links → manual lookup in concise, edition-specific summaries.
- Attribution loss → tests for expansion, aggregates, temporary IDs, and no-ops.
- Saved zones can become stale after relocation; omitted link slots can retain multiple URLs → automatic correction/cleanup remains deferred.
- More text per fact → bounded reasons/summaries and existing call budgets.

## Migration Plan

Ship schema/prompt/normalization, adapter, public readers/views, reports, CLI/evals, fixtures, and docs together. Run deterministic checks and captured-page evals; sync the main spec only after implementation. No database migration/data rewrite. No backward-compatibility layer, historical-report conversion, or support for running old code against newly written data is required. Keep schema version 2 to identify the contract.
