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
The system SHALL start discovery, source checks, and refreshes only through an owner-initiated local operation in the first version. Model calls SHALL use OpenRouter. Owner-initiated execution through the loopback Mastra Studio server is supported alongside the local CLI. Legacy import, hosted collection services, and unattended scheduling remain outside scope.

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
The local catalog CLI SHALL accept a festival name for `add` and one or more Event IDs for `refresh`. Refresh SHALL accept `--scope full|current`, defaulting to `full`; `check` SHALL be rejected before research. It SHALL NOT require an operator name or accept an Edition ID as a target. Applied changes SHALL retain the fixed research actor in audit history; the initiating owner MAY be absent.

#### Scenario: Add without an operator name
- **WHEN** a local user starts `add` with a festival name and no operator name
- **THEN** research can run and applied changes identify `catalog-research` as the actor

#### Scenario: Check several Events
- **WHEN** a local user starts `refresh` with several Event IDs
- **THEN** each distinct Event is researched and committed independently with its assigned Editions
- **AND** a failed Event does not stop the others; any failed Event makes the command exit nonzero

#### Scenario: Removed or invalid command options
- **WHEN** a user supplies check, an unknown scope, or a scope option for add
- **THEN** the command rejects the input before opening a database or making model calls

#### Scenario: Unsupported CLI targets
- **WHEN** a local user supplies an operator or Edition target flag
- **THEN** the CLI rejects the unsupported flag before research starts

### Requirement: Festival addition covers historical and announced editions
The system SHALL research a new festival's identity, latest completed edition, and next announced edition, collect official links, and produce a short factual English Event description from the model’s source interpretation. Edition-specific facts SHALL remain associated with their own Editions. Missing information SHALL remain unknown; an unannounced next edition SHALL NOT be invented from prior-year dates or location.

#### Scenario: Both editions are documented
- **WHEN** official sources document the latest completed edition and the next announced edition
- **THEN** the run collects their facts separately under the same matched Event, collects official links, and generates a factual English description without presenting historical details as current

#### Scenario: No next edition is announced
- **WHEN** the inspected sources support a completed edition but no next edition
- **THEN** the run retains the supported history and reports that no next announcement was found in those sources without creating a forecast Edition

### Requirement: Existing events can be validated and refreshed
The system SHALL research existing Event and Edition information through an explicit full or current assignment, rechecking populated and missing supported facts for errors and updates. Only in-scope proposals that pass country and structural guards SHALL reach catalog operations. Missing optional information SHALL NOT block other proposed changes or eligible publication; unfinished assigned checks SHALL remain visible.

#### Scenario: Existing venue changes
- **WHEN** the model proposes a new venue for an existing Edition
- **THEN** the refresh updates that Edition while preserving other Editions' locations and reporting unresolved fields

### Requirement: Known links can be checked for new information
The system SHALL support checks of known event and Edition links for new or changed information, including dates, location, and ticket availability. A page-content change alone SHALL NOT write a catalog change; the model must propose a changed catalog value. These checks SHALL belong to refresh; a separate monitoring engine or stored page-diff history is not required.

#### Scenario: Page changes without fact changes
- **WHEN** a known page changes wording but supports the same accepted catalog facts
- **THEN** the run reports the catalog facts as unchanged and creates no duplicate catalog change

### Requirement: Social links remain usable without content retrieval
The system SHALL preserve stored Facebook and Instagram links for catalog display while reporting their automated content retrieval as unsupported in the first version. Unsupported retrieval SHALL NOT by itself clear stored values.

#### Scenario: Festival has a website and Instagram link
- **WHEN** a run checks a festival with an accessible official website and an Instagram link
- **THEN** it processes the website, retains the Instagram link, and reports Instagram retrieval as unsupported without blocking other model-proposed facts

### Requirement: Candidate matching respects enduring Event identity
The model SHALL use linked URLs, available official IDs, canonical URLs, name, geography, and Edition facts to select an Event without requiring a separate source registry. It SHALL keep parallel festivals under one brand as separate Events while preserving one Event when a festival relocates between years. Saved URLs SHALL be research leads, not proof of identity. The host SHALL enforce requested targets and the country guard without independently adjudicating source authority or ambiguous identities.

For `refresh`, research SHALL load only the requested Event's private context.

#### Scenario: Unrelated catalog records are excluded from targeted research
- **WHEN** a refresh targets one Event in a catalog with unrelated Events
- **THEN** the agent receives only the requested Event's private context

#### Scenario: Same brand in different countries
- **WHEN** two recurring festivals share a brand but operate in different countries at the same time
- **THEN** candidate matching preserves separate Event identities

#### Scenario: A festival relocates
- **WHEN** official continuity establishes that a recurring festival moved to a new location
- **THEN** refresh may link an in-scope Edition to the existing Event only when the country guard permits it
- **AND** a cross-country relocation fails the whole refresh even with official continuity; duplicate add still returns skipped with the existing Event ID and creates nothing

### Requirement: Model output is accepted as the research decision
The model SHALL interpret inspected material and propose facts and links within the requested assignment. The host SHALL enforce schema, assignment target boundaries, simple scope bounds, country conflicts, explanations, and target checks. Outside these explicit checks, it SHALL accept factual interpretation without verifying citations, source authority, ticket-link provenance, other contradictions, or supersession.

#### Scenario: A source claim is semantically wrong
- **WHEN** the model returns a structurally valid but mistaken fact that passes assignment and country checks
- **THEN** the host does not perform a second semantic check and the model eval can flag the resulting change

#### Scenario: Inspected sources conflict
- **WHEN** the model proposes an in-scope, structurally valid fact despite a conflict between inspected sources, without violating the country guard
- **THEN** the host applies the proposal without dropping the field for lack of confirmation

#### Scenario: Model omits a price block
- **WHEN** the model omits the tickets block after a failed source read
- **THEN** the stored price block is preserved

### Requirement: Runs report attributable outcomes
The system SHALL report each run's mode (`add` or `refresh`) and resulting record outcome (`created`, `updated`, `published`, `unchanged`, `skipped`, or `failed`), with stable catalog identifiers where a record exists. Reports SHALL include the run's proposed or applied old/new values, factual explanations, and inspected source URLs. Refresh reports SHALL also include scope, static task/context, and retain returned facts, including unchanged findings, in the raw model response, plus existing unresolved questions and source summaries, even when nothing changes. Omitted facts SHALL NOT receive inferred not_found/unfinished outcomes or confirmations. Reports SHALL NOT include a separate verification array or returned-fact counters; actual changes SHALL use the existing writer audit. They SHALL separately identify research status, execution errors with stages, and unresolved questions; a catalog mutation outcome SHALL NOT stand in for research completion. Source-check results SHALL identify the inspected URL, UTC check time, and outcome, distinguishing unsupported retrieval from successful checks and failures. CLI/eval reports SHALL use version 3. Failed research/writing SHALL exit nonzero; partial alone SHALL exit zero. Reports SHALL NOT require persistent source identifiers. Every started attempt SHALL retain its durable runId and final report in ingestion_runs, including failures, previews, and no-ops; exported reports SHALL match stored reports.

#### Scenario: Preserve the final model response
- **WHEN** a model generation returns a final response
- **THEN** private research and eval reports retain its final text and unnormalized structured object in `modelResponse`, separately from catalog operations
- **AND** the response remains available when candidate validation or writing fails
- **AND** unavailable responses or components are recorded as null, without copying prompts, page bodies, or transport metadata

#### Scenario: Reasoning configuration and token accounting

