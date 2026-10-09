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
The model SHALL select the Event, editions, facts, and links from inspected material. The host SHALL accept its factual interpretation without verifying citations, source authority, ticket-link provenance, contradictions, or supersession. Schema validation, result-status consistency, required explanations, and requested Event/Occurrence target checks SHALL still apply.

#### Scenario: A source claim is semantically wrong
- **WHEN** the model returns a structurally valid but mistaken fact
- **THEN** the host does not perform a second semantic check and the model eval can flag the resulting change

#### Scenario: Inspected sources conflict
- **WHEN** the model proposes a structurally valid fact despite a conflict between inspected sources
- **THEN** the host applies the proposal without dropping the field for lack of confirmation

#### Scenario: Model omits a price block
- **WHEN** the model omits the tickets block after a failed source read
- **THEN** the stored price block is preserved

### Requirement: Runs report attributable outcomes
The system SHALL report each run's mode (`add`, `refresh`, or `check`) and resulting record outcome (`created`, `updated`, `published`, `unchanged`, `skipped`, or `failed`), with stable catalog identifiers where a record exists. Reports SHALL include the run's proposed or applied old/new values, factual explanations, and inspected source URLs. They SHALL separately identify research status, execution errors with stages, and unresolved questions; a catalog mutation outcome SHALL NOT stand in for research completion. Source-check results SHALL identify the inspected URL, UTC check time, and outcome, distinguishing unsupported retrieval from successful checks and failures. CLI/eval reports SHALL use version 2. Failed research/writing SHALL exit nonzero; partial alone SHALL exit zero. Reports SHALL NOT require persistent source identifiers or catalog run records.

#### Scenario: Preserve the final model response
- **WHEN** a model generation returns a final response
- **THEN** private research and eval reports retain its final text and unnormalized structured object in `modelResponse`, separately from catalog operations
- **AND** the response remains available when candidate validation or writing fails
- **AND** unavailable responses or components are recorded as null, without copying prompts, page bodies, or transport metadata

#### Scenario: Reasoning configuration and token accounting

- **WHEN** the owner configures a supported reasoning effort
- **THEN** research and discovery requests send that effort and reports identify the requested setting
- **AND** omitting the setting explicitly selects `medium`
- **AND** reports include provider-reported cached input and reasoning token counts as subsets of total input and output, using null when details are unavailable or a generation is interrupted

#### Scenario: Unchanged recheck
- **WHEN** a recheck confirms the current accepted facts without changes
- **THEN** the run reports unchanged and creates no duplicate catalog change

#### Scenario: Source cannot be fetched
- **WHEN** a known source fails to load and the model proposes no changes
- **THEN** the report identifies the attempted URL, check time, and failure without changing catalog facts or audit history

#### Scenario: Explanations survive dry-run reporting
- **WHEN** an explained factual proposal produces a dry-run diff
- **THEN** the report retains its reason alongside the actual previewed old/new values and retains source summaries separately
- **AND** the dry run retains no database changes or audit entries

#### Scenario: Research succeeds but writing fails
- **WHEN** the writer rejects valid research operations
- **THEN** preserve research status, report write-stage error/outcome failed, and commit nothing

#### Scenario: Partial no-op remains visible
- **WHEN** partial research changes nothing
- **THEN** text/JSON show partial plus unchanged, separating questions from errors

#### Scenario: Only the new report contract is supported
- **WHEN** a consumer receives an unsupported report version
- **THEN** it rejects that version explicitly, without legacy gaps fallback or automatic conversion
- **AND** new reports use version 2 and do not emit gaps

### Requirement: Dry runs preview changes without applying them
The system SHALL let the owner inspect a transient diff of proposed catalog changes before an apply run. Dry-run SHALL use a transaction on the catalog database and roll it back without retained record, version, audit, or receipt changes; it SHALL NOT create a database copy.

#### Scenario: Dry run of a venue correction
- **WHEN** the owner requests a dry run for a model-proposed venue change
- **THEN** the output shows the proposed old and new values while the catalog version and audit history remain unchanged

