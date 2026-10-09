# Source-backed catalog workflow

## Purpose

Supports owner-initiated catalog collection and refresh while preserving durable identities, accepted facts, and attributable run outcomes.

## Requirements

### Requirement: Source reads use bounded HTTP without script execution

The source reader SHALL retrieve public pages through bounded HTTP requests and SHALL NOT execute page scripts. It SHALL retain the source URL, retrieval time, outcome, and extracted Markdown. A page whose useful content appears to require script execution SHALL be reported as partial, so its missing facts are not treated as verified absences.

#### Scenario: HTML has useful source content

- **WHEN** a public HTML response contains readable festival facts
- **THEN** the reader extracts those facts and links without executing page scripts

#### Scenario: HTML depends on scripts for useful content

- **WHEN** a public HTML response has application scripts but little non-navigation text
- **THEN** the reader returns its available HTTP content with a partial outcome and a reason indicating that JavaScript is required
- **AND** it does not launch a browser or claim that missing facts were verified absent

#### Scenario: Unsafe HTTP destination

- **WHEN** a source URL or redirect points to a non-public address
- **THEN** the reader blocks the request before connecting to that destination

### Requirement: Collection runs are owner initiated

The system SHALL start discovery, source checks, and refreshes only through an owner-initiated local operation in the first version. Model calls SHALL use OpenRouter. Legacy import, server execution, and unattended scheduling are outside this change's scope.

#### Scenario: No unattended refresh

- **WHEN** no owner starts a run
- **THEN** the catalog does not autonomously discover or refresh records

#### Scenario: Owner starts a local run

- **WHEN** the owner initiates a collection run locally
- **THEN** the run can complete without a deployed collection server and uses OpenRouter for any model calls

#### Scenario: Default research model

- **WHEN** no model override is configured
- **THEN** research uses `openai/gpt-6-luna`
- **AND** `OPENROUTER_MODEL` can select another compatible model
- **AND** the default output allowance is 16,000 tokens per model call, including reasoning, overridable through `CATALOG_MAX_MODEL_OUTPUT_TOKENS`

### Requirement: Local catalog commands target Events without operator labels

The local catalog CLI SHALL accept a festival name for `add`, exactly one Event ID for `refresh`, and one or more Event IDs for `check`. It SHALL NOT require an operator name or accept an Occurrence ID as a target. Applied changes SHALL retain the fixed research actor in audit history; the initiating owner MAY be absent.

#### Scenario: Add without an operator name

- **WHEN** a local user starts `add` with a festival name and no operator name
- **THEN** research can run and applied changes identify `catalog-research` as the actor

#### Scenario: Check several Events

- **WHEN** a local user starts `check` with several Event IDs
- **THEN** each Event is researched independently with its relevant editions

#### Scenario: Unsupported CLI targets

- **WHEN** a local user supplies an operator or Occurrence target flag
- **THEN** the CLI rejects the unsupported flag before research starts

### Requirement: Festival addition covers historical and announced editions

The system SHALL research a new festival's identity, latest completed edition, and next announced edition, collect official links, and produce a short factual English Event description from the model’s source interpretation. Edition-specific facts SHALL remain associated with their own Occurrences. Missing information SHALL remain unknown; an unannounced next edition SHALL NOT be invented from prior-year dates or location.

#### Scenario: Both editions are documented

- **WHEN** official sources document the latest completed edition and the next announced edition
- **THEN** the run collects their facts separately under the same matched Event, collects official links, and generates a factual English description without presenting historical details as current

#### Scenario: No next edition is announced

- **WHEN** the inspected sources support a completed edition but no next edition
- **THEN** the run retains the supported history and reports that no next announcement was found in those sources without creating a forecast Occurrence

### Requirement: Existing events can be validated and refreshed

The system SHALL support research of existing Event and edition information and apply the model's proposed changes through catalog operations. Missing optional information SHALL NOT block other proposed changes or eligible publication.

#### Scenario: Existing venue changes

- **WHEN** the model proposes a new venue for an existing Occurrence
- **THEN** the refresh updates that Occurrence while preserving other editions' locations and reporting unresolved fields

### Requirement: Known links can be checked for new information

The system SHALL support checks of known event and edition links for new or changed information, including dates, location, and ticket availability. A page-content change alone SHALL NOT write a catalog change; the model must propose a changed catalog value. Checks MAY use the same collection process as a full refresh; a separate monitoring engine or stored page-diff history is not required.

#### Scenario: Page changes without fact changes

- **WHEN** a known page changes wording but supports the same accepted catalog facts
- **THEN** the run reports the catalog facts as unchanged and creates no duplicate catalog change

### Requirement: Social links remain usable without content retrieval

The system SHALL preserve stored Facebook and Instagram links for catalog display while reporting their automated content retrieval as unsupported in the first version. Unsupported retrieval SHALL NOT by itself clear stored values.

#### Scenario: Festival has a website and Instagram link

- **WHEN** a run checks a festival with an accessible official website and an Instagram link
- **THEN** it processes the website, retains the Instagram link, and reports Instagram retrieval as unsupported without blocking other model-proposed facts

### Requirement: Candidate matching respects enduring Event identity

The model SHALL use linked URLs, available official IDs, canonical URLs, name, geography, and edition facts to select an Event without requiring a separate source registry. It SHALL keep parallel festivals under one brand as separate Events while preserving one Event when a festival relocates between years. The host SHALL accept a structurally valid Event selection without independently resolving ambiguous matches.

For `refresh` and `check`, research SHALL load only the requested Event's private context.

#### Scenario: Unrelated catalog records are excluded from targeted research

- **WHEN** a refresh or check targets one Event in a catalog with unrelated Events
- **THEN** the agent receives only the requested Event's private context

#### Scenario: Same brand in different countries

- **WHEN** two recurring festivals share a brand but operate in different countries at the same time
- **THEN** candidate matching preserves separate Event identities

#### Scenario: A festival relocates

- **WHEN** official continuity establishes that a recurring festival moved to a new location
- **THEN** refresh/check may link a new edition to the existing Event; add returns skipped with that Event ID and creates nothing

### Requirement: Model output is accepted as the research decision

The main model SHALL select the Event, editions, non-ticket facts, and official links from inspected material; a ticket specialist SHALL interpret tickets for those fixed identities from handed-off inspected material. The host SHALL assemble their validated contributions without asking the main model to reproduce ticket output. The host SHALL accept its factual interpretation without verifying citations, source authority, ticket-link provenance, contradictions, or supersession. Schema validation, main/final result-status consistency, required explanations, and requested Event/Occurrence target checks SHALL still apply.

#### Scenario: A source claim is semantically wrong

- **WHEN** the model returns a structurally valid but mistaken fact
- **THEN** the host does not perform a second semantic check and the model eval can flag the resulting change

#### Scenario: Inspected sources conflict

- **WHEN** the model proposes a structurally valid fact despite a conflict between inspected sources
- **THEN** the host applies the proposal without dropping the field for lack of confirmation

#### Scenario: Model omits a price block

- **WHEN** the model omits the tickets block after a failed source read
- **THEN** the stored price block is preserved

#### Scenario: Specialist output is structurally bound to the handoff

- **WHEN** a specialist returns an unknown, duplicate, or missing requested edition key
- **THEN** reject its batch, preserve all affected saved price blocks, and report unfinished ticket checks; do not resolve ownership from result order

### Requirement: Runs report attributable outcomes

The system SHALL report each run's mode (`add`, `refresh`, or `check`) and resulting record outcome (`created`, `updated`, `published`, `unchanged`, `skipped`, or `failed`), with stable catalog identifiers where a record exists. Reports SHALL include the run's proposed or applied old/new values, factual explanations, and inspected source URLs. They SHALL separately identify research status, execution errors with stages, and unresolved questions; a catalog mutation outcome SHALL NOT stand in for research completion. Source-check results SHALL identify the inspected URL, UTC check time, and outcome, distinguishing unsupported retrieval from successful checks and failures. CLI/eval reports SHALL use version 2. Failed research/writing SHALL exit nonzero; partial alone SHALL exit zero. Reports SHALL NOT require persistent source identifiers. Each started festival attempt SHALL have a durable run record and a stable `runId` in CLI text, JSON, eval results, and optional saved reports; these additive fields SHALL retain report version 2.

#### Scenario: Preserve the final model response

- **WHEN** a model generation returns a final response
- **THEN** private research and eval reports retain the main generation's final text and unnormalized structured object in `modelResponse`, separately from catalog operations
- **AND** main and any specialist raw responses remain available when candidate validation or writing fails; the normalized assembled final candidate is separately available or null
- **AND** unavailable responses or components are recorded as null, without copying prompts, page bodies, or transport metadata

#### Scenario: Reasoning configuration and token accounting