- **WHEN** the owner configures a supported reasoning effort
- **THEN** research and discovery requests send that effort and reports identify the requested setting
- **AND** omitting the setting explicitly selects `medium`
- **AND** reports accumulate provider-reported input, output, cached input, and reasoning token counts from completed steps, retaining those counts when a later step fails or is interrupted and using null for unavailable cached input or reasoning details
- **AND** reports set `usage.complete` to false when a call fails, is interrupted, lacks token usage, or includes unaccounted discovery attempts; the CLI marks the known token counts as partial
- **AND** reports retain the sum of known provider-reported model costs even with incomplete accounting, using null only when none are known; an explicitly reported zero remains zero and searchCostBasis remains estimate

#### Scenario: Unchanged recheck
- **WHEN** a recheck confirms the current accepted facts without changes
- **THEN** the run reports unchanged and creates no duplicate catalog change

#### Scenario: Source cannot be fetched
- **WHEN** a known source fails to load and the model proposes no changes
- **THEN** the report identifies the attempted URL, check time, and failure without changing catalog facts or audit history

#### Scenario: Explanations survive dry-run reporting
- **WHEN** an explained factual proposal produces a dry-run diff
- **THEN** the report retains its reason alongside the actual previewed old/new values and retains source summaries separately
- **AND** the dry run retains no catalog fact, version, audit, or receipt changes; its ingestion run and final preview report persist

#### Scenario: Research succeeds but writing fails
- **WHEN** the writer rejects valid research operations
- **THEN** preserve research status, report write-stage error/outcome failed, and commit no catalog changes; retain the failed ingestion run

#### Scenario: Partial no-op remains visible
- **WHEN** partial research changes nothing
- **THEN** text/JSON show partial plus unchanged, separating questions from errors

#### Scenario: Only the new report contract is supported
- **WHEN** a consumer receives an unsupported report version
- **THEN** it rejects that version explicitly, without legacy gaps fallback or automatic conversion
- **AND** new reports use version 3 and do not emit gaps

#### Scenario: Report compatibility is owned by application code
- **WHEN** the private run-table migration removes ingestion_runs_report_ck
- **THEN** existing rows and report JSON remain unchanged, including historical version-2 reports
- **AND** application finalization validates the active report version and run correspondence; database report storage does not restrict report versions

#### Scenario: Saved output correlates with the database
- **WHEN** an attempt finishes and the owner requests JSON output or a --report file
- **THEN** its runId and report content match the stored final report
- **AND** optional file-export failure does not change the finalized run record

### Requirement: Dry runs preview changes without applying them
The system SHALL let the owner inspect a transient diff of proposed catalog changes before an apply run. Dry-run SHALL use a transaction on the catalog database and roll it back without retained catalog record, version, audit, or receipt changes; it SHALL NOT create a database copy. The ingestion run record and final preview report SHALL persist outside that rollback.

#### Scenario: Dry run of a venue correction
- **WHEN** the owner requests a dry run for a model-proposed venue change
- **THEN** the output shows the proposed old and new values while the catalog version and audit history remain unchanged
- **AND** its run record and final preview report persist

#### Scenario: Dry-run addition has transient catalog identifiers
- **WHEN** dry-run previews creating an Event and its Editions
- **THEN** those catalog rows, versions, audit entries, and receipts are rolled back
- **AND** the finalized run report retains the preview, including transient identifiers, without requiring those identifiers to reference retained catalog records

### Requirement: Eligible apply runs publish without review queues
The system SHALL apply and publish model-proposed, structurally eligible records directly through catalog operations, with atomic audit history and no per-item or batch approval task.

#### Scenario: Complete new festival
- **WHEN** an owner-initiated run proposes a new in-scope Event and Edition with all structurally required publication facts
- **THEN** the apply operation publishes them, records the changes atomically, and reports stable identifiers

### Requirement: Interrupted collection can be rerun from current state
After interruption, a new owner-initiated run SHALL reload the catalog and research again with new operation keys. Committed changes SHALL remain; incomplete item transactions SHALL roll back. Existing writer receipt idempotency SHALL remain supported. An attempt stopped before finalization SHALL remain running with no finish time or final report; this SHALL NOT be treated as proof of success or failure. Reruns SHALL create new run records without changing earlier records. Automatic run recovery and a history-viewing command remain outside the current scope.

#### Scenario: Owner reruns after interruption
- **WHEN** a run stops after one festival is committed and the owner starts it again
- **THEN** the new run uses current catalog state without duplicating that festival or resuming a saved operation file

#### Scenario: Process stops after catalog commit
- **WHEN** the process is killed after an item commit but before run finalization
- **THEN** committed catalog changes remain and the attempt remains running with unknown final result and usage
- **AND** a new owner-initiated attempt has a different runId and starts from current catalog state

### Requirement: One research result governs each atomic catalog update
Research SHALL produce one final structured result. Only valid success or partial data for the requested assignment that passes country guards SHALL produce catalog operations; omitted values SHALL be preserved. Failed or invalid results SHALL produce no operations or automatic model correction attempts. Catalog updates SHALL enforce structural, version, no-op, and publication rules atomically: an invalid operation SHALL leave the whole item unchanged.

#### Scenario: A validated proposal violates catalog constraints
- **WHEN** a proposal passes candidate validation but violates catalog constraints, such as clearing dates while retaining scheduled status
- **THEN** the whole item remains unchanged and the run reports write_failed while preserving research status

#### Scenario: Research needs a more specific page
- **WHEN** an inspected page leaves a material question unresolved
- **THEN** the agent may read a relevant linked page or discover a source within its budget before returning its one research result

#### Scenario: Research receives saved link context
- **WHEN** a refresh starts with saved links
- **THEN** all saved links are available to research with their owner and Edition context where known

#### Scenario: Addition starts without a source URL
- **WHEN** the owner starts `add` with a festival name
- **THEN** the agent discovers and inspects a candidate source before returning its proposal

#### Scenario: Intermediate commentary is not a catalog proposal
- **WHEN** research returns commentary while still requesting source information
- **THEN** commentary produces no catalog operations; research may continue within its budget
- **AND** only the final result that passes schema and target validation can produce operations

### Requirement: Add creates new Events without updating existing ones
Add SHALL create a new Event or skip a recognized existing Event. A duplicate SHALL return catalog outcome skipped and the existing ID, with no operations or publication changes. Research status/diagnostics SHALL remain visible; skipped alone SHALL exit zero. Existing-record updates SHALL require targeted refresh.

#### Scenario: Duplicate add proposes changed facts
- **WHEN** add selects an existing Event and proposes changed summary, links, tickets, or Editions
- **THEN** the host returns skipped with its ID and produces no writes, including publication

#### Scenario: Add identifies a new festival
- **WHEN** add returns a valid new identity without an existing Event match
- **THEN** it may create that Event and its researched Editions atomically

#### Scenario: Updates require an explicit target
- **WHEN** refresh targets an existing Event
- **THEN** supported updates apply only to that target; unknown or mismatched IDs are rejected

### Requirement: Research results distinguish completion from catalog mutation
Research SHALL return `status`, `data`, `errors`, and `unresolved`. Success/partial SHALL contain data; failure SHALL contain null data and produce no operations. Status SHALL describe research completeness independently of catalog changes or announcement completeness. Refresh completeness SHALL cover current-selection research, and every assigned Event/Edition field check. Add SHALL retain its historical and announced Edition research; duplicate add needs only identity. Partial SHALL require a useful result and a specific unfinished required check with its cause in unresolved.