### Requirement: Eligible apply runs publish without review queues
The system SHALL apply and publish model-proposed, structurally eligible records directly through catalog operations, with atomic audit history and no per-item or batch approval task.

#### Scenario: Complete new festival
- **WHEN** an owner-initiated run proposes a new in-scope Event and Occurrence with all structurally required publication facts
- **THEN** the apply operation publishes them, records the changes atomically, and reports stable identifiers

### Requirement: Interrupted collection can be rerun from current state
After interruption, a new owner-initiated run SHALL reload the catalog and research again with new operation keys. Committed changes SHALL remain; incomplete item transactions SHALL roll back. Existing writer receipt idempotency SHALL remain supported. Automatic run recovery and a history-viewing command are outside this change.

#### Scenario: Owner reruns after interruption
- **WHEN** a run stops after one festival is committed and the owner starts it again
- **THEN** the new run uses current catalog state without duplicating that festival or resuming a saved operation file

### Requirement: One research result governs each atomic catalog update
Research SHALL produce one final structured result. Only valid success or partial data for the requested Event/Occurrence targets SHALL produce catalog operations; omitted values SHALL be preserved. Failed or invalid results SHALL produce no operations or automatic model correction attempts. Catalog updates SHALL enforce structural, version, no-op, and publication rules atomically: an invalid operation SHALL leave the whole item unchanged.

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
Research SHALL return `status`, `data`, `errors`, and `unresolved`. Success/partial SHALL contain data; failure SHALL contain null data and produce no operations. Status SHALL describe research completeness independently of catalog changes or announcement completeness. Core checks SHALL cover identity, the relevant latest completed or next announced edition/dates, location, and published ticket information; duplicate add needs only identity. Partial SHALL require a useful result and a specific unfinished core check with its cause in unresolved.

#### Scenario: Successful check changes nothing
- **WHEN** inspected material completes the requested check
- **THEN** status is `success`, even with no changes; empty changes alone do not prove completion

#### Scenario: The next edition is only partly announced
- **WHEN** reasonable relevant checks find an announced edition and dates but no published venue or prices
- **THEN** success may contain the known facts and omit missing fields, preserving saved values and describing announcement limits in source summaries
- **AND** use “not found on inspected pages” unless evidence supports “not yet announced”

#### Scenario: A core check remains unfinished
- **WHEN** a relevant source failure is not recovered, a material conflict remains, or the budget ends before a core check finishes, but valid final data exists
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
- **WHEN** execution fails or exhausts its limit without valid final output
- **THEN** the host reports failure with an error and null data; intermediate/malformed facts are not written

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
Only labelled tickets.value.variants SHALL propose availability: unknown/available/sold_out/closed. Edition-level ticketAvailability SHALL be rejected; no edition-wide value SHALL be inferred from variants or exposed publicly. Complete ticket replacement SHALL remain required.

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
Host-generated model_failed errors SHALL preserve bounded safe structured diagnostics in CLI text, JSON, and eval reports: recognized error/cause types, HTTP status, provider/network code, and retryability when available. Unknown fields SHALL remain absent or explicitly unknown. Diagnostics SHALL exclude raw exception messages, provider payloads, request/response headers, prompts, and credentials. Research limits SHALL retain precedence over model_failed. Model failures SHALL NOT trigger automatic retries; configured budgets SHALL remain unchanged.

#### Scenario: Provider or network failure
- **WHEN** a model request fails and safe technical diagnostics are available
- **THEN** the report preserves that metadata with failed research and no operations, without exposing raw content

#### Scenario: Provider failure produces no final result
- **WHEN** a provider failure ends research without a final result
- **THEN** report model_failed with available safe diagnostics, not invalid_candidate, without retrying the request

#### Scenario: A provider failure follows completed work
- **WHEN** a model request fails after earlier calls have reported usage
- **THEN** the model_failed report retains known input/output tokens and cost without estimating unreported usage

#### Scenario: Unknown or budget failure
- **WHEN** safe failure details are unavailable or the research budget is exhausted
- **THEN** diagnostics remain bounded, missing details are not invented, and budget exhaustion remains limit_reached