- **WHEN** the owner configures a supported reasoning effort
- **THEN** main research, specialist, and discovery requests send that effort and reports identify the requested setting
- **AND** omitting the setting explicitly selects `medium`
- **AND** reports accumulate provider-reported input, output, cached input, and reasoning token counts from completed steps, retaining those counts when a later step fails or is interrupted and using null for unavailable cached input or reasoning details
- **AND** reports set `usage.complete` to false when a call fails, is interrupted, lacks token usage, or includes unaccounted discovery attempts; the CLI marks the known token counts as partial
- **AND** reports include a full model cost only when all calls' usage and costs are known, otherwise using null; an explicitly reported zero cost remains zero

#### Scenario: Unchanged recheck

- **WHEN** a recheck confirms the current accepted facts without changes
- **THEN** the run reports unchanged and creates no duplicate catalog change

#### Scenario: Source cannot be fetched

- **WHEN** a known source fails to load and the model proposes no changes
- **THEN** the report identifies the attempted URL, check time, and failure without changing catalog facts or audit history

#### Scenario: Explanations survive dry-run reporting

- **WHEN** an explained factual proposal produces a dry-run diff
- **THEN** the report retains its reason alongside the actual previewed old/new values and retains source summaries separately
- **AND** the dry run retains no catalog fact, version, audit, or receipt changes, while its ingestion run record and final report persist

#### Scenario: Research succeeds but writing fails

- **WHEN** the writer rejects valid research operations
- **THEN** preserve research status, report write-stage error/outcome failed, and commit no catalog item changes while retaining a failed ingestion run record

#### Scenario: Partial no-op remains visible

- **WHEN** partial research changes nothing
- **THEN** text/JSON show partial plus unchanged, separating questions from errors

#### Scenario: Only the new report contract is supported

- **WHEN** a consumer receives an unsupported report version
- **THEN** it rejects that version explicitly, without legacy gaps fallback or automatic conversion
- **AND** new reports use version 2 and do not emit gaps

#### Scenario: Saved output correlates with the database

- **WHEN** an attempt finishes and the owner requests JSON output or a `--report` file
- **THEN** its result has the same runId and report content as the stored final report
- **AND** failure to write the optional file does not erase or change the finalized run record

#### Scenario: Ticket-stage reporting is additive and private

- **WHEN** research delegates ticket interpretation
- **THEN** version-2 reports retain existing fields and add one optional compact ticket-stage record with outcome, raw response and usage, plus the assembled candidate
- **AND** CLI text exposes unfinished ticket checks and total usage without copying prompts or page bodies; old version-2 reports without stage fields remain readable
- **AND** the host reports completed for a valid specialist batch even when it contains omitted replacements or unresolved questions; skipped, failed and limited describe stage execution rather than per-edition model statuses

#### Scenario: Total resources include every stage once

- **WHEN** main, specialist, and discovery calls consume resources
- **THEN** top-level tokens and cost include every attempted stage exactly once, retain known usage after failure, and set full cost to null when accounting or costs are incomplete
- **AND** a skipped zero-call specialist is reported as such and does not make otherwise complete usage incomplete; existing total wall time remains available

### Requirement: Dry runs preview changes without applying them

The system SHALL let the owner inspect a transient diff of proposed catalog changes before an apply run. Dry-run SHALL use a transaction on the catalog database and roll it back without retained catalog record, version, audit, or receipt changes; it SHALL NOT create a database copy. The ingestion run record and final preview report SHALL persist outside that rollback.

#### Scenario: Dry run of a venue correction

- **WHEN** the owner requests a dry run for a model-proposed venue change
- **THEN** the output shows the proposed old and new values while the catalog version and audit history remain unchanged
- **AND** its run record and final preview report persist

#### Scenario: Dry-run addition has transient catalog identifiers

- **WHEN** dry-run previews creating an Event and its Occurrences
- **THEN** those catalog rows, versions, audit entries, and receipts are rolled back
- **AND** the finalized run report retains the preview, including transient identifiers, without requiring those identifiers to reference retained catalog records

### Requirement: Eligible apply runs publish without review queues

The system SHALL apply and publish model-proposed, structurally eligible records directly through catalog operations, with atomic audit history and no per-item or batch approval task.

#### Scenario: Complete new festival

- **WHEN** an owner-initiated run proposes a new in-scope Event and Occurrence with all structurally required publication facts
- **THEN** the apply operation publishes them, records the changes atomically, and reports stable identifiers

### Requirement: Interrupted collection can be rerun from current state

After interruption, a new owner-initiated run SHALL reload the catalog and research again with new operation keys. Committed changes SHALL remain; incomplete item transactions SHALL roll back. Existing writer receipt idempotency SHALL remain supported. An attempt stopped before finalization SHALL remain running with no finish time or final report; this SHALL NOT be treated as proof of success or failure. Reruns SHALL create new run records without changing earlier records. Automatic run recovery and a history-viewing command are outside this change.

#### Scenario: Owner reruns after interruption

- **WHEN** a run stops after one festival is committed and the owner starts it again
- **THEN** the new run uses current catalog state without duplicating that festival or resuming a saved operation file

#### Scenario: Process stops after catalog commit

- **WHEN** the process is killed after an item commit but before run finalization
- **THEN** committed catalog changes remain and the attempt remains running with unknown final result and usage
- **AND** a new owner-initiated attempt has a different runId and starts from current catalog state

### Requirement: One research result governs each atomic catalog update

Research SHALL produce one final structured result assembled by the host from a validated main draft and any accepted ticket specialist contribution. Intermediate stage outputs SHALL NOT write catalog operations. Only valid success or partial data for the requested Event/Occurrence targets SHALL produce catalog operations; omitted values SHALL be preserved. Failed or invalid final results SHALL produce no operations or automatic model correction attempts. Rejected specialist contributions SHALL be omitted with visible diagnostics while usable main findings retain their main success/partial status in the final result. Catalog updates SHALL enforce structural, version, no-op, and publication rules atomically: an invalid operation SHALL leave the whole item unchanged.

#### Scenario: A validated proposal violates catalog constraints

- **WHEN** a proposal passes candidate validation but violates catalog constraints, such as clearing dates while retaining scheduled status
- **THEN** the whole item remains unchanged and the run reports write_failed while preserving research status

#### Scenario: Research needs a more specific page

- **WHEN** an inspected page leaves a material question unresolved
- **THEN** the agent may read a relevant linked page or discover a source within its budget before returning its one research result

#### Scenario: Research receives saved link context

- **WHEN** a refresh or check starts with saved links
- **THEN** all saved links are available to research with their owner and edition context where known

#### Scenario: Addition starts without a source URL

- **WHEN** the owner starts `add` with a festival name
- **THEN** the agent discovers and inspects a candidate source before returning its proposal

#### Scenario: Intermediate commentary is not a catalog proposal

- **WHEN** research returns commentary while still requesting source information
- **THEN** commentary produces no catalog operations; research may continue within its budget
- **AND** only the final result that passes schema and target validation can produce operations

#### Scenario: Ticket and general findings apply together

- **WHEN** valid main facts and valid specialist ticket blocks form a final success or partial candidate
- **THEN** prepare and apply one combined atomic catalog item, with ticket reasons attached to its actual price changes

#### Scenario: Ticket failure cannot clear saved prices

- **WHEN** valid main findings exist but specialist execution fails or its batch is invalid
- **THEN** omit affected tickets, retain saved variants and primary prices, and retain the main research status with unfinished ticket checks and technical diagnostics
- **AND** supported non-ticket findings remain eligible for the same single atomic update

#### Scenario: Duplicate add avoids unnecessary specialist work

- **WHEN** a valid main draft selects an existing Event during add
- **THEN** return skipped with its ID and main diagnostics without calling the specialist or creating any operations

### Requirement: Add creates new Events without updating existing ones

Add SHALL create a new Event or skip a recognized existing Event. A duplicate SHALL return catalog outcome skipped and the existing ID, with no operations or publication changes. Research status/diagnostics SHALL remain visible; skipped alone SHALL exit zero. Existing-record updates SHALL require targeted refresh/check.

#### Scenario: Duplicate add proposes changed facts

- **WHEN** add selects an existing Event and proposes changed summary, links, tickets, or editions
- **THEN** the host returns skipped with its ID and produces no writes, including publication

#### Scenario: Add identifies a new festival

- **WHEN** add returns a valid new identity without an existing Event match
- **THEN** it may create that Event and its researched editions atomically

#### Scenario: Updates require an explicit target

- **WHEN** refresh/check targets an existing Event
- **THEN** supported updates apply only to that target; unknown or mismatched IDs are rejected

### Requirement: Research results distinguish completion from catalog mutation

Research SHALL return `status`, `data`, `errors`, and `unresolved`. Success/partial SHALL contain data; failure SHALL contain null data and produce no operations. Status SHALL describe research completeness independently of catalog changes or announcement completeness. Core checks SHALL cover identity, the relevant latest completed or next announced edition/dates, and location; duplicate add needs only identity. Partial SHALL require a useful result and a specific unfinished non-ticket core check with its cause in unresolved. Ticket navigation, published ticket detail and specialist processing SHALL NOT be required for success; ticket-only uncertainty or execution errors SHALL NOT justify partial. The model SHALL apply this completion policy through its instructions; host validation SHALL remain structural without semantic question classification.