#### Scenario: Successful check changes nothing
- **WHEN** inspected material completes the requested check
- **THEN** status is `success`, even with no changes; empty changes alone do not prove completion

#### Scenario: The next edition is only partly announced
- **WHEN** reasonable relevant checks find an announced Edition and dates but no published venue or prices
- **THEN** success may contain the known facts and omit missing fields, preserving saved values and describing announcement limits in source summaries
- **AND** use “not found on inspected pages” unless evidence supports “not yet announced”

#### Scenario: A core check remains unfinished
- **WHEN** a relevant source failure is not recovered, a material conflict remains, or the budget ends before an assigned check finishes, but valid final data exists
- **THEN** return partial with the specific unfinished check and its cause; valid facts remain applicable and omitted fields preserve stored data
- **AND** missing optional data after a completed relevant check does not count as unfinished research; an unattempted assigned optional-field check does

#### Scenario: Optional unknowns do not force partial
- **WHEN** all assigned checks are complete but capacity, precise coordinates, socials, a completed schedule status, or a future Edition announcement are unavailable
- **THEN** success may retain optional questions; never invent facts or a completed status, or change stored values just to fill missing fields

#### Scenario: Failed research needs no invented candidate
- **WHEN** no usable result exists
- **THEN** status is `failed`, data is null, and at least one error/question explains it
- **AND** a valid failure response is accepted and the report preserves failed status with null data

#### Scenario: Repeated input is not a research finding
- **WHEN** refresh cannot obtain usable source findings and only the supplied identity, saved facts, or URLs remain
- **THEN** return failed with null data and a source-failure explanation, not partial with an empty candidate shell
- **AND** source-verified unchanged findings still qualify for success/partial according to completed checks; duplicate-add identity matching remains sufficient

#### Scenario: Inconsistent result is rejected
- **WHEN** failed data is non-null, success/partial data is null, partial has no question, or failure has no diagnostics
- **THEN** validation rejects the result before operations

### Requirement: Execution errors and unanswered questions are separate
Errors SHALL carry a code and bounded message, with optional URL/target. Questions SHALL carry a bounded message and optional editionKey/field, without code/blocking. Runtime failures SHALL be host-reported without exposing credentials or provider payloads. Ordinary unanswered questions SHALL NOT veto independent valid facts. A country conflict SHALL be a host validation failure for the whole Event, not merely an unanswered question.

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
- **WHEN** execution fails or exhausts its limit without valid final output
- **THEN** the host reports failure with an error and null data; intermediate/malformed facts are not written

### Requirement: Edition proposals use named typed fields
Editions SHALL use unique `key` descriptors and typed `year` facts, with named `{ value, reason }` facts, complete `tickets`, and `classification` patches. Add and refresh SHALL retain the existing proposal shape: return supported named facts as `{value, reason}`, omit unknown/unverified facts, and explain them through model-authored unresolved questions. New per-field status unions, not_found/unfinished finding objects, and a separate identity field SHALL NOT be introduced. Existing fact reason and unresolved semantics SHALL remain unchanged: data.reason is required only for creation, and partial results still require an unfinished-check question. Omission alone SHALL NOT cause host-derived partial status or a per-field completion outcome. Add SHALL retain its existing proposal form and descriptors. Ownership SHALL follow the enclosing Edition. Omission SHALL preserve values; explicit null SHALL clear only nullable facts. Legacy generic claims/prices SHALL be rejected.

#### Scenario: Facts for two editions remain separate
- **WHEN** venue and ticket proposals concern different Editions
- **THEN** each is nested and applied only within its Edition, without repeated key

#### Scenario: Typed fields replace generic field names
- **WHEN** output contains wrong types, unknown properties, claims, top-level/Edition prices, or nested priceDetails
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

#### Scenario: Refresh retains the existing proposal shape
- **WHEN** refresh returns a supported country or ticket fact
- **THEN** the fact uses the existing value/reason shape and existing nullable-fact, complete-ticket, classification-patch, and link-slot rules
- **AND** no parallel findings or field-status payload is returned

#### Scenario: Unknown or unverified values have no placeholder
- **WHEN** inspected sources do not establish a value or its check is unfinished
- **THEN** omit that fact and describe the limitation in an existing unresolved entry with optional editionKey/field
- **AND** do not repeat a saved value or use inner value:null as a substitute for absent evidence

#### Scenario: New field-status variants are rejected
- **WHEN** a fact contains a not_found/unfinished status object instead of the existing value/reason shape
- **THEN** strict schema validation rejects the result before operations

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
Only labelled tickets.value.variants SHALL propose availability: unknown/available/sold_out/closed. Edition-level availability proposals SHALL be rejected; no Edition-wide value SHALL be inferred from variants or exposed publicly. Complete ticket replacement SHALL remain required. Assigned ticket checks SHALL cover published amounts, eligibility, coverage, and availability; qualified offers SHALL retain their qualifications and base-price eligibility. Incomplete extraction SHALL NOT discard unverified saved categories.

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

#### Scenario: Packages and concessions are published
- **WHEN** inspected pages publish package, day, upgrade, or concession offers
- **THEN** research captures supported offers with qualifications and preserves base-price eligibility rules
- **AND** price omission despite readable relevant content leaves the ticket check unfinished rather than complete

#### Scenario: Only part of a saved ticket block can be verified
- **WHEN** research cannot establish a complete intended replacement without accidentally dropping unverified saved categories
- **THEN** it omits the ticket mutation, preserves the saved block, and reports the incomplete check

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
- **THEN** reject the proposal without rounding or applying writes

#### Scenario: Concession tickets do not set the base price
- **WHEN** youth, student, senior, resident, or other eligibility-based concession prices are known
- **THEN** retain them in variants but exclude them from basePrice, including concession-only free admission
- **AND** if only concession prices are known, basePrice is null; general-sale discounts are not excluded merely for being cheaper

#### Scenario: Range and free admission remain explicit
- **WHEN** a base price is supplied
- **THEN** exact/from bounds match, range max exceeds min, and coverage is full_programme
- **AND** free requires no invented currency and maps to zero minor units; null basePrice means unknown

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
Host-generated model_failed errors SHALL preserve bounded safe structured diagnostics in CLI text, JSON, and eval reports: recognized error/cause types, HTTP status, provider/network code, and retryability when available. Unknown fields SHALL remain absent or explicitly unknown. Diagnostics SHALL exclude raw exception messages, provider payloads, request/response headers, prompts, and credentials. Research limits SHALL retain precedence over model_failed. Ordinary research SHALL retry only explicit OpenRouter `provider_unavailable` errors, at most three times per run with 10-second, 30-second, and 90-second exponential backoff within the existing deadline. Unavailable attempts SHALL retain ordinary research capacity through bounded retry allowance. Other model failures SHALL NOT trigger automatic retries; known usage accounting SHALL be retained. Retries SHALL retain completed steps and SHALL NOT replay their tools or estimate missing usage/cost.

#### Scenario: Provider or network failure
- **WHEN** a model request fails and safe technical diagnostics are available
- **THEN** the report preserves that metadata with failed research and no operations, without exposing raw content

#### Scenario: Provider failure produces no final result
- **WHEN** a provider failure ends research without a final result
- **THEN** report model_failed with available safe diagnostics, not invalid_candidate, after any permitted provider_unavailable retries

#### Scenario: Unavailable provider preserves research capacity
- **WHEN** OpenRouter explicitly reports provider_unavailable during ordinary research
- **THEN** retain ordinary research capacity using bounded retry allowance and retry at most three times with 10-second, 30-second, and 90-second delays, cancellable at the run deadline
- **AND** retain completed steps, tool results, and known usage; other provider errors are not retried

#### Scenario: A provider failure follows completed work
- **WHEN** a model request fails after earlier calls have reported usage
- **THEN** the model_failed report retains known input/output tokens and cost without estimating unreported usage

#### Scenario: Unknown or budget failure
- **WHEN** safe failure details are unavailable or the research budget is exhausted
- **THEN** diagnostics remain bounded, missing details are not invented, and budget exhaustion remains limit_reached

### Requirement: Local research tracing is optional and independent

The owner SHALL be able to enable apply-run tracing independently of application logging. Eligible runs SHALL use a durable runId and one outer root with native agent/tool relationships. Tracing SHALL be best effort and SHALL NOT change research decisions, budgets, retries, catalog writes, report semantics, durable run records or exit status. Dry runs and injected candidate generators SHALL create no trace spans.

#### Scenario: Tracing only
- **WHEN** eligible apply research runs with tracing enabled and logging disabled
- **THEN** spans persist with runId and selected host fields, without requiring application logs

#### Scenario: Ineligible run
- **WHEN** a dry run or injected candidate generator executes
- **THEN** no spans are created regardless of the tracing switch

#### Scenario: Trace failure
- **WHEN** initialization, export, flush or shutdown fails
- **THEN** ingestion retains its original result/error and cleanup phases are still attempted with fixed content-free diagnostics

### Requirement: Exported research traces exclude content payloads

Host-owned span input/output/metadata SHALL contain only explicitly selected values. SDK-generated spans SHALL suppress automatic sensitive content at its source where supported; otherwise a minimal fail-closed exclusion SHALL remove prompts, message history, source bodies, full responses, transport payloads and raw errors before persistence. Safe host-owned fields, identity, timing, technical status and relationships SHALL remain visible. No generic recursive field allowlist or whole-projection byte cap is required for host-owned objects.

#### Scenario: Automatic model span captures messages
- **WHEN** the SDK attempts to attach prompts or model history to a span
- **THEN** stored spans exclude that content across creation and update/export events

#### Scenario: Host source metadata is selected
- **WHEN** the host records a source retrieval result
- **THEN** its explicit status, URL, method and completeness remain after reopen without the source body

### Requirement: Research tracing does not forward SDK logs

Enabling tracing or application logging SHALL NOT forward unrestricted SDK-generated logs. The exporter SHALL admit selected application Pino events through a narrow source distinction and exclude SDK logs by default. Sensitive SDK span payloads SHALL be suppressed at their source where supported or excluded by the smallest necessary fail-closed export mechanism.

#### Scenario: SDK generated content
- **WHEN** the SDK creates an automatic log or span containing a prompt, message history, source body, or full response
- **THEN** the stored observability record excludes that content without removing safe host-owned trace fields

### Requirement: Local traces use best-effort persistence and can be inspected

Tracing SHALL use the local observability store separate from the catalog and remain inspectable after exit. Completion, handled errors and cooperative aborts SHALL end owned spans and attempt bounded flush and shutdown. Logging and tracing SHALL be independently configurable. Overlapping background writes or forced termination may leave incomplete traces without changing catalog transaction guarantees.

#### Scenario: Fresh process inspection
- **WHEN** a completed run releases the store and Studio later opens it
- **THEN** safe root/source labels, result fields and the registered ingestion graph are visible without model credentials or catalog access; execution dependencies are loaded only when starting a workflow

### Requirement: Every festival attempt has a durable lifecycle
After input and configuration validation, the system SHALL persist a running record in the selected catalog database before context/source/model work. Each attempt SHALL have a unique ID, UTC start time, safe normalized input (including defaulted full/current scope for refresh), and required nonempty text mode, fixed at start and equal to mode in input and final report JSON. Finalization SHALL update the same record with UTC finish time and private report. Lifecycle status SHALL be separate from research status and catalog outcome.

#### Scenario: Start is recorded before work
- **WHEN** a valid festival attempt begins
- **THEN** its running row is visible before any research context load, source request, or model call, with no finish time or final report
- **AND** invalid input or configuration and help requests do not create run rows

#### Scenario: Mode is available before a final report
- **WHEN** an add or refresh attempt starts
- **THEN** its mode column equals input_json.mode and remains queryable while running or after interruption
- **AND** finalization preserves that mode and report_json.mode agrees with it

#### Scenario: Storage accepts evolving mode names
- **WHEN** the application introduces another supported invocation mode
- **THEN** run storage accepts its nonempty text name without a table migration or closed-list enum/type/constraint
- **AND** command validation remains responsible for deciding which workflows can execute

#### Scenario: Multiple targets have independent attempts
- **WHEN** refresh researches several Events
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

#### Scenario: Invalid scope is rejected at both entry points
- **WHEN** CLI, Studio, or a direct invocation supplies an invalid scope, scope for add, or removed check mode
- **THEN** reject before allocating an ingestion row or performing source/model work

#### Scenario: Guard rejection still leaves durable diagnostics
- **WHEN** a valid refresh fails research or country validation, including an early conflicting baseline
- **THEN** its existing runId reaches failed finalization with scope, assignment, and available diagnostics/accounting
- **AND** catalog facts, publication, audits, and operation receipts remain unchanged

### Requirement: Run records identify their associated Event when known
Each run record SHALL have nullable event_id for an existing requested/matched Event or one committed by the attempt. Refresh SHALL set it at start; add SHALL start with null and resolve it at finalization. Rolled-back creation identifiers SHALL remain only in the report. Event association SHALL NOT require a foreign key or imply successful mutation.

#### Scenario: Targeted attempt starts with its Event association
- **WHEN** a validated refresh attempt starts
- **THEN** its running record has the requested event_id, including when research later fails

#### Scenario: Add resolves a persistent Event
- **WHEN** add matches an existing Event or commits a newly created Event
- **THEN** finalization stores that Event ID in event_id, including a skipped duplicate or later workflow error after commit

#### Scenario: Add does not retain a created Event
- **WHEN** a creation is previewed and rolled back or fails without committing an Event
- **THEN** event_id remains null, while proposed/preview identifiers remain in the report where available
- **AND** failed research before Event resolution also leaves event_id null

### Requirement: Stored run statistics retain accounting limits
Final run reports SHALL retain duration, model/prompt configuration, budgets, token usage, known provider-reported model cost, estimated search cost, and token-completeness metadata. Model cost SHALL sum known charges, remaining null only when none are known. Reports SHALL mark searchCostBasis as estimate and SHALL NOT add token subsets to totals, invent missing charges, or claim exact spending.

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
- **THEN** the final report preserves known input/output counts and model-cost subtotals without estimating missing accounting; usage.complete is false when token accounting is incomplete
- **AND** unavailable cached-input/reasoning details remain null; available search estimates are retained without being presented as provider-reported charges or complete spending

#### Scenario: A later call omits cost but reports token counts
- **WHEN** an earlier call reports a model cost and a later call reports complete token counts without a cost
- **THEN** modelCostUsd retains the earlier known cost and usage.complete describes token completeness independently of cost availability

#### Scenario: No model cost is known
- **WHEN** no completed call reports a model cost
- **THEN** modelCostUsd is null rather than zero

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
Run records SHALL expose input_tokens, output_tokens, model_cost_usd, search_cost_estimate_usd, duration_ms, and usage_complete as nullable scalar columns. They SHALL start null and be finalized atomically from the same final report. Incomplete token counts SHALL retain a false completeness flag; model_cost_usd SHALL retain known cost subtotals or null when none are known. Projected values SHALL be nonnegative, and completeness SHALL be boolean when set.