#### Scenario: Successful check changes nothing

- **WHEN** inspected material completes the requested check
- **THEN** status is `success`, even with no changes; empty changes alone do not prove completion

#### Scenario: The next edition is only partly announced

- **WHEN** reasonable relevant checks find an announced edition and dates but no published venue or prices
- **THEN** success may contain the known facts and omit missing fields, preserving saved values and describing announcement limits in source summaries
- **AND** use “not found on inspected pages” unless evidence supports “not yet announced”

#### Scenario: A core check remains unfinished

- **WHEN** a source failure or material conflict prevents an identity, relevant edition/dates or location check, or the budget ends before such a core check finishes, but valid final data exists
- **THEN** return partial with the specific unfinished check and its cause; valid facts remain applicable and omitted fields preserve stored data
- **AND** missing optional data does not count as unfinished research

#### Scenario: Optional unknowns do not force partial

- **WHEN** research is complete but capacity, precise coordinates, socials, a completed schedule status, or a next-edition announcement are unavailable
- **THEN** success may retain optional questions; never invent facts or a completed status, or change stored values just to fill missing fields

#### Scenario: Failed research needs no invented candidate

- **WHEN** no usable result exists
- **THEN** status is `failed`, data is null, and at least one error/question explains it
- **AND** a valid failure response is accepted and the report preserves failed status with null data

#### Scenario: Repeated input is not a research finding

- **WHEN** refresh/check cannot obtain usable source findings and only the supplied identity, saved facts, or URLs remain
- **THEN** return failed with null data and a source-failure explanation, not partial with an empty candidate shell
- **AND** source-verified unchanged findings still qualify for success/partial according to completed checks; duplicate-add identity matching remains sufficient

#### Scenario: Inconsistent result is rejected

- **WHEN** failed data is non-null, success/partial data is null, partial has no question, or failure has no diagnostics
- **THEN** validation rejects the result before operations

#### Scenario: Main status excludes pending ticket work

- **WHEN** main research completes its identity, relevant edition/dates and location checks but ticket routing is inspect or unfinished
- **THEN** return success with any ticket-scoped uncertainty recorded separately; pending ticket processing is not an unfinished core check

### Requirement: Execution errors and unanswered questions are separate

Errors SHALL carry a code and bounded message, with optional URL/target. Questions SHALL carry a bounded message and optional editionKey/field, without code/blocking. Runtime failures SHALL be host-reported without exposing credentials or provider payloads. Questions SHALL NOT veto valid facts.

#### Scenario: Unresolved questions need no classification

- **WHEN** a question is returned
- **THEN** only its message and optional target are required; partial needs a question, success may retain optional unknowns, and execution errors keep codes

#### Scenario: Sources disagree

- **WHEN** conflicting sources prevent selecting a value
- **THEN** omit that fact and record a question, not a retrieval error

#### Scenario: Failed read is recovered

- **WHEN** another source completes research after a read failure
- **THEN** retain the failed attempt in source history without forcing partial/failure

#### Scenario: Provider fails before returning a result

- **WHEN** main execution fails or exhausts its limit without a valid main draft
- **THEN** the host reports failure with an error and null data; intermediate/malformed facts are not written

#### Scenario: Specialist failure leaves a usable main draft

- **WHEN** a specialist provider or limit failure occurs after valid usable main research
- **THEN** report a host execution error and an edition-scoped unfinished tickets question for each affected edition, preserve its prices, and retain the main success/partial status in final data
- **AND** the specialist has no model-error fields; host technical diagnostics remain separate from its unresolved questions, and questions do not veto valid facts

### Requirement: Edition proposals use named typed fields

Editions SHALL have unique keys and named facts using typed `{ value, reason }`, optional complete `tickets`, and optional `classification` patches. Ownership SHALL follow the enclosing edition. Omission SHALL preserve values; explicit null SHALL clear only nullable facts. Legacy generic claims/prices SHALL be rejected.

#### Scenario: Facts for two editions remain separate

- **WHEN** venue and ticket proposals concern different editions
- **THEN** each is nested and applied only within its edition, without repeated editionKey

#### Scenario: Typed fields replace generic field names

- **WHEN** output contains wrong types, unknown properties, claims, top-level/edition prices, or nested priceDetails
- **THEN** strict validation rejects it before writing

#### Scenario: A partial field update preserves other facts

- **WHEN** venueName changes, locality is omitted, and venueAddress explicitly has an explained null value
- **THEN** preserve locality and clear only the address

#### Scenario: Optional wire null differs from explicit clearing

- **WHEN** optional fact wrappers are null on the wire
- **THEN** omit them; preserve inner value nulls for nullable facts and reject them otherwise

#### Scenario: Prices remain a complete replacement

- **WHEN** tickets.value supplies variants and basePrice
- **THEN** replace stored variants and base price atomically; empty variants plus null basePrice clears, omission preserves, and null/incomplete blocks fail validation

#### Scenario: Classification remains an additive and subtractive patch

- **WHEN** explained classification.add/remove arrays are supplied
- **THEN** union additions then subtract removals; removal wins and omitted/empty sides preserve other terms

#### Scenario: Schedule status has one source

- **WHEN** research establishes cancellation
- **THEN** propose explained scheduleStatus=cancelled; reject the legacy descriptor status field

#### Scenario: Omitted schedule status preserves existing behavior

- **WHEN** scheduleStatus is omitted
- **THEN** preserve stored status or the creation default; historical research needs no completed status

### Requirement: Dates and coordinates are complete grouped facts

Dates SHALL group startsOn/endsOn/state; coordinates SHALL group latitude/longitude/precision, each with one reason. Supplied blocks SHALL replace all components; omission SHALL preserve them; null SHALL clear the pair and set state/precision to unknown.

#### Scenario: Date correction carries the complete range

- **WHEN** either date changes
- **THEN** supply both local dates with end ≥ start and provisional/confirmed state; preserve that range and state in the catalog

#### Scenario: Coordinates carry their precision

- **WHEN** coordinates are proposed
- **THEN** supply latitude [-90,90], longitude [-180,180], and exact/approximate/locality/region precision, retained for map display

#### Scenario: Incomplete groups are invalid

- **WHEN** components are missing/null or legacy standalone fields are supplied
- **THEN** reject the candidate before writing

#### Scenario: Clear a complete group

- **WHEN** dates.value or coordinates.value is explicitly null with a reason
- **THEN** clear both components and set state/precision to unknown; omitted groups remain unchanged

#### Scenario: Clearing dates respects catalog constraints

- **WHEN** scheduled dates are cleared without a compatible status
- **THEN** reject the item atomically; never invent status or bypass publication constraints

### Requirement: Research does not propose time zones

Research SHALL reject timeZone, preserve saved zones even after relocation, and leave new zones unset. Discovery SHALL retain saved-zone/UTC day calculation without automatic lookup or country-based inference.

#### Scenario: Existing zone survives research

- **WHEN** dates or location change
- **THEN** preserve the saved zone and reject model-supplied timeZone

#### Scenario: New edition uses the existing fallback

- **WHEN** a new edition has no saved zone
- **THEN** use the existing UTC fallback without changing date filters

### Requirement: Ticket availability belongs to each ticket variant

Only labelled tickets.value.variants SHALL propose availability: unknown/available/sold_out/closed. Edition-level availability proposals SHALL be rejected; no edition-wide value SHALL be inferred from variants or exposed publicly. Complete ticket replacement SHALL remain required.

#### Scenario: Categories have different availability

- **WHEN** Early Bird is sold out but Regular remains available
- **THEN** store those statuses per variant without changing schedule or producing aggregate availability

#### Scenario: Availability is known without an amount

- **WHEN** a category and availability are known without price
- **THEN** its label/availability may omit both amount and currency

#### Scenario: Availability-only correction preserves the complete intended price block

- **WHEN** one variant's availability changes
- **THEN** supply the complete intended variants/basePrice with a reason, or omit the block and report uncertainty; never implicitly delete other variants through a partial replacement

#### Scenario: Closed category does not imply cancellation

- **WHEN** category sales ended without sell-out evidence
- **THEN** use closed without inferring cancellation or global sell-out

### Requirement: Proposed facts explain their basis

Named facts, tickets, classification sides, and descriptions SHALL carry a reason explaining the value/correction. Event identity SHALL require one only for creation. Reasons SHALL remain private without source references or new semantic verification; old values SHALL come from the catalog.

#### Scenario: Checking a known Event needs no identity explanation

- **WHEN** research resolves an existing Event, including a skipped duplicate add
- **THEN** data.reason may be omitted or wire-null even if eventName differs; supplied facts still need reasons

#### Scenario: Creation requires an identity explanation

- **WHEN** research proposes creating a new Event
- **THEN** require data.reason before operations; reasons never bypass target checks or authorize reassignment

#### Scenario: Venue changes

- **WHEN** a venue move is proposed
- **THEN** report its explanation with actual old/new values, without a fact-to-page reference

#### Scenario: Clearing needs a factual basis

- **WHEN** a nullable fact or ticket block is explicitly cleared
- **THEN** require a reason; failed reads/missing partial-page content do not authorize clearing

#### Scenario: Aggregate changes retain multiple explanations

- **WHEN** multiple explained proposals contribute to a catalog change or one grouped proposal changes several facts
- **THEN** retain applicable reasons for each actual change without synthetic citations or model-supplied old values

#### Scenario: Unchanged explained fact

- **WHEN** a proposal equals stored data
- **THEN** retain its reason in raw output without duplicate changes/audit entries

### Requirement: Model ticket amounts use one currency unit

Variant amount and base-price minAmount/maxAmount SHALL use nonnegative finite major currency units. Paid values SHALL include a valid uppercase three-letter ISO currency code. Base prices SHALL convert to integer minor units at the catalog boundary using currency precision; model output SHALL reject minMinor/maxMinor. Unknown amounts SHALL remain absent. Base prices SHALL exclude eligibility-based concessions while preserving those categories in variants; if only concession prices are known, basePrice SHALL be null.

#### Scenario: Currency precision differs

- **WHEN** base amounts are EUR 100.50, JPY 1000, or KWD 1.234
- **THEN** store 10050, 1000, or 1234 minor units respectively and supply model context in the original major units

#### Scenario: Invalid money is rejected

- **WHEN** amounts lack currency, use an invalid currency, exceed its fractional precision, or overflow safe stored integers
- **THEN** reject the invalid specialist batch without rounding or applying its price replacements, preserve affected saved prices, and permit usable main findings in a final candidate retaining the main success/partial status
- **AND** invalid money in a main or assembled final candidate rejects the whole candidate without applying writes

#### Scenario: Concession tickets do not set the base price

- **WHEN** youth, student, senior, resident, or other eligibility-based concession prices are known
- **THEN** retain them in variants but exclude them from basePrice, including concession-only free admission
- **AND** if only concession prices are known, basePrice is null; general-sale discounts are not excluded merely for being cheaper

#### Scenario: Range and free admission remain explicit

- **WHEN** a base price is supplied
- **THEN** exact/from bounds match, range max exceeds min, and coverage is full_programme
- **AND** free requires no invented currency and maps to zero minor units; null basePrice means unknown

#### Scenario: Invalid specialist money preserves a valid venue correction

- **WHEN** usable main research supports a venue correction but the specialist returns invalid currency precision
- **THEN** omit all batch ticket replacements, retain saved prices, and apply the venue correction only through a valid final candidate retaining the main success/partial status with a scoped ticket question and validation diagnostic

### Requirement: Existing Event names remain unchanged and differences are logged

For an existing Event, eventName SHALL NOT rename it or change aliases/slug. The host SHALL compare trimmed names case-sensitively and record differences as private eventNameMismatch metadata with Event ID and original stored/observed names. A mismatch SHALL NOT change status, exit code, or eligibility of other valid updates.

#### Scenario: Model returns a different Event name

- **WHEN** valid research selects an existing Event with a differing name
- **THEN** preserve canonical name, aliases, and slug; log the difference in CLI text and structured private JSON/saved reports
- **AND** do not treat it as an error, unresolved question, catalog change, or audit entry

#### Scenario: Name differences survive non-writing outcomes

- **WHEN** a mismatch occurs during duplicate add, dry run, no-op, or a later write failure
- **THEN** retain the mismatch metadata; duplicate add still skips without writes and invalid target IDs still fail

#### Scenario: Names match after trimming

- **WHEN** names differ only in surrounding whitespace or no existing target is resolved
- **THEN** eventNameMismatch is null

### Requirement: Source summaries describe useful inspected pages

Non-null data SHALL include sources entries `{ url, information }`, unique by normalized HTTP(S) URL, describing actual page information and edition context. Facts SHALL NOT reference entries by URL/ID/index. Summaries SHALL remain private and distinct from public links and retrieval history.

#### Scenario: One page supplies several facts

- **WHEN** a page covers multiple topics/editions
- **THEN** include one combined contextual summary without repeating its URL on facts

#### Scenario: An unread destination is not an informative source

- **WHEN** a destination is unread or failed without useful content
- **THEN** omit its summary while retaining attempted reads and relevant errors

#### Scenario: Partial page content provides useful information

- **WHEN** only dates are readable
- **THEN** summarize dates and limitations without claiming prices were read; retrieval remains partial

#### Scenario: Shared summaries survive no-op or write failure

- **WHEN** valid research changes nothing or writing fails
- **THEN** retain summaries independently of changes and separately from retrieval outcomes

### Requirement: Research returns bounded official links with structural ownership

Research SHALL return at most one Event website, one account per supported social key, and one ticket URL per edition. The researching model SHALL determine officiality/association; their position in the result SHALL determine ownership.

#### Scenario: Festival website and social accounts

- **WHEN** official website/accounts are found
- **THEN** place them in Event links; socials permits instagram/facebook/youtube/tiktok/x/other URL slots, with other restricted to additional social platforms

#### Scenario: X and Twitter share one social slot

- **WHEN** an official x.com/twitter.com account is identified
- **THEN** use socials.x and catalog kind x, labelled X (Twitter); reject a separate twitter key and do not rewrite/reclassify saved URLs

#### Scenario: Edition-specific tickets

- **WHEN** an organizer identifies an edition's ticket page
- **THEN** attach it only to that edition, not others sharing the Event

#### Scenario: Ticket ownership is uncertain

- **WHEN** ticket ownership cannot be established
- **THEN** omit it with a question rather than assigning it to the Event or an uncertain edition

#### Scenario: Social destination cannot be fetched

- **WHEN** an inspected official page links an account whose retrieval is unsupported
- **THEN** the account can still be collected; unsupported retrieval does not invalidate it

#### Scenario: Evidence pages are not public link categories

- **WHEN** programme/FAQ/travel/news pages supply evidence
- **THEN** retain them as sources, not miscellaneous public links

#### Scenario: Preserve omitted link slots

- **WHEN** a slot is omitted, wire-null, or socials is empty
- **THEN** preserve its saved links; inaccessible pages alone never delete them

#### Scenario: Replace a supplied link slot

- **WHEN** research supplies a new URL for an owner/kind slot
- **THEN** replace all previous links in that slot with the selected URL, preserving other kinds/owners and public inheritance
- **AND** invalid replacements fail atomically without deleting the old links

#### Scenario: Reject malformed link proposals

- **WHEN** links are non-HTTP(S), socials is an array, keys are unknown, slots are non-string, or targets invalid
- **THEN** reject the candidate before writing

#### Scenario: Malformed URLs preserve the failure report

- **WHEN** source summaries or the X/Twitter slot contain a malformed URL
- **THEN** the run reports invalid_candidate, retains the raw response and retrieval history, and produces no catalog operations

#### Scenario: Equivalent and shared URLs

- **WHEN** a slot already contains exactly its proposed normalized URL
- **THEN** the replacement is a no-op; multiple old links collapse to one when explicitly replaced
- **AND** one ticket URL explicitly assigned to two editions remains on both

### Requirement: Model failures expose safe technical details

Host-generated model_failed errors SHALL preserve bounded safe structured diagnostics in CLI text, JSON, and eval reports: recognized error/cause types, HTTP status, provider/network code, and retryability when available. Unknown fields SHALL remain absent or explicitly unknown. Diagnostics SHALL exclude raw exception messages, provider payloads, request/response headers, prompts, and credentials. Research limits SHALL retain precedence over model_failed. Main research SHALL retain the existing explicit OpenRouter `provider_unavailable` exception: at most three retries for the main stage per run with 10/30/90-second backoff within the original deadline, refunding unavailable main attempts without replaying completed tools. Other main failures and all specialist failures SHALL NOT trigger automatic retries; started specialist attempts SHALL NOT be refunded. Existing bounded discovery retries SHALL remain constrained by the shared reservation and configured budgets SHALL otherwise remain unchanged. Missing usage/cost SHALL NOT be estimated.

#### Scenario: Provider or network failure

- **WHEN** a model request fails and safe technical diagnostics are available
- **THEN** a main-model failure report preserves that metadata with failed research and no operations; a specialist-only failure preserves it with usable main data and unchanged main success/partial status and omitted affected tickets, without exposing raw content

#### Scenario: Provider failure produces no final result

- **WHEN** a main provider failure ends research without a valid main draft
- **THEN** report model_failed with available safe diagnostics, not invalid_candidate, after any permitted main provider_unavailable retries

#### Scenario: Unavailable provider preserves research capacity