#### Scenario: Final statistics match the report
- **WHEN** an attempt is finalized, successfully or with a caught failure
- **THEN** the six columns equal usage.inputTokens, usage.outputTokens, usage.modelCostUsd, usage.searchCostUsd, durationMs, and usage.complete in report_json
- **AND** token totals include discovery, search cost remains an estimate, and known zero values remain zero

#### Scenario: Unfinished attempts have no final statistics
- **WHEN** a run is still running or its finalization fails
- **THEN** all six statistic columns remain null along with finish time and report_json, without claiming zero usage or cost

#### Scenario: A finalized report has incomplete accounting
- **WHEN** a final report contains known token counts, incomplete token accounting, and a known model-cost subtotal
- **THEN** the columns retain those counts and the subtotal, and set usage_complete to false without claiming complete spending

### Requirement: Eval acceptance distinguishes host failures from expected research failure
Eval output SHALL preserve runId and available report data when finalization fails and SHALL identify safe host workflow/persistence failures. Those failures SHALL invalidate eval acceptance even when research/catalog outcomes are successful or a source-failure case otherwise meets expectations. New version-3 consumers SHALL reject historical version-2 reports explicitly; existing rows/files SHALL remain unchanged.

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

#### Scenario: Historical reports remain opaque storage
- **WHEN** scoped refresh replaces the prerequisite's active Edition report v2 with v3
- **THEN** newly generated reports use v3 and old stored report JSON remains unchanged
- **AND** historical report reading/scoring remains unsupported; no compatibility adapters or conversion are introduced

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

Trace labels SHALL identify the Event, mode, context Editions and confirmed committed Editions with separate roles, stable keys and known years. Unknown years SHALL not be inferred from dates or keys. Technical completion SHALL remain distinct from terminal research and write outcomes.

#### Scenario: Historical edition is created
- **WHEN** add sees matched context year 2026 and confirms creation of historical year 2023
- **THEN** final labels distinguish `ctx:2026` from `created:2023` and retain the research outcome

#### Scenario: Selected announcement is created
- **WHEN** a refresh sees context year 2026 and confirms creation of the selected year 2027
- **THEN** final labels distinguish `ctx:2026` from `created:2027` and retain the research outcome

### Requirement: Source diagnostics retain only bounded safe projections

Source spans SHALL record explicitly selected read URLs, outcome/reason/method/completeness and source/tool truncation where known; discovery spans SHALL record selected query and candidate URLs/counts. Producers SHALL select and shorten useful fields without a generic projection framework. Technical completion SHALL not imply retrieval success. Full source text and response envelopes SHALL be excluded.

#### Scenario: Retrieval fails without throwing
- **WHEN** a source tool returns failed/request_failed under normal SDK completion
- **THEN** host fields show failed retrieval, selected URL and method without the source body

#### Scenario: URL contains query or fragment
- **WHEN** a source URL is selected for diagnostics
- **THEN** its components are preserved within any call-site shortening applied, without rewriting the request

### Requirement: One catalog-run trace covers the final result

Each eligible apply trace SHALL begin before context and initial retrieval, parent research/source work, and end after validation, write/rollback and report construction or failure. Root host fields SHALL be explicit ordinary objects with independent structuralValidation, targetValidation, semanticValidation=not_run, writeState, known committedOperationCount, and report researchStatus/outcome when available. No logging producer SHALL depend on a trace summary to calculate its own straightforward outcome fields.

#### Scenario: Report construction fails after a commit
- **WHEN** a confirmed write succeeds but report construction fails
- **THEN** the root retains committed disposition/count and technical failure without inventing unavailable report fields

### Requirement: Run traces distinguish write disposition from research outcome

Write state SHALL remain committed, rolled_back, unchanged, not_attempted or unknown independently of research status. The committed-operation count SHALL be null when transaction disposition is unknown; dry-run previews SHALL not be labelled committed.

#### Scenario: Writer rejects an atomic item
- **WHEN** the writer rolls back after failure
- **THEN** the root records rolled_back and zero confirmed changed operations without claiming successful mutation

### Requirement: Research logging is optional and independent

The owner SHALL be able to enable local application logging independently of tracing. Logging SHALL be disabled by default and use configurable debug/info/warn/error levels. It SHALL use Mastra PinoLogger with ordinary level methods and child context. Logging failures SHALL produce fixed content-free diagnostics and SHALL NOT change research decisions, budgets, retries, catalog writes, report fields, durable run lifecycle/accounting, eval acceptance, or exit status.

#### Scenario: Logging without tracing
- **WHEN** logging is enabled and tracing is disabled, including a dry run or injected candidate generator
- **THEN** selected events can persist without trace spans, and the durable ingestion record remains required

#### Scenario: Neither signal is enabled
- **WHEN** logging is disabled and tracing is ineligible or disabled
- **THEN** no observability store is opened

#### Scenario: Logging or cleanup fails
- **WHEN** logger initialization, delivery, flushing, or shutdown fails
- **THEN** ingestion retains its original result or error and attempts independent cleanup with a fixed diagnostic

### Requirement: Research events have readable full-run context

Each stored application log SHALL have a short message, severity, durable runId, and useful selected context. Producers MAY include a stable event code and sequence for filtering. Scoped child context SHALL survive persistence. Real trace and span identifiers SHALL be present when available and SHALL NOT be invented when tracing is disabled. The runId SHALL match the ingestion row and report.

#### Scenario: Child context persists
- **WHEN** a source logger is created from a run logger with `child({...})`
- **THEN** Studio's saved log details include the run and source context, severity, and any real trace/span correlation after reopen

#### Scenario: Mastra uses the shared Pino logger
- **WHEN** application logging is enabled
- **THEN** Mastra uses the shared native PinoLogger with runId context for SDK diagnostics on stderr at the configured level
- **AND** automatic SDK log export remains disabled and explicitly bridged application records are saved once
- **AND** disabling application logging leaves the Mastra logger disabled

#### Scenario: Event identity becomes known
- **WHEN** an input eventId is known, an existing event is matched, or a new event is committed
- **THEN** subsequent application logs, including existing child loggers, and Mastra diagnostics include eventId in their context
- **AND** earlier logs are unchanged and transient dry-run creation IDs are not bound as eventId

#### Scenario: SDK emits its own log
- **WHEN** automatic SDK logging occurs
- **THEN** the research exporter does not admit it merely because application logging is enabled

### Requirement: Research logs cover actionable execution events

Enabled logging SHALL describe selected source retrieval, discovery, model steps, completed commentary and returned reasoning, tool calls/results, retry and terminal errors, budget limits, candidate preparation, write outcomes, and run completion. Producers SHALL calculate straightforward status/count fields where emitted, independently of a shared trace summary. Successful completion SHALL follow durable finalization. Logging SHALL NOT replay work or change generation settings.

#### Scenario: Source was fetched
- **WHEN** a source returns Markdown
- **THEN** the source event records useful fields such as `sourceCharacters` and selected response status/URL
- **AND** no source Markdown or full response is passed to the logger

#### Scenario: A dry run previews writes
- **WHEN** catalog changes are previewed
- **THEN** the log distinguishes preview from committed writes and retains selected counts without claiming a commit

### Requirement: Research log payloads are selected by event