- **WHEN** OpenRouter explicitly reports provider_unavailable during main research
- **THEN** exclude that attempt from the model-call budget and retry at most three times with 10-second, 30-second, and 90-second delays, cancellable at the run deadline
- **AND** retain completed steps, tool results, and known usage; other provider errors are not retried

#### Scenario: A provider failure follows completed work

- **WHEN** a model request fails after earlier calls have reported usage
- **THEN** the model_failed report retains known input/output tokens and cost without estimating unreported usage

#### Scenario: Unknown or budget failure

- **WHEN** safe failure details are unavailable or the research budget is exhausted
- **THEN** diagnostics remain bounded, missing details are not invented, and budget exhaustion remains limit_reached

#### Scenario: Invalid specialist output differs from provider failure

- **WHEN** the specialist returns malformed structure, invalid money, or incompatible target keys
- **THEN** retain its raw output privately, report specialist invalid_candidate with validation stage, preserve the affected price blocks, and retain main success/partial findings without correction calls
- **AND** an invalid main or assembled final candidate still produces failed research and no operations

### Requirement: Local research tracing is optional and independent

The owner SHALL be able to enable per-Event apply-run, agent, model and source tracing without sampling. Persistence SHALL be best effort. Tracing SHALL NOT alter research decisions, budgets, retries, catalog writes, report schema/semantics, durable run records or exit status. Integration failures SHALL emit bounded independent diagnostics; local LibSQL technical errors/stacks remain permitted.

#### Scenario: Tracing is disabled by default

- **WHEN** tracing is not enabled
- **THEN** research creates no trace store or records

#### Scenario: Dry-run skips tracing

- **WHEN** dry-run executes, even with tracing enabled
- **THEN** create no trace store or spans, including agent/model/source spans; retain existing preview reports and durable run records

#### Scenario: An enabled agent uses tools

- **WHEN** a traced agent calls model/source tools
- **THEN** spans retain relationships, names, timing, technical status and bounded mode/model/prompt-version/requested-Event metadata

#### Scenario: Trace persistence fails

- **WHEN** initialization or persistence fails, including internally handled exporter errors
- **THEN** emit a fixed stderr diagnostic without payloads; preserve research results, v2 business fields, budgets and exit status
- **AND** private LibSQL technical errors/stacks may appear locally, never forwarded to stored traces or reports

#### Scenario: Both agents are identifiable without Workflow conversion

- **WHEN** enabled research invokes main and ticket Mastra Agents through the ordinary TypeScript orchestrator
- **THEN** persist both agent subtrees under the existing per-Event apply-run root with distinct allowlisted identities, the correct per-stage prompt version and existing bounded application metadata on descendant spans
- **AND** delayed main events retain their main identity; retain existing run/source projections without adding another trace root or a runnable Studio workflow

### Requirement: Exported research traces exclude content payloads

Persisted spans SHALL exclude prompts, pages, model messages/responses, raw tool payloads, SDK/config credentials, transport headers/bodies and raw errors/stacks. Only allowlisted bounded source diagnostics and root summaries SHALL be permitted input/output; source URLs follow the preservation rule below. Identity, timing, relationships and safe metadata/technical diagnostics SHALL remain. Private reports SHALL retain their final-output contract.

#### Scenario: Content appears in multiple span fields

- **WHEN** forbidden content appears anywhere in a span
- **THEN** persisted/exported spans exclude it while retaining operation identity/timing and the permitted projections

#### Scenario: Span sanitization fails

- **WHEN** sanitization fails
- **THEN** drop the span and emit a fixed content-free diagnostic without changing research

#### Scenario: Diagnostic projections survive content exclusion

- **WHEN** source diagnostics and root summaries are exported
- **THEN** allowed input/output survives persistence and fresh-process export; original tool and all agent/model/unknown-span payloads remain absent
- **AND** every export lifecycle event is sanitized; unavailable sanitization disables tracing without blocking research

### Requirement: Research tracing does not forward SDK logs

Research tracing SHALL disable forwarding of agent and SDK log events to observability storage. Fixed application tracing diagnostics SHALL remain separate from observability logs and SHALL exclude original log messages and metadata. Additional technical errors and stacks emitted by LibSQL's private logger to local stderr are outside this diagnostic-format guarantee.

#### Scenario: SDK logs contain private content

- **WHEN** an agent or SDK logs a prompt, page body, model response, credential, or raw error during a traced invocation
- **THEN** the log event is absent from observability storage and its exports

### Requirement: Local traces use best-effort persistence and can be inspected

Tracing SHALL use a dedicated local store separate from the catalog. Saved spans SHALL be inspectable after exit without a hosted account. One per-run Mastra runtime SHALL register both real agents with stage-owned prompt versions and SHALL NOT flush or shut down between generations. Completion, handled errors and cooperative aborts SHALL finalize the run summary/report or failure, end spans, then await flush and shutdown attempts. Overlapping background writes or forced termination may leave incomplete traces.

#### Scenario: Inspect a finished invocation

- **WHEN** the owner opens local trace inspection after a run
- **THEN** saved traces are available without rerunning research, catalog access or model credentials; the interface registers no research agents or mutation workflows

#### Scenario: A generation fails or is cooperatively aborted

- **WHEN** the run throws or cooperatively aborts
- **THEN** end root/owned children and await terminal-span flush before store closure and return, preserving the result/original error

#### Scenario: A short invocation finishes before automatic persistence

- **WHEN** a short run finishes with buffered spans and no overlapping background write
- **THEN** a fresh process can read final root output, labels and children after exit

#### Scenario: Background persistence overlaps another flush or cleanup

- **WHEN** background writing overlaps flush/shutdown
- **THEN** spans or terminal updates may be missing; research/report semantics, budgets, retries and exit status remain unchanged

#### Scenario: Flushing fails during cleanup

- **WHEN** flush fails
- **THEN** emit a fixed diagnostic and still attempt shutdown; neither failure replaces the result/original error

#### Scenario: Injected research fixture bypasses the agent

- **WHEN** an injected candidate generator bypasses the agent
- **THEN** create no trace/store; tracing tests exercise the real agent with an offline mock provider and a separate temporary store

#### Scenario: Cleanup crosses the research deadline

- **WHEN** generation finishes before its deadline but cleanup crosses it
- **THEN** preserve the model result/provider error; only actual generation timeout retains budget-failure classification

#### Scenario: Main cleanup does not precede ticket execution

- **WHEN** real main generation completes and ticket specialization is required
- **THEN** retain the shared runtime through ticket execution and deterministic assembly/write, without awaiting main-stage flush or shutdown between generations
- **AND** each model result/error is classified using its own generation finish time and the original deadline; final cleanup failures do not replace research or write outcomes

#### Scenario: A stage is skipped or injected

- **WHEN** one stage is skipped or uses an injected generator
- **THEN** it creates no agent spans, while a real other stage can still use optional tracing; all-injected runs create no trace store

### Requirement: Every festival attempt has a durable lifecycle

After input and configuration validation, the system SHALL persist a running record in the selected catalog database before context/source/model work. Each attempt SHALL have a unique ID, UTC start time, safe normalized input, and required nonempty text mode, fixed at start and equal to mode in input and final report JSON. Finalization SHALL update the same record with UTC finish time and private report. Lifecycle status SHALL be separate from research status and catalog outcome.

#### Scenario: Start is recorded before work

- **WHEN** a valid festival attempt begins
- **THEN** its running row is visible before any research context load, source request, or model call, with no finish time or final report
- **AND** invalid input or configuration and help requests do not create run rows

#### Scenario: Mode is available before a final report

- **WHEN** an add, refresh, or check attempt starts
- **THEN** its mode column equals input_json.mode and remains queryable while running or after interruption
- **AND** finalization preserves that mode and report_json.mode agrees with it

#### Scenario: Storage accepts evolving mode names

- **WHEN** the application introduces another supported invocation mode
- **THEN** run storage accepts its nonempty text name without a table migration or closed-list enum/type/constraint
- **AND** command validation remains responsible for deciding which workflows can execute

#### Scenario: Multiple targets have independent attempts

- **WHEN** check researches several Events
- **THEN** each started Event attempt has its own runId, input, lifecycle, and report; one failed attempt does not prevent the remaining attempts

#### Scenario: Non-failing results complete the lifecycle

- **WHEN** an attempt returns a non-failed catalog outcome without an unexpected workflow error
- **THEN** its lifecycle is completed, including partial research, unchanged checks, skipped duplicates, and dry-run previews
- **AND** recovered source errors do not by themselves make its lifecycle failed

#### Scenario: Research or writer failure finalizes the attempt

- **WHEN** research fails, a candidate is rejected, a limit is exhausted without usable data, or the atomic writer fails
- **THEN** the same row becomes failed with a finish time and final report containing the result, errors, and available statistics
- **AND** the command exits nonzero without relaxing catalog atomicity

#### Scenario: Unexpected post-start error is recorded safely

- **WHEN** an unexpected error occurs after the running row was persisted
- **THEN** the attempt is finalized as failed with a bounded host-generated workflow error and the best available report fields and statistics, and the command exits nonzero
- **AND** known research status, committed catalog outcomes/receipts, source history, model output, and usage are retained where available; unknown details are not invented

### Requirement: Run records identify their associated Event when known

Each run record SHALL have nullable event_id for an existing requested/matched Event or one committed by the attempt. Refresh/check SHALL set it at start; add SHALL start with null and resolve it at finalization. Rolled-back creation identifiers SHALL remain only in the report. Event association SHALL NOT require a foreign key or imply successful mutation.

#### Scenario: Targeted attempt starts with its Event association

- **WHEN** a validated refresh/check attempt starts
- **THEN** its running record has the requested event_id, including when research later fails

#### Scenario: Add resolves a persistent Event

- **WHEN** add matches an existing Event or commits a newly created Event
- **THEN** finalization stores that Event ID in event_id, including a skipped duplicate or later workflow error after commit

#### Scenario: Add does not retain a created Event

- **WHEN** a creation is previewed and rolled back or fails without committing an Event
- **THEN** event_id remains null, while proposed/preview identifiers remain in the report where available
- **AND** failed research before Event resolution also leaves event_id null

### Requirement: Stored run statistics retain accounting limits

Final run reports SHALL retain existing duration, model/prompt configuration, budgets, token usage, provider-reported model cost, estimated search cost, and completeness metadata. New reports SHALL mark searchCostBasis as estimate. Unknown accounting SHALL remain unknown. Stored runs SHALL NOT add token subsets to totals, invent usage/retrieval charges, or claim exact spending. Partial model-cost subtotals absent from the existing final report are outside this change.

#### Scenario: All reported statistics survive storage

- **WHEN** completed research and discovery return usage, model costs, and search-cost estimates
- **THEN** the persisted report retains their combined input/output tokens, cached-input and reasoning subsets, modelCostUsd, searchCostUsd, usage.complete, duration, and budget snapshot
- **AND** explicitly reported zero model costs remain zero and usage.searchCostBasis is estimate

#### Scenario: Search retries produce a formula-based estimate

- **WHEN** a discovery result returns after unsuccessful search attempts and calculates searchCostUsd from its attempt count and fixed formula
- **THEN** storage/JSON/eval output retain the numeric estimate with usage.searchCostBasis equal to estimate, and CLI text labels it estimated search USD
- **AND** the report does not claim that each attempt was billed or that usage.complete proves exact cost

#### Scenario: A later call fails after known usage

- **WHEN** some calls report usage and a later call fails or lacks accounting
- **THEN** the final report preserves known input/output counts, sets usage.complete to false, and keeps full modelCostUsd null when not fully known
- **AND** unavailable cached-input/reasoning details remain null; available search estimates are retained without being presented as provider-reported charges or complete spending

#### Scenario: Retrieval has no billed-cost metadata

- **WHEN** HTTP or Firecrawl retrieval does not supply billing metadata
- **THEN** retain available source outcomes and page counters without inventing a retrieval charge or interpreting missing charges as free service

### Requirement: Run persistence failures are visible without replaying work

Failure to save a running row SHALL abort that attempt before research. Failure to save its final status/report SHALL produce a safe persistence failure and nonzero command result, correlate it by runId when a start row exists, and leave that row running. Persistence failures SHALL NOT automatically retry research, undo committed catalog writes, or report successful durable finalization.

#### Scenario: Start insert fails

- **WHEN** the start record cannot be inserted, including because the database has not received the required migration
- **THEN** no context/source/model work or catalog mutation occurs for that attempt, and the command reports failure

#### Scenario: Final update fails after apply

- **WHEN** the catalog item committed but finalization fails
- **THEN** the command reports a persistence failure with runId, retains the available result for output, and exits nonzero
- **AND** catalog changes remain committed and the row remains running without a finish time or final report

### Requirement: Core run statistics are queryable as columns

Run records SHALL expose input_tokens, output_tokens, model_cost_usd, search_cost_estimate_usd, duration_ms, and usage_complete as nullable scalar columns. They SHALL start null and be finalized atomically from the same final report. Known incomplete counts SHALL retain a false completeness flag; unknown model cost SHALL remain null. Projected values SHALL be nonnegative, and completeness SHALL be boolean when set.

#### Scenario: Final statistics match the report

- **WHEN** an attempt is finalized, successfully or with a caught failure
- **THEN** the six columns equal usage.inputTokens, usage.outputTokens, usage.modelCostUsd, usage.searchCostUsd, durationMs, and usage.complete in report_json
- **AND** token totals include discovery, search cost remains an estimate, and known zero values remain zero

#### Scenario: Unfinished attempts have no final statistics

- **WHEN** a run is still running or its finalization fails
- **THEN** all six statistic columns remain null along with finish time and report_json, without claiming zero usage or cost

#### Scenario: A finalized report has incomplete accounting

- **WHEN** a final report contains known token counts but incomplete usage and unknown full model cost
- **THEN** the columns retain those counts, set usage_complete to false, and leave model_cost_usd null

### Requirement: Eval acceptance distinguishes host failures from expected research failure

Eval output SHALL preserve runId and available report data when finalization fails and SHALL identify safe host workflow/persistence failures. Those failures SHALL invalidate eval acceptance even when research/catalog outcomes are successful or a source-failure case otherwise meets expectations. Historical version 2 reports lacking additive runId/searchCostBasis fields SHALL remain readable.

#### Scenario: A late workflow error follows useful research

- **WHEN** an eval report retains successful research and a non-failed catalog outcome but contains workflow_failed
- **THEN** the case fails eval acceptance and the command exits nonzero while retaining its facts, runId, and available statistics

#### Scenario: Eval finalization fails with an available report

- **WHEN** a persistence error carries the report and runId of a started eval attempt
- **THEN** eval output retains them with a safe run_persistence_failed error rather than replacing them with an empty model-failure report
- **AND** the case fails acceptance, the command exits nonzero, and the database row remains running

#### Scenario: Expected source failure also has a host failure

- **WHEN** a blocked-source case otherwise matches its expected failed research but contains workflow_failed or run_persistence_failed
- **THEN** it fails eval acceptance; expected source failure alone remains acceptable when all existing criteria hold

### Requirement: Run records remain private bounded reports

Run input SHALL include only normalized operation settings and safe configuration metadata. Stored final reports SHALL retain the existing private report contract, including final model output, without storing credentials, environment dumps, prompts, full source pages, provider transport payloads, headers, or raw exception messages. Run records SHALL NOT be exposed through public website reads.

#### Scenario: Failure contains sensitive provider content

- **WHEN** a caught exception includes credentials or provider request/response content
- **THEN** store a fixed bounded error message and only recognized safe diagnostic fields, without copying the raw exception or transport data

#### Scenario: Source pages and model output are separate

- **WHEN** research reads page bodies and produces a final text/object response
- **THEN** persist the final modelResponse and safe source summaries/history, without copying source page bodies or the research prompt

### Requirement: Optional research traces correlate without governing run history

Enabled research spans SHALL retain the host-generated ingestion runId in sanitized metadata. Durable run lifecycle, accounting, and eval acceptance SHALL remain independent of optional best-effort tracing. Run storage SHALL NOT require trace records or derive statistics from spans.

#### Scenario: Enabled agent spans identify the attempt

- **WHEN** a started ingestion attempt executes the real agent with tracing enabled
- **THEN** every exported research span retains the same runId as the run row and report after sanitization
- **AND** the identifier is passed internally without adding it to the research prompt or exposing report contents in traces

#### Scenario: Tracing is absent or fails

- **WHEN** tracing is disabled, an injected generator bypasses it, or trace initialization/export/cleanup fails or loses spans
- **THEN** durable run recording still follows the research/catalog result and its report accounting
- **AND** trace diagnostics alone do not change lifecycle status, usage completeness, command exit status, or eval acceptance, nor become workflow/persistence failures

### Requirement: Trace lists identify the Event and edition roles

Labels SHALL show Event, context editions, mode and terminal research/mutation result, without a redundant apply marker. Primitive IDs SHALL remain stable. Context and committed mutations SHALL retain separate roles, stable edition keys and nullable years. Known years SHALL be visible; unknown years SHALL NOT be inferred from keys or dates.

#### Scenario: Partial historical discovery during a current-edition check

- **WHEN** check/apply with context year 2026 partially researches and creates cancelled edition 2023
- **THEN** initial/final labels identify Event, ctx:2026 and check; the final label adds partial and created:2023 without claiming 2026 was resolved
- **AND** details distinguish context and writer-confirmed mutations; uncommitted discoveries remain in the report

#### Scenario: Display-name precedence does not hide the label

- **WHEN** inspection prefers entity display name over operation name
- **THEN** both contain the same sanitized root label after terminal persistence/reload, without changing primitive IDs