Log producers SHALL pass plain objects with explicit useful fields. They SHALL NOT pass full prompts, message history, source Markdown or excerpts, full provider responses, transport headers/bodies, SDK objects, catalog snapshots, or raw exception objects. Selected model commentary and returned reasoning MAY be logged after explicit shortening. No runtime field allowlist, recursive payload processor, per-event payload type or callback, event-message registry, or whole-record 8 KiB cap is required. Native Pino serializers, mixins, child bindings, and redact settings SHALL NOT be relied upon to protect or populate the separately exported observability arguments.

#### Scenario: Producer selects nested response fields
- **WHEN** an HTTP response is useful for diagnosis
- **THEN** the producer passes a new plain object with status and URL rather than the response envelope

#### Scenario: Debug logging is selected
- **WHEN** debug events are enabled
- **THEN** they follow the same call-site selection rule without unrestricted payload forwarding

### Requirement: Model commentary and returned reasoning remain distinct

Completed-step commentary and provider-returned textual reasoning SHALL be logged as separate, labelled channels when available. Their selected text SHALL be shortened explicitly through `shrinkText(text)`, whose default limit is 4,000 Unicode code points. Each selected text event SHALL include original length and a truncation flag; retained length MAY be included. No 8 KiB serialized-record fit is required. Logging SHALL NOT collect streaming fragments, infer withheld reasoning, or duplicate final structured results.

#### Scenario: Long completed text
- **WHEN** a completed step returns more than 4,000 Unicode code points in either selected channel
- **THEN** that channel logs at most its first 4,000 code points with visible shortening metadata

#### Scenario: Interrupted step
- **WHEN** a step ends before its completion callback
- **THEN** it may have no text event; earlier completed-step events remain eligible for persistence

### Requirement: Tool events preserve calls and useful selected results

Observed tool starts and outcomes SHALL retain call identity, tool name, step/attempt context, selected arguments, and selected result metadata. Source result logging SHALL use retrieval metadata and source character count without Markdown. Unobserved outcomes SHALL NOT be fabricated; source/discovery host events SHALL not duplicate the same tool operation.

#### Scenario: A source tool completes
- **WHEN** the agent reads a source through its tool
- **THEN** the paired events retain the tool-call ID, selected URL/status and source character count, with no source body

### Requirement: Local research logs remain inspectable after exit

Enabled logs SHALL persist in the local DuckDB observability store and be readable in Mastra Studio after exit. Stored severity, runId and available trace/span IDs SHALL support inspection and correlation. CLI stdout and private reports SHALL retain their contracts. Pending writes SHALL receive bounded best-effort flush and shutdown attempts.

#### Scenario: Inspect saved logs
- **WHEN** the owner opens Studio after a completed run
- **THEN** selected events and scoped context are visible without rerunning research or accessing model credentials

### Requirement: Observability storage has explicit local ownership

Application logs and eligible traces SHALL share a local DuckDB store separate from the catalog. Recording and Studio SHALL use it sequentially when the backend requires exclusive process access. Existing historical files SHALL remain untouched; no conversion or legacy inspection is required.

#### Scenario: Another process owns the store
- **WHEN** the recording run cannot open DuckDB
- **THEN** it emits a bounded diagnostic and continues ingestion without taking ownership from that process

### Requirement: Local Studio exposes an executable ingestion graph
Studio SHALL expose the shared ingestion phases and lifecycle steps, with single-target execution and live progress. Inspection SHALL require neither catalog access nor model credentials and SHALL NOT start an attempt.

#### Scenario: Inspect or execute
- **WHEN** the owner opens Studio
- **THEN** the graph and saved traces are inspectable without research or catalog creation
- **AND** missing execution prerequisites fail before a durable attempt or external work

### Requirement: Studio ingestion defaults to a single-target preview
Studio SHALL accept add by name and refresh by one Event ID with scope full or current, defaulting to full; add SHALL reject scope and check SHALL be unsupported. Dry-run SHALL default to true and republish to false. Actor SHALL be catalog-research; environment configuration SHALL supply paths, credentials and research settings.

#### Scenario: Preview or apply
- **WHEN** the owner starts valid input
- **THEN** preview rolls back catalog mutations/audits/receipts but persists its report
- **AND** explicit dry-run false applies eligible changes atomically from current state, without reusing a preview

#### Scenario: Reject invalid input
- **WHEN** input has invalid/conflicting targets, an unknown Event or unsupported overrides
- **THEN** reject it before external work or mutation; expose mode, name, Event ID, refresh scope, dry-run and republish in the form

### Requirement: Studio runs retain durable lifecycle and bounded results
CLI and Studio SHALL share initialization after Mastra creates its engine run. Failure before engine run creation SHALL allocate no ingestion history or attempt resources. Studio SHALL preserve existing durable run/report semantics and expose both run IDs, preview/apply mode, research/catalog/persistence statuses, known Event ID, counts, usage, safe error codes, and refresh scope/saved-Edition/returned-Edition counts. Complete version-3 reports SHALL remain durable in ingestion_runs and MAY appear in local Studio workflow data; public website reads SHALL NOT expose them.

#### Scenario: Failure or cancellation
- **WHEN** a started attempt fails or is cancelled
- **THEN** retain known accounting/committed outcomes and attempt failed finalization; release owned resources after active work settles
- **AND** observed cancellation prevents subsequent writes without undoing confirmed commits

#### Scenario: Final persistence fails
- **WHEN** the terminal run update fails
- **THEN** report failed execution with run_persistence_failed and ingestion ID; retain the running row and committed changes without replay

### Requirement: Registered ingestion executions isolate resources and expose research data
Each execution SHALL own its resources and results. Native Mastra workflow state SHALL accumulate serializable research context, static refresh scope/task/saved context/country baseline and existing research result, source reads, model research output, prepared operations, receipts and reports without a second attempt-owned checkpoint. Each workflow step SHALL return its phase result for local Studio inspection. Caller-provided initialState SHALL be rejected; workflow initialization SHALL create state. Workflow data SHALL exclude credentials, configuration containing secrets, prompts, raw provider transport payloads and live resources. Exception messages, stacks and causes SHALL remain sanitized. Existing apply-only tracing and independently configurable application logging SHALL be retained, adding both IDs and safe terminal codes; the workflow SDK logger and automatic log export SHALL remain disabled.

#### Scenario: Overlap or duplicate ID
- **WHEN** executions overlap or a duplicate active engine ID is submitted
- **THEN** keep attempts isolated and reject the duplicate before work
- **AND** rejected execution hooks cannot finalize or release the original attempt

#### Scenario: Inspect execution data
- **WHEN** graph, transport, stored workflow data or errors are inspected
- **THEN** research results are inspectable while credentials, live resources and raw exception details are absent; snapshots remain disabled

#### Scenario: Complete tracing
- **WHEN** a traced attempt terminates, including cancellation or persistence failure
- **THEN** finish owned tracing once with both IDs and its safe terminal code; preserve the original result/error and shared inspection store
- **AND** dry-run creates no research traces

#### Scenario: Studio and CLI share scope behavior
- **WHEN** either entry point refreshes the same target with the same scope and injected evidence
- **THEN** scope bounds, returned facts, host rejection, and catalog operations agree
- **AND** native state exposes serializable phase data without credentials, live resources, caller-supplied checkpoints, or a second attempt-owned copy

### Requirement: Studio attempts share observability ownership

Studio executions SHALL reuse its initialized DuckDB observability store in the same process. Attempt cleanup SHALL finish owned observations without closing the shared store. Existing independent logging and tracing controls SHALL remain available.

#### Scenario: Inspect after execution
- **WHEN** a Studio attempt completes, fails or is cancelled
- **THEN** subsequent attempts and inspection can use the same store; cleanup releases only attempt-owned observations

### Requirement: Studio execution starts fresh without replaying writes
Ingestion SHALL disable automatic retries/restart recovery and reject per-step starts, resume, restart and time travel before attempt allocation. Fresh full runs SHALL use new ingestion IDs and current state; forced termination SHALL retain unknown-completion semantics.

#### Scenario: Unsupported execution mode
- **WHEN** any start/stream request uses perStep true, or a caller requests resume/restart/time travel
- **THEN** reject it without an ingestion row, attempt resources or source/model work

#### Scenario: Rerun after interruption
- **WHEN** the owner starts a fresh full run
- **THEN** research current state under a new ingestion ID without modifying or resuming the unfinished attempt

### Requirement: Research uses Mastra agent limits without a page-count cap
CLI and Studio research SHALL use Mastra iteration and generation-time limits instead of a separate ordinary model-call limiter and generation timer. Ordinary model steps SHALL default to 15, with a configurable step allowance and the last step reserved for a final response. The application SHALL NOT impose an input-context character limit or expose such a limit in current configuration or reports. Page reads SHALL have no count cap. Search/depth/source-size/output safeguards, the attempt deadline outside generation and existing retry policy SHALL remain. Counts and known usage SHALL remain reportable. Version-3 consumers SHALL reject historical version-2 reports explicitly without rewriting or converting them. Research SHALL use one shared budget for the complete assignment and follow relevant ticket/information pages and alternate-language sources. Exhaustion SHALL leave unfinished checks visible; size limits SHALL NOT silently truncate targets.

#### Scenario: Large accumulated model context
- **WHEN** research accumulates more than 240,000 input characters while steps and time remain
- **THEN** the application permits the next model request without an input-character budget failure
- **AND** the final ordinary step disables tools for the final response; any provider context-window error remains a model failure

#### Scenario: Read beyond the old cap
- **WHEN** research reads additional pages within retained safeguards
- **THEN** page count alone does not stop retrieval or reject a candidate; prompts do not impose a replacement page target

#### Scenario: Agent exhausts its allowance
- **WHEN** Mastra exhausts research iterations or generation time without valid output
- **THEN** report limit_reached with known usage and still finalize the durable attempt
- **AND** initial reads, discovery and retry waits remain bounded by the attempt deadline

#### Scenario: Scope resolution shares the Event budget
- **WHEN** announcement/selection research and assigned field research run for one Event
- **THEN** they share one bounded research session and budget without per-Edition subruns or an intermediate selection tool

#### Scenario: An assignment exceeds supported size
- **WHEN** the complete assignment cannot fit supported schema or context limits
- **THEN** fail explicitly before research when detectable, otherwise before application, retaining the complete assignment and size diagnostic
- **AND** do not truncate saved targets or split them into chunked subruns

#### Scenario: A relevant ticket shop remains unread
- **WHEN** a source links a relevant shop and ticket verification remains unfinished with budget available
- **THEN** research attempts the relevant shop rather than treating a fixed number of page reads as completion

#### Scenario: A stale language version omits information
- **WHEN** a relevant alternate-language source is available and the assigned facts remain unresolved
- **THEN** research can follow it within the same budget without blindly repeating cached failed URLs

#### Scenario: Several Editions exceed the run budget
- **WHEN** full refresh exhausts its budget after completing only some saved Editions
- **THEN** its report retains the complete assignment and the model-authored questions identifying unfinished fields and Editions; omitted values receive no inferred completion state
- **AND** useful valid results may remain partial; a run without a usable valid final result remains failed

### Requirement: Refresh scope fixes the mandatory verification assignment
Refresh SHALL supply structured scope, one reference instant, saved Editions with stable keys/dates/time zones, a supported-field registry and model research rules. Full scope SHALL cover every saved Edition plus the selected current or nearest future Edition when missing. Current scope SHALL cover at most one ongoing or nearest future Edition selected by the model. Both SHALL research announcements automatically and verify Event summary and shared links. Source association SHALL remain model interpretation without a separate identity output or declaration gate. Filled values SHALL receive the same verification duty as empty values.

#### Scenario: A new announcement cannot substitute for saved history
- **WHEN** full refresh targets an Event with a saved 2026 Edition and discovers the nearest announced Edition in 2027
- **THEN** the assignment retains every requested 2026 field and adds the selected 2027 Edition
- **AND** the prompt requires research of saved 2026 even when 2027 is found; field-level completeness remains the model decision checked by offline evals rather than inferred from omitted values

#### Scenario: Current scope preserves history
- **WHEN** current refresh selects an existing 2027 Edition while 2026 is stored
- **THEN** only 2027 Edition facts and Event-level facts may change
- **AND** 2026 remains available as identity and country context without being a field-update target

#### Scenario: A farther future Edition already exists
- **WHEN** full refresh loads both the nearest and a farther future saved Edition
- **THEN** both saved Editions remain mandatory targets
- **AND** current refresh covers only the selected nearest one

#### Scenario: No Editions have been saved
- **WHEN** an existing Event has no Editions
- **THEN** either scope researches the current or nearest future announcement and may create the selected supported Edition
- **AND** an unknown Event ID fails before research; adding a new Event still requires add

#### Scenario: A proposed mutation is outside the assignment
- **WHEN** current proposes more than one Edition, or full proposes more than one new key or exceeds the 20-target union
- **THEN** the host rejects the proposal before any operations
- **AND** temporal correctness and completeness remain model decisions assessed through evals

### Requirement: Current selection prioritizes an ongoing Edition
The model SHALL select at most one current target: an ongoing Edition first, otherwise the nearest future Edition supported by inspected material. Start and end dates SHALL be inclusive local dates using the saved time zone or UTC fallback. Saved dates and statuses SHALL be rechecked as leads, not accepted as selection proof. Ambiguous selection SHALL be reported explicitly without arbitrary tie-breaking or silently researching several targets.

#### Scenario: A festival is already underway
- **WHEN** the reference day falls within an Edition's supported start and end dates and a later Edition is announced
- **THEN** the ongoing Edition is selected through its last day
- **AND** after it ends the nearest supported future Edition becomes the candidate

#### Scenario: Multiple future announcements
- **WHEN** inspected material supports several future Editions with distinct start dates and none ongoing
- **THEN** select only the nearest start date, reusing its saved key if it exists
- **AND** farther unsaved announcements may be noted without creating them

#### Scenario: Stored cancellation or postponement may be wrong
- **WHEN** a temporal candidate is stored as cancelled or postponed
- **THEN** research checks its status instead of excluding it using public-site visibility rules
- **AND** only source-confirmed cancellation or postponement without replacement dates excludes it from current selection; existing reasons/source summaries explain the exclusion
- **AND** supported replacement dates participate in selection under the same matched key without inventing a new Edition

#### Scenario: A cancelled candidate precedes an eligible announcement
- **WHEN** sources confirm the nearer candidate is cancelled or postponed without replacement dates and support a later eligible Edition
- **THEN** select that later Edition and retain the exclusion explanation
- **AND** current scope does not mutate the skipped candidate, even to correct a stale saved status; full scope still verifies and may update every saved candidate

#### Scenario: All candidates are excluded
- **WHEN** source checks confirm all current/future candidates are cancelled or postponed without replacement dates
- **THEN** report no eligible announcement with the exclusion explanations and do not create a replacement

#### Scenario: Dates do not establish an order
- **WHEN** two Editions overlap today, future starts tie, or an announcement without exact dates could precede another candidate
- **THEN** research attempts to resolve selection within its budget
- **AND** if ambiguity remains it reports unfinished selection and proposes no arbitrary current target
- **AND** independently verified full-scope saved targets may still produce a partial result