#### Scenario: Addition, mismatched name, and long edition lists

- **WHEN** add lacks a saved target, a model name differs, or editions overflow
- **THEN** use requested/validated new names or canonical existing names; exclude unrelated context and uncommitted editions
- **AND** mark unknowns and omissions explicitly while preserving mode/result and non-year keys

#### Scenario: A nonnumeric edition key has a known year

- **WHEN** key summer has saved year 2026
- **THEN** retain both and show `ctx:2026 [key:summer]`; committed summaries use effective saved years, otherwise null

#### Scenario: A stable key survives a year correction

- **WHEN** year changes from 2026 to 2027 with key 2026 unchanged
- **THEN** context remains 2026; writer-confirmed mutations show `2027 [key:2026]` with their respective roles
- **AND** failed writes create no committed entries; a numeric key with unknown year shows `? [key:2026]`

### Requirement: Source diagnostics retain only bounded safe projections

Source spans SHALL expose bounded read URLs/outcome/reason/method/completeness/truncation and existing search queries/candidate URLs. Technical completion SHALL remain distinct from retrieval outcome. Diagnostics SHALL NOT change model-visible schemas, arguments, instructions or decisions. Full payloads SHALL remain excluded.

#### Scenario: A source fails without throwing

- **WHEN** readSource returns failed/request_failed despite normal SDK completion
- **THEN** its short label and safe output show source/failure, attempted/final URLs, method and known completeness/truncation

#### Scenario: Retrieval methods and truncation differ

- **WHEN** retrieval uses HTTP, Firecrawl, a social stub, caching or truncation
- **THEN** preserve method and distinct ok/partial/unsupported/blocked/failed outcomes; separate source/tool truncation and leave unobserved truncation unknown
- **AND** cached results do not imply another network request

#### Scenario: Discovery yields candidates or does not execute

- **WHEN** discovery completes, is budget-reserved, or throws
- **THEN** retain the bounded existing query, at most ten candidate URLs and returned/retained/omitted counts, excluding titles/snippets
- **AND** distinguish not_run from successful empty searches; thrown failures retain only safe arguments and fixed codes

#### Scenario: Source URLs retain diagnostic context

- **WHEN** source URLs enter read/search diagnostics, queries or labels
- **THEN** preserve their components, including query and fragment, within field limits, without token heuristics, secret matching or URL rewriting; mark truncation
- **AND** SDK/config credentials, authorization headers and transport payloads remain outside the field allowlist; source validation and actual requests remain unchanged

#### Scenario: Diagnostic input exceeds its limits

- **WHEN** projections exceed their limits
- **THEN** enforce these UTF-8 byte and entry maxima with Unicode-safe truncation while preserving status/counts; no separate character-count limits apply:

| Field                                   | Limit                           |
| --------------------------------------- | ------------------------------- |
| Source input + output                   | 8 KiB serialized UTF-8          |
| Root application metadata + output      | 16 KiB serialized UTF-8         |
| Query                                   | 1200 bytes                      |
| URL / label / source name               | 512 / 512 / 240 bytes           |
| Event name / edition key                | 320 / 160 bytes                 |
| Identifier or model / reason code       | 160 / 64 bytes                  |
| Candidate URLs / each edition-role list | 10 entries, with omitted counts |

### Requirement: One catalog-run trace covers the final result

Each enabled per-Event apply trace SHALL start before context/initial retrieval and parent research/source operations through validation, writing/rollback and report construction or failure. One outer span SHALL suffice without detailed HTTP stages. Native technical status SHALL remain distinct from root research, validation, write and mutation outcomes.

#### Scenario: Initial source fails before model research

- **WHEN** initial retrieval fails with oversized_response and later sources help
- **THEN** the initial failure and agent share the outer trace, ending after the report with independent research/write outcomes

#### Scenario: Structurally accepted facts are semantically wrong

- **WHEN** a mistaken candidate passes structure/target checks
- **THEN** record those checks and semanticValidation=not_run without claiming factual verification or adding semantic checks

#### Scenario: Terminal status dimensions remain independent

- **WHEN** a run terminates
- **THEN** retain native technical status without duplicating it in output; list labels expose partial/invalid/write-failed results even beside technical OK. Root output contains:

| Field                                   | Values / meaning                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| researchStatus / outcome                | Copy existing report values; omit if no report could be built                                            |
| structuralValidation / targetValidation | passed / failed / not_run, independently; only performed checks can pass                                 |
| semanticValidation                      | not_run                                                                                                  |
| writeState                              | Disposition below, independent of report outcome                                                         |
| errorCode                               | Fixed code for validation, research, write or workflow failure when applicable; no raw error text        |
| committedOperationCount                 | Number of confirmed changed operations; zero when no changes committed, null when disposition is unknown |
| editions                                | Bounded context and committed-mutation summaries                                                         |

#### Scenario: Context or report construction fails

- **WHEN** context/report construction throws
- **THEN** retain a fixed stage-specific errorCode and native error status with original failure behavior; preserve a prior confirmed commit and its count. Copy report statuses only if an existing normal or fallback report is available

### Requirement: Run traces distinguish write disposition from research outcome

Write state SHALL be committed, rolled_back, unchanged, not_attempted or unknown, independently of research/mutation status. The committed-operation count SHALL be null when transaction disposition is unknown. Invalid/failed research SHALL NOT appear as a successful no-op.

#### Scenario: Valid apply commits or changes nothing

- **WHEN** apply changes facts, changes nothing, or skips duplicate add
- **THEN** show writeState=committed or unchanged, with the report outcome and count of confirmed changed operations; duplicate add retains outcome=skipped, and unchanged does not deny transactions/idempotency receipts

#### Scenario: Invalid or failed research never reaches the writer

- **WHEN** structure/target validation fails, research fails, or abort precedes writing
- **THEN** show not_attempted, the applicable errorCode and zero committed operations; mark the failed check and leave unreached checks not_run

#### Scenario: Atomic writer rejects the item

- **WHEN** the writer throws under its atomic rollback guarantee
- **THEN** show writeState=rolled_back, errorCode=write_failed and zero committed operations; copy report researchStatus/outcome when available

#### Scenario: Transaction disposition is not established

- **WHEN** an unexpected failure leaves disposition uncertain
- **THEN** show unknown with null committed count and a fixed diagnostic, without guessing or changing recovery behavior

### Requirement: Saved ticket URLs remain edition-specific navigation leads

Main research SHALL retain saved ticket-variant URLs as private navigation leads for their owning editions when saved price payloads are removed from its context. Leads SHALL preserve edition association and SHALL NOT implicitly become official public links. Inspecting them SHALL use the existing source tools and limits; the specialist SHALL remain without retrieval tools.

#### Scenario: A saved variant provides the only useful ticket-page lead

- **WHEN** a targeted refresh/check has a useful edition ticket URL only in a saved variant
- **THEN** main research receives the URL without saved price payloads, can inspect it and route original Markdown to the specialist for that edition
- **AND** the lead alone does not assert current page ownership or officiality, change initial-source selection, consume retrieval capacity before inspection, or bypass source safety and budget limits

#### Scenario: Duplicate and shared saved ticket URLs

- **WHEN** saved variants repeat a normalized URL within an edition or share one URL across editions
- **THEN** main context deduplicates URLs within each edition while retaining every owning edition's association, without exposing unrelated Events during targeted research

### Requirement: Ticket interpretation receives an edition-bound source handoff

The main researcher SHALL establish Event/edition identity and route relevant inspected pages. The ticket specialist SHALL receive the exact edition context, saved ticket block in original currency units, original inspected Markdown with URLs and retrieval limitations, and no search/retrieval tools. It SHALL NOT reassign Event identity, create editions, or change non-ticket facts.

#### Scenario: Shared pages retain original context

- **WHEN** one inspected page contains ticket information for multiple editions or parallel same-brand festivals
- **THEN** hand off the original page text and separate fixed edition contexts, preserving year, geography and ownership cues without substituting a paraphrase
- **AND** specialist uncertainty about ownership leaves affected tickets omitted with a question

#### Scenario: Saved money supplies complete replacement context

- **WHEN** an existing edition is checked
- **THEN** the specialist receives that edition's saved variants and primary price in original currency major units, including qualifications and actual saved coverage
- **AND** another edition's price block is never substituted; a new edition receives an empty unknown saved block

#### Scenario: No independent retrieval

- **WHEN** a handed-off source is insufficient, unreadable, or contradictory
- **THEN** the specialist reports the unresolved ticket check without searching, fetching, asking the main model to navigate again, or retrying

#### Scenario: Original handoff cannot fit

- **WHEN** original selected Markdown plus specialist context exceeds the configured input limit
- **THEN** make no specialist call, preserve affected prices, and report the input limit with unfinished ticket checks instead of silently truncating or replacing original content

### Requirement: Specialist ticket decisions preserve complete price semantics