#### Scenario: A year-only announcement is the only candidate
- **WHEN** inspected material establishes one future Edition by year, with no competing ongoing or earlier candidate
- **THEN** it can be selected with unknown exact dates
- **AND** no programme dates are inferred from another year

#### Scenario: Saved temporal information is missing or incorrect
- **WHEN** saved dates or years do not reliably establish whether an Edition belongs to current scope
- **THEN** research attempts to reconcile it with inspected announcements and existing identity
- **AND** unresolved candidates that could change selection prevent a claim of completed selection
- **AND** current scope does not claim to have audited every historical date; full scope provides that coverage

#### Scenario: No current or future announcement is found
- **WHEN** relevant identity and announcement checks finish without a supported current or future Edition
- **THEN** report no announcement found on inspected sources without inventing an Edition
- **AND** that completed absence of a finding alone does not cause failure; inaccessible relevant sources remain unfinished checks

### Requirement: Edition matching preserves stable identities
Research SHALL match an announced Edition to existing keys before proposing creation. A year SHALL be context, not an identity: multiple Editions in one year SHALL remain distinguishable. Correcting dates or a year SHALL NOT replace a matching saved key. Unresolved matching SHALL remain an unfinished check rather than creating a possible duplicate.

#### Scenario: Imported keys are not calendar years
- **WHEN** a source verifies an Edition stored under `source-row` and corrects its dates
- **THEN** the update retains that key and Edition ID rather than creating a year-named duplicate

#### Scenario: Two weekends share one year
- **WHEN** a festival has two distinct Editions in one year
- **THEN** research uses their identities and programme context to match the selected Edition, not year equality alone

### Requirement: An unrelated website triggers discovery of the correct website
The refresh prompt SHALL instruct the model to search for and inspect the correct festival website when a saved or candidate site belongs to another Event. Recovery SHALL use the shared budget before returning failure. Unrelated facts SHALL NOT become target proposals. Research SHALL continue after verifying a replacement site's association; inability to find and verify a correct website SHALL return failed with null data, an explanation in existing errors/unresolved, and zero operations.

#### Scenario: A wrong website can be replaced
- **WHEN** the saved site belongs to a namesake and discovery finds an inspectable website supported as belonging to the targeted festival
- **THEN** the model verifies that association, returns an explained replacement Event website proposal, and continues its full/current assignment
- **AND** the replacement and other accepted changes apply atomically only if all guards pass
- **AND** the rejected site's facts remain diagnostic context rather than target proposals, including when the namesake is in another country

#### Scenario: Search results alone do not confirm a replacement
- **WHEN** a search finds a matching festival name but inspection does not establish the website's association with the target
- **THEN** the model continues recovery within its remaining budget instead of treating the name or snippet as verified identity
- **AND** if no correct website can be verified, research returns failed with null data and explains the failure in existing errors/unresolved; no links, facts, publication, audits, or receipts change

#### Scenario: Website recovery exhausts the budget
- **WHEN** the website is unrelated and search/time/depth/size/agent limits are exhausted before a correct website is verified
- **THEN** research returns failed with null data and existing error/question diagnostics, reports the recovery limitation, and produces no operations rather than partial updates

#### Scenario: A recovered website still conflicts with the saved country
- **WHEN** the correct website is verified but its matched Edition facts conflict with the saved country baseline
- **THEN** the existing whole-Event country guard still fails refresh, including the website replacement

#### Scenario: Website recovery uses the existing result contract
- **WHEN** the model finds and inspects the correct website and returns useful valid findings
- **THEN** refresh does not require a separate identity field or data.reason for the existing Event
- **AND** supplied facts retain their reasons, and partial results retain model-authored unresolved questions

### Requirement: Country conflicts veto the whole Event refresh
The host SHALL compare researched in-scope countries with the pre-run Event's known Edition countries before generating operations. A differing known country, explicit clearing of a known country, or conflicting saved country baselines SHALL fail the whole Event refresh with a validation diagnostic. No links, Editions, publication changes, audits, or receipts SHALL be committed. Another year or strong source evidence SHALL NOT create an exception.

#### Scenario: A wrong saved website identifies another country
- **WHEN** a saved country is IE and researched matched facts propose AU, alongside links and tickets
- **THEN** researchStatus and catalog outcome are failed, operations are empty, and a country_conflict error identifies the saved and observed countries and Edition keys
- **AND** raw model output and retrieval diagnostics remain available; no fact is salvaged for writing

#### Scenario: The original country is itself incorrect
- **WHEN** sources support GB while the saved matched Edition has IE
- **THEN** the entire refresh still fails without applying the correction
- **AND** resolving the baseline requires a separate explicitly authorized correction, not a refresh override

#### Scenario: A new year introduces another country
- **WHEN** a new selected Edition proposes a country different from a saved Edition of another year
- **THEN** the whole Event refresh fails, including changes to otherwise valid saved Editions

#### Scenario: Unknown country with a known sibling
- **WHEN** the selected Edition has no country but another saved Edition has one
- **THEN** the sibling's known country constrains the researched country in the same way

#### Scenario: No country baseline exists
- **WHEN** no saved Edition has a known country
- **THEN** source-supported country filling is permitted for a valid research result
- **AND** omission does not become country verification; no country is inferred solely from another proposed record

#### Scenario: Clearing or omitting a country cannot hide a conflict
- **WHEN** research explicitly clears a known country or returns a differing country fact, including facts that produce no final catalog diff
- **THEN** the host rejects the whole refresh
- **AND** the guard checks every returned country fact before operation/diff derivation; questions and omitted fields do not invent countries

#### Scenario: Country could not be verified
- **WHEN** useful in-scope findings exist but the country check is unfinished and no contradictory country finding exists
- **THEN** country remains unverified, the result is partial, and the saved country is preserved
- **AND** a missing country result cannot be labelled confirmed

#### Scenario: Stored countries already disagree
- **WHEN** saved Editions of the targeted Event contain more than one known country
- **THEN** refresh fails before source reads or model calls with an explicit conflicting-baseline diagnostic rather than choosing a year, majority, or country to trust
- **AND** the report retains the initial assignment with no model response

#### Scenario: Country baseline changes during research
- **WHEN** the relevant saved country baseline changes before an apply transaction
- **THEN** no operations commit using the stale country decision; the run fails and requires a new refresh

### Requirement: Refresh selection uses the existing final result
Refresh SHALL give the model selection rules in both its prompt and structured context. The host SHALL enforce schema, simple scope bounds and country guards without a separate resolver tool, injected callback, recorded selection or required intermediate protocol. Temporal choice and research completeness SHALL be assessed through evals; static context SHALL NOT certify either.

#### Scenario: Final result needs no intermediate selection call
- **WHEN** a refresh returns valid success/partial proposals within scope bounds and country guards
- **THEN** no missing-resolution check rejects them
- **AND** existing reason/unresolved semantics govern explanations and unfinished checks

#### Scenario: Final evidence changes a temporal finding
- **WHEN** later inspected evidence changes dates, status or matching before final output
- **THEN** the model incorporates it in the final result without re-resolution
- **AND** host validation does not compare it with an earlier model decision

#### Scenario: Context is a task rather than proof
- **WHEN** a private report or Studio exposes refresh context and saved/returned counts
- **THEN** it exposes no host-certified selected/none-found/unresolved outcome or separate confirmed/changed fact report
- **AND** separate eval assertions check ongoing-first/local-date choice, ambiguity, stable keys and unfinished historical research