The specialist SHALL return one entry per requested edition containing only its exact key, an optional explained complete variants/basePrice block, and an unresolved question list. Per-edition status, model-generated errors, summaries and other extra fields SHALL be rejected. An empty question list with no replacement SHALL mean the check found no supported replacement; an unfinished check SHALL be described with its cause in unresolved. A valid complete block SHALL remain usable alongside questions. The host SHALL scope questions to their entry's edition and tickets field and SHALL report execution, limit and validation failures itself. Returned paid values SHALL use original major currency units; deterministic code SHALL validate precision and convert stored primary money. Full-programme basePrice SHALL exclude eligibility concessions. Omission SHALL preserve prices; explicit supported empty variants and null basePrice SHALL clear them. Availability corrections SHALL replace the whole intended block.

#### Scenario: Specialist contract has no redundant status or error fields

- **WHEN** a specialist entry includes status, errors, summaries or another unsupported field
- **THEN** reject the whole batch, preserve its saved prices, and report a host validation error with edition-scoped unfinished questions

#### Scenario: Complete replacement can coexist with uncertainty

- **WHEN** a valid specialist entry supplies a complete explained ticket block and an unresolved ticket question
- **THEN** accept the complete block and retain the question without inventing a per-edition status or changing main success/partial

#### Scenario: Concession-only information

- **WHEN** the specialist finds only eligibility-restricted admission, including free child tickets
- **THEN** retain the categories and conditions in variants and return null basePrice rather than a concession or free full-programme base

#### Scenario: Coverage and fee conditions remain qualified

- **WHEN** inspected pages distinguish day passes, general-sale full-programme passes, optional upgrades and fees
- **THEN** preserve supported labels, amounts and conditions without using a day pass, concession or admission-excluding upgrade as the full-programme base or inventing unsupported totals

#### Scenario: Availability-only correction

- **WHEN** a category's sales have ended and the complete intended block remains supported
- **THEN** return the entire variants/basePrice block with closed for that category and preserve supported other categories and prices
- **AND** do not infer sold_out, cancellation or aggregate availability; omit replacement with uncertainty if the whole block cannot be supported

#### Scenario: Explicit clearing differs from absence

- **WHEN** usable evidence supports clearing the saved prices
- **THEN** return an explained empty variants list with null basePrice and clear the primary stored fields
- **AND** unavailable, absent or partial page content alone omits replacement and preserves saved prices

#### Scenario: Currency precision remains deterministic

- **WHEN** specialist values include EUR 100.50, JPY 1000 or KWD 1.234
- **THEN** retain variant major-unit values and convert primary amounts to 10050, 1000 and 1234 minor units respectively
- **AND** invalid precision or unsafe integer bounds reject the specialist batch without rounding or clearing any affected prices

### Requirement: Ticket completion is independent of main research status

Final research SHALL retain valid main success/partial status independently of ticket navigation and interpretation. Unfinished routing, accepted or omitted specialist replacements, unresolved ticket questions, and specialist execution failures, rejection or limits SHALL NOT downgrade main success or upgrade main partial. Ticket completion SHALL remain visible through per-edition unresolved questions and the compact host-owned ticket-stage record, with host errors for technical failures. Valid independent per-edition results SHALL remain usable when another edition's check is unfinished; malformed batches SHALL contribute no price replacements. Invalid main or assembled final candidates SHALL still fail with no operations.

#### Scenario: No ticket details on reasonably checked pages

- **WHEN** reasonable relevant inspection completes the ticket check but no published ticket detail is found
- **THEN** omit tickets, preserve saved values, and permit success, using inspected-page limits in summaries rather than claiming unannounced information without evidence

#### Scenario: One edition remains unfinished within a valid batch

- **WHEN** a valid specialist response supplies a complete ticket block for one edition and omits replacement for another with an unresolved check and its cause
- **THEN** use the complete supported block for the first, preserve prices for the second, and retain main success/partial with an edition-specific ticket question and cause

#### Scenario: Ticket-only failure retains overall success

- **WHEN** main research is success and ticket routing is unfinished, specialist questions remain, or specialist execution fails, returns malformed output or reaches a limit
- **THEN** retain overall success, preserve every unaccepted price block, and expose edition-scoped ticket questions and appropriate errors separately
- **AND** supported main facts remain eligible for one atomic update; a ticket-only failure does not itself cause a failed catalog outcome or nonzero CLI exit

#### Scenario: Successful ticket work cannot complete a main core check

- **WHEN** main research is partial because an identity, relevant edition/dates or location check remains unfinished and the specialist succeeds
- **THEN** retain overall partial with the original non-ticket core question and cause; accept any valid ticket block without upgrading main status

#### Scenario: Failed main research remains failed

- **WHEN** main research has no usable result or fails target/structure validation
- **THEN** do not run the specialist or use saved prices as substitute findings; retain failed/no-operation behavior

### Requirement: Research stages share the configured budget

Main research, discovery and ticket specialization SHALL share one configured call budget and deadline with unchanged per-call input/output limits. Research SHALL reserve capacity for its main final draft and at most one specialist batch without increasing defaults. Every started call SHALL consume shared capacity except existing refunded main provider_unavailable attempts. Other failures SHALL retain spent capacity. Main SHALL retain only its existing bounded capacity-error retries; specialist and corrective model calls SHALL NOT retry. Existing bounded discovery retries SHALL remain subject to the same shared reservation and limits.

#### Scenario: Source navigation approaches the reserved calls

- **WHEN** only the main-final and specialist reserved calls remain
- **THEN** disable further main tools/discovery model work, finalize the main draft, and use at most the specialist reservation

#### Scenario: Only one call is available

- **WHEN** the run starts with one model call
- **THEN** use it for main final research with tools disabled, preserve requested specialist prices, and retain valid main success/partial with a ticket-scoped modelCalls limit if specialization is needed
- **AND** zero available calls produces failed research without generation

#### Scenario: Specialist deadline expires

- **WHEN** the original deadline expires before or during specialist execution
- **THEN** stop model work, preserve affected prices and known usage, and permit deterministic composition/apply of otherwise valid main findings without changing their success/partial status

#### Scenario: Specialist capacity rejection is not retried

- **WHEN** the one specialist attempt receives provider_unavailable
- **THEN** retain its spent call without refund or retry, preserve affected prices and main status, and report safe ticket diagnostics with incomplete usage when unavailable
- **AND** disable default and explicit retry processors in addition to modelSettings retries

#### Scenario: Specialist reuses source content

- **WHEN** the host hands off cached inspected pages
- **THEN** charge only any actual specialist model call, with no new page/search consumption for copying content

### Requirement: Main research owns page summaries

The main researcher SHALL supply page summaries under the existing source-summary contract. The ticket specialist SHALL supply ticket explanations and unresolved questions without a separate source-summary list, per-edition status or model-generated errors. Final assembly SHALL preserve validated main summaries without stage concatenation or tighter summary bounds; retrieval history and handoff membership checks SHALL remain separate.

#### Scenario: One page supports general and ticket facts

- **WHEN** an inspected page supplies general facts and a ticket listing
- **THEN** retain one main-owned contextual page summary and explain specialist ticket decisions in the ticket block's reason
- **AND** no second-stage summary merge or main-model rewrite is required

#### Scenario: Specialist work fails or changes nothing

- **WHEN** specialist work is rejected, limited, omitted or a no-op, or the writer later fails
- **THEN** retain the validated main summaries and source retrieval history independently of the ticket result

#### Scenario: Handoff membership remains enforced

- **WHEN** routed source URLs lack corresponding session reads
- **THEN** reject the invalid handoff under its structural checks rather than accepting an unread page as specialist evidence

### Requirement: Ticket specialization reuses existing evaluation

Evaluation SHALL distinguish offline deterministic tests from billable model checks. Existing fixed-source evals SHALL support the specialist workflow; saved before/after reports from identified Git revisions SHALL permit comparison on common fixtures and configuration. Paid runs SHALL require explicit authorization and SHALL NOT run in default tests. Semantic outcomes, total resources and failures SHALL remain visible.

#### Scenario: Offline checks cover ticket edge cases

- **WHEN** specialist behavior is verified with injected outputs
- **THEN** test concessions, coverage, fees/conditions, zero/three-decimal currency, closed/sold_out, clearing, failure preservation and cross-edition ownership
- **AND** check assembled/effective state where change-only assertions would miss preservation or no-op behavior, without claiming model accuracy

#### Scenario: Before and after model checks are later authorized

- **WHEN** the owner authorizes model checks at the pre-change and updated Git revisions
- **THEN** use the existing runner with common fixed fixtures, catalog state, date, model settings and per-run limits; retain separate reports and revision/configuration identity
- **AND** compare ticket and non-ticket outcomes, total tokens/cost and wall time including failed or partial runs; unavailable costs stay unknown and benefits require evidence; distinguish status changes caused by the new completion policy from model-quality differences
