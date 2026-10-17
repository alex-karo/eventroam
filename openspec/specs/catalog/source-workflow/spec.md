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
The system SHALL start discovery, source checks, and refreshes only through an owner-initiated local operation. The owner SHALL be able to execute runs through the local CLI or loopback Studio without a deployed collection server. Legacy import, hosted collection services, and unattended scheduling SHALL remain outside scope.

#### Scenario: No unattended refresh
- **WHEN** no owner starts a run
- **THEN** the catalog does not autonomously discover or refresh records

#### Scenario: Owner starts a local run
- **WHEN** the owner initiates a collection run locally
- **THEN** the run can complete through CLI or loopback Studio without a deployed collection server

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
The model SHALL use linked URLs, available official IDs, canonical URLs, name, geography, and Edition facts to select an Event. It SHALL keep parallel festivals under one brand as separate Events while preserving one Event when a festival relocates between years. Saved URLs SHALL be research leads, not proof of identity. The host SHALL enforce requested targets and the country guard without independently adjudicating source authority or ambiguous identities.

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
Research SHALL interpret inspected material as findings within the requested assignment. A separate editor SHALL compare those findings with saved state and produce the only actionable plan. The host SHALL enforce schema, assignment target boundaries, simple scope bounds, country conflicts, explanations, and target checks. Outside these explicit checks, host code SHALL accept the editor's factual decisions without independently verifying citations, source authority, ticket-link provenance, other contradictions, or supersession. Research findings alone SHALL NOT authorize writes.

#### Scenario: A source claim is semantically wrong
- **WHEN** a finding supplies a date whose evidence concerns another Edition
- **THEN** the editor keeps the saved date and explains the mismatch; evals assess correctness rather than treating schema validity as proof

#### Scenario: Inspected sources conflict
- **WHEN** the model proposes an in-scope, structurally valid fact despite a conflict between inspected sources, without violating the country guard
- **THEN** the editor selects a replacement only when supplied evidence supports it, otherwise preserves the field with an unresolved question; independent supported changes may proceed

#### Scenario: Model omits a price block
- **WHEN** the model omits the tickets block after a failed source read
- **THEN** the stored price block is preserved

### Requirement: Runs report attributable outcomes
The system SHALL report each run's mode (`add` or `refresh`) and resulting record outcome (`created`, `updated`, `published`, `unchanged`, `skipped`, or `failed`), with stable catalog identifiers where a record exists. Reports SHALL include the run's proposed or applied old/new values, factual explanations, and inspected source URLs. Refresh reports SHALL also include top-level scope/currentDate and saved/returned Edition counts, and retain returned facts, including unchanged findings, in the raw model response, plus existing unresolved questions and source summaries, even when nothing changes. Omitted facts SHALL NOT receive inferred not_found/unfinished outcomes or confirmations. Reports SHALL NOT include a separate verification array or returned-fact counters; actual changes SHALL match the catalog audit. They SHALL separately identify research status, execution errors with stages, and unresolved questions; a catalog mutation outcome SHALL NOT stand in for research completion. Source-check results SHALL identify the inspected URL, UTC check time, and outcome, distinguishing unsupported retrieval from successful checks and failures. CLI/eval reports SHALL use version 5. Failed research/editing/writing SHALL exit nonzero; partial alone SHALL exit zero. Reports SHALL NOT require persistent source identifiers. Every started attempt SHALL retain its durable runId and final report in private run history, including failures, previews, and no-ops; exported reports SHALL match stored reports.

#### Scenario: Preserve the final model response
- **WHEN** a model generation returns a final response
- **THEN** private research and eval reports retain research final text and unnormalized structured object in `modelResponse`, and editor equivalents in `editorResponse`, separately from catalog operations
- **AND** both available responses remain available when editing, plan validation or writing fails
- **AND** unavailable responses or components are recorded as null, without copying prompts, full page bodies, or transport metadata; concise returned evidence remains available

#### Scenario: Reasoning configuration and token accounting

- **WHEN** the owner configures a supported reasoning effort
- **THEN** research, editor and discovery requests send that effort and reports identify the requested setting
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
- **WHEN** the writer rejects operations from a valid editorial plan
- **THEN** preserve research status, report write-stage error/outcome failed, and commit no catalog changes; retain the failed ingestion run

#### Scenario: Partial no-op remains visible
- **WHEN** partial research changes nothing
- **THEN** text/JSON show partial plus unchanged, separating questions from errors

#### Scenario: Only the new report contract is supported
- **WHEN** a consumer receives an unsupported report version
- **THEN** it rejects that version explicitly, without legacy gaps fallback or automatic conversion
- **AND** new reports use version 5 and do not emit gaps

#### Scenario: Historical reports survive a report-contract update
- **WHEN** the active report contract changes
- **THEN** stored historical report JSON remains unchanged, including version-2/version-3 reports
- **AND** new final reports conform to the active version and their run; unsupported historical versions are rejected explicitly by consumers

#### Scenario: Saved output correlates with the database
- **WHEN** an attempt finishes and the owner requests JSON output or a --report file
- **THEN** its runId and report content match the stored final report
- **AND** optional file-export failure does not change the finalized run record

#### Scenario: Editor outcome is separate from research completion
- **WHEN** usable research succeeds but editing fails or returns an invalid plan
- **THEN** retain research status/findings, editorStatus=failed, a staged error, catalog outcome failed and known usage, with no writes and a nonzero exit

#### Scenario: Explicit decisions survive a no-op
- **WHEN** the editor returns a valid plan with explicit keep actions
- **THEN** retain the plan and reasons once in the structured editor response, without a separate serialized validated plan, synthetic audit changes or a field-verification ledger
- **AND** editorStatus is success; skipped editing is not_run and missing output is null

#### Scenario: Invalid editor output has one retained representation
- **WHEN** an editor returns a structured object that fails plan validation
- **THEN** preserve that object once in editorResponse with validation errors and failed editor status, without creating a second plan copy or applying operations

#### Scenario: Costs include both agents once
- **WHEN** research, editor and discovery have reported usage
- **THEN** totals include each reported charge/token count once and preserve unknown/partial accounting semantics, including after editor failure

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
The system SHALL apply and publish editor-planned, structurally eligible records through catalog operations, with atomic audit history and no per-item or batch approval task.

#### Scenario: Complete new festival
- **WHEN** an owner-initiated run produces a valid editorial plan creating an in-scope Event and Edition with all structurally required publication facts
- **THEN** the apply operation publishes them, records the changes atomically, and reports stable identifiers

#### Scenario: Kept draft content can still publish
- **WHEN** a valid plan updates Event summary and keeps or omits all content fields of an addressed eligible draft Edition
- **THEN** code publishes that Edition and its Event if eligible, while preserving the Edition content
- **AND** keep on an Event field does not veto child publication; unaddressed Editions are not automatically added as publication targets

#### Scenario: Kept withdrawn content requires republish permission
- **WHEN** a valid plan addresses a withdrawn Edition without changing its content
- **THEN** it remains withdrawn unless republish permission is supplied and publication gates pass
- **AND** dry-run previews the same publication decisions without retained writes

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

Research SHALL produce one final findings result. Only validated usable success/partial findings that pass country guards SHALL enter editing. Only a valid editorial plan for the requested assignment SHALL produce catalog operations; omitted values SHALL be preserved. Failed or invalid research or editing SHALL produce no operations or automatic model correction attempts. Catalog updates SHALL enforce structural, version, no-op, and publication rules atomically: an invalid operation SHALL leave the whole item unchanged.

#### Scenario: A validated proposal violates catalog constraints

- **WHEN** an editorial plan passes plan validation but violates catalog constraints, such as clearing dates while retaining scheduled status
- **THEN** the whole item remains unchanged and the run reports write_failed while preserving research status

#### Scenario: Research needs a more specific page

- **WHEN** an inspected page leaves a material question unresolved
- **THEN** the agent may read a relevant known or linked page within its budget before returning its one research result; searchWeb is allowed only under its exceptional conditions, after relevant known links and prior results

#### Scenario: Research receives saved link context

- **WHEN** a refresh starts with saved links
- **THEN** all saved links are available to research with their owner and Edition context where known

#### Scenario: Addition starts without a source URL

- **WHEN** the owner starts `add` with a festival name and no official source is known
- **THEN** the agent uses searchWeb to find a candidate source and readPage to inspect it before returning its findings

#### Scenario: Intermediate commentary is not a catalog proposal

- **WHEN** research returns commentary while still requesting source information
- **THEN** commentary produces no catalog operations; research may continue within its budget
- **AND** only the final editorial plan that passes schema and target validation can produce operations

#### Scenario: Addition already has an official source

- **WHEN** an add assignment has a relevant known official source
- **THEN** the agent inspects it with readPage before considering searchWeb
- **AND** adding by name alone does not require a search when an official source is already known

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
Research SHALL return `status`, `data`, `errors`, and `unresolved`. Success/partial SHALL contain data; failure SHALL contain null data and produce no operations. Status SHALL describe research completeness independently of catalog changes or announcement completeness. Refresh completeness SHALL cover announcement/selection research and the mandatory checks for its scope. Current SHALL NOT require Event field checks, historical verification or separate opportunistic-field research; full SHALL retain every assigned Event/Edition field check. Add SHALL retain its historical and announced Edition research; duplicate add needs only identity. Partial SHALL require a useful result and a specific unfinished required check with its cause in unresolved.

#### Scenario: Successful check changes nothing
- **WHEN** inspected material completes the assignment
- **THEN** return success even without changes; no writes alone do not prove completion.

#### Scenario: The next edition is only partly announced
- **WHEN** relevant checks find announced dates but no venue/prices
- **THEN** success may omit missing fields, preserving saved values; say “not found on inspected pages” unless evidence supports “not yet announced”.

#### Scenario: A core check remains unfinished
- **WHEN** a mandatory check remains blocked, conflicted or unattempted with useful findings
- **THEN** return partial with the unfinished question/cause and preserve omitted values; completed unknowns and current opportunistic fields do not force partial.

#### Scenario: Optional unknowns do not force partial
- **WHEN** assigned checks complete without optional facts or a future announcement
- **THEN** success may retain questions; never invent facts/completed status or change values to fill gaps.

#### Scenario: Failed research needs no invented candidate
- **WHEN** no usable result remains
- **THEN** return failed/null with an error/question; accept and retain that failure in the report.

#### Scenario: Repeated input is not a research finding
- **WHEN** only supplied identity/facts/URLs remain after unusable refresh reads
- **THEN** return failed/null with source diagnostics; source-verified unchanged facts qualify, and duplicate add still needs only identity.

#### Scenario: Inconsistent result is rejected
- **WHEN** failed has data, success/partial lacks data, partial lacks a question or failure lacks diagnostics
- **THEN** reject before operations.

#### Scenario: Current finds no eligible Edition
- **WHEN** useful inspected announcement sources establish no eligible Edition
- **THEN** current may succeed with editions empty and useful summaries, omitting Event findings; no usable inspected sources still requires failed/null.

#### Scenario: Current selection remains ambiguous
- **WHEN** useful sources leave overlapping/tied candidates or uncertain matching
- **THEN** return partial with no Edition and a selection question, never several arbitrary targets or Event findings.

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



### Requirement: Dates and coordinates are complete grouped facts
Dates SHALL group startsOn/endsOn/state; coordinates SHALL group latitude/longitude/precision, each with one reason. Editor accept/set actions SHALL replace all components; keep or omission SHALL preserve them; clear SHALL clear the pair and set state/precision to unknown.

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
- **WHEN** dates or coordinates has a clear action with a reason and supporting research evidence
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
Only labelled ticket variants in findings and complete editorial replacements SHALL carry availability: unknown/available/sold_out/closed. Edition-level availability proposals SHALL be rejected; no Edition-wide value SHALL be inferred from variants or exposed publicly. Complete ticket replacement SHALL remain required. Assigned ticket checks SHALL cover published amounts, eligibility, coverage, and availability; qualified offers SHALL retain their qualifications and base-price eligibility. Incomplete extraction SHALL NOT discard unverified saved categories.

#### Scenario: Categories have different availability
- **WHEN** Early Bird is sold out but Regular remains available
- **THEN** store those statuses per variant without changing schedule or producing aggregate availability

#### Scenario: Availability is known without an amount
- **WHEN** a category and availability are known without price
- **THEN** its label/availability may omit both amount and currency

#### Scenario: Availability-only correction preserves the complete intended price block
- **WHEN** one variant's availability changes
- **THEN** the editor supplies complete intended variants/basePrice with a reason and evidence, or keeps the block and reports uncertainty; never implicitly delete other variants through a partial replacement

#### Scenario: Closed category does not imply cancellation
- **WHEN** category sales ended without sell-out evidence
- **THEN** use closed without inferring cancellation or global sell-out

#### Scenario: Packages and concessions are published
- **WHEN** inspected pages publish package, day, upgrade, or concession offers
- **THEN** research captures supported offers with qualifications and preserves base-price eligibility rules
- **AND** price omission despite readable relevant content leaves the ticket check unfinished rather than complete

#### Scenario: Only part of a saved ticket block can be verified
- **WHEN** supplied ticket findings are incomplete
- **THEN** the editor preserves unchallenged saved categories when it can construct a supported complete replacement; otherwise it keeps the saved block and reports the incomplete check

### Requirement: Proposed facts explain their basis
Research findings and explicit editorial actions SHALL carry reasons. Set/clear actions and creation SHALL explain their basis in supplied research and saved state without repeating source URLs; source references SHALL remain in research. Event identity SHALL require one only for creation. Reasons and evidence SHALL remain private without claiming independent host verification; old values SHALL come from the catalog.

#### Scenario: Checking a known Event needs no identity explanation
- **WHEN** research resolves an existing Event, including a skipped duplicate add
- **THEN** data.reason may be omitted or wire-null even if eventName differs; supplied facts still need reasons

#### Scenario: Creation requires an identity explanation
- **WHEN** research proposes creating a new Event
- **THEN** require an editorial creation reason and evidence before operations; reasons never bypass target checks or authorize reassignment

#### Scenario: Venue changes
- **WHEN** a venue move is proposed
- **THEN** report its explanation with actual old/new values, with its reason; supporting source references remain in the research result

#### Scenario: Clearing needs a factual basis
- **WHEN** a nullable field or clearable block has a clear action
- **THEN** require a reason and source-backed grounds for removing the saved value; failed reads/missing partial-page content do not authorize clearing

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
Non-null research data SHALL include sources unique by normalized HTTP(S) URL, with existing information text carrying relevant source statements or short excerpts, Edition context and material limitations/conflicts; no separate evidence collection is required. Evidence for findings, Event identity and public-link association SHALL remain in `sources[].information`; named fact wrappers SHALL retain only value/reason without per-field source references. Editorial actions SHALL carry reasons without duplicating source references. Summaries SHALL remain private and distinct from public links and retrieval history.

#### Scenario: One page supplies several facts
- **WHEN** a page covers multiple topics/editions
- **THEN** include one combined contextual summary that multiple research findings can reference

#### Scenario: An unread destination is not an informative source
- **WHEN** a destination is unread or failed without useful content
- **THEN** omit its summary while retaining attempted reads and relevant errors

#### Scenario: Partial page content provides useful information
- **WHEN** only dates are readable
- **THEN** summarize dates and limitations without claiming prices were read; retrieval remains partial

#### Scenario: Shared summaries survive no-op or write failure
- **WHEN** valid research produces no changes, editing fails or writing fails
- **THEN** retain summaries independently of changes and separately from retrieval outcomes

### Requirement: Research returns bounded official links with structural ownership
Research SHALL return at most one Event website, one account per supported social key, and one ticket URL per edition. Research SHALL provide evidence of officiality/association and the editor SHALL decide set/clear/keep for the same owner/kind slots; their position in the result SHALL determine ownership. Current refresh SHALL omit Event website/social findings while retaining selected-Edition ticket-link findings and source/identity diagnostics; add and full SHALL retain Event-link research.

#### Scenario: Festival website and social accounts
- **WHEN** add/full finds official website/accounts
- **THEN** use Event website/social slots; supported keys are instagram/facebook/youtube/tiktok/x/other, with other restricted to another social platform.

#### Scenario: X and Twitter share one social slot
- **WHEN** add/full identifies x.com/twitter.com
- **THEN** use socials.x/catalog x, labelled X (Twitter); reject twitter keys and preserve saved URL spelling/classification.

#### Scenario: Edition-specific tickets
- **WHEN** an organizer identifies an Edition ticket page
- **THEN** attach it only to that Edition.

#### Scenario: Confirmed ticket link has unavailable prices

- **WHEN** an inspected official source establishes a booking URL for the selected Edition but checkout, prices or availability cannot be inspected
- **THEN** return the confirmed URL as an Edition ticket-link finding independently of the ticket-price block; retain unfinished ticket checks in unresolved and partial status when required

#### Scenario: Ticket ownership is uncertain
- **WHEN** ticket ownership is unverified
- **THEN** omit with a question; never assign to Event or an uncertain Edition.

#### Scenario: Social destination cannot be fetched
- **WHEN** add/full finds an official account whose retrieval is unsupported
- **THEN** retain the supported link despite unsupported retrieval.

#### Scenario: Evidence pages are not public link categories
- **WHEN** programme/FAQ/travel/news pages supply evidence
- **THEN** retain them as sources, never miscellaneous public links.

#### Scenario: Preserve omitted link slots
- **WHEN** a slot is omitted, outer-null or kept
- **THEN** preserve saved links; inaccessible pages never authorize deletion.

#### Scenario: Replace a supplied link slot
- **WHEN** editor sets an owner/kind URL
- **THEN** replace all links in that slot, preserving other slots and inheritance; invalid replacement fails atomically without deletion.

#### Scenario: Reject malformed link proposals
- **WHEN** URLs are non-HTTP(S), socials is an array, keys/targets are invalid, set is non-string or clear/keep carries values
- **THEN** reject before writing.

#### Scenario: Malformed URLs preserve the failure report
- **WHEN** source summaries or X/Twitter contain malformed URLs
- **THEN** report invalid_candidate, retain raw output/read history and produce no operations.

#### Scenario: Equivalent and shared URLs
- **WHEN** a slot contains exactly one link with the proposed normalized URL
- **THEN** make no change; explicit replacement collapses multiple old links, and an explicitly shared ticket URL remains on both Editions.

#### Scenario: Clear a disproven link
- **WHEN** affirmative evidence disproves ownership and editor clears the slot
- **THEN** remove only that owner/kind. Inaccessibility never authorizes clearing; reject empty-string deletion sentinels.

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
Stored traces SHALL exclude prompts, message history, source bodies, full responses, transport payloads and raw errors, including automatically generated content. Safe identity, timing, technical status and relationships SHALL remain inspectable. Exclusion failures SHALL NOT permit sensitive content to persist.

#### Scenario: Automatic model span captures messages
- **WHEN** the SDK attempts to attach prompts or model history to a span
- **THEN** stored spans exclude that content across creation and update/export events

#### Scenario: Host source metadata is selected
- **WHEN** the host records a source retrieval result
- **THEN** its explicit status, URL, method and completeness remain after reopen without the source body

### Requirement: Research tracing does not forward SDK logs
Enabling tracing or application logging SHALL NOT persist unrestricted SDK-generated logs. Stored observability records SHALL exclude prompts, message history, source bodies, full responses and raw errors while retaining safe application events and trace metadata.

#### Scenario: SDK generated content
- **WHEN** the SDK creates an automatic log or span containing a prompt, message history, source body, or full response
- **THEN** the stored observability record excludes that content without removing safe host-owned trace fields

### Requirement: Local traces use best-effort persistence and can be inspected

Tracing SHALL use the local observability store separate from the catalog and remain inspectable after exit. Completion, handled errors and cooperative aborts SHALL end owned spans and attempt bounded flush and shutdown. Logging and tracing SHALL be independently configurable. Overlapping background writes or forced termination may leave incomplete traces without changing catalog transaction guarantees.

#### Scenario: Fresh process inspection
- **WHEN** a completed run releases the store and Studio later opens it
- **THEN** safe root/source labels, result fields and the registered ingestion graph are visible without model credentials or catalog access; inspection alone starts no execution

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
- **THEN** run history retains the supported mode name and allows it to be queried before a final report exists
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
Each run record SHALL have nullable event_id for an existing requested/matched Event or one committed by the attempt. Refresh SHALL set it at start; add SHALL start with null and resolve it at finalization. Rolled-back creation identifiers SHALL remain only in the report. Event association SHALL NOT imply successful mutation.

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
- **WHEN** source retrieval does not supply billing metadata
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
Eval output SHALL preserve runId and available report data when finalization fails and SHALL identify safe host workflow/persistence failures. Those failures SHALL invalidate eval acceptance even when research/catalog outcomes are successful or a source-failure case otherwise meets expectations. New version-5 consumers SHALL reject historical version-2, version-3 and version-4 reports explicitly; existing rows/files SHALL remain unchanged.

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
- **WHEN** editorial ingestion replaces active report v4 with v5
- **THEN** newly generated reports use v5 and old stored report JSON remains unchanged
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
Source diagnostics SHALL retain bounded read URLs, outcome/reason/method/completeness and known truncation; discovery diagnostics SHALL retain bounded query and candidate URLs/counts. Technical completion SHALL NOT imply retrieval success. Full source text and response envelopes SHALL be excluded.

#### Scenario: Retrieval fails without throwing
- **WHEN** a source tool returns failed/request_failed under normal SDK completion
- **THEN** host fields show failed retrieval, selected URL and method without the source body

#### Scenario: URL contains query or fragment
- **WHEN** a source URL is selected for diagnostics
- **THEN** its components are preserved within any call-site shortening applied, without rewriting the request

### Requirement: One catalog-run trace covers the final result
Each eligible apply trace SHALL cover research, editing and the final write/report outcome. It SHALL expose research structural/target validation, editor plan validation/status, writeState, known committedOperationCount and available report status/outcome. Editorial rejection SHALL preserve research checks and report failed plan validation with not_attempted writes. Unavailable results SHALL NOT be invented.

#### Scenario: Editorial rejection remains visible in diagnostics
- **WHEN** usable partial research is followed by an explicit editor rejection
- **THEN** preparation logs a warning for the rejected plan and the final trace label identifies editor rejection rather than partial completion
- **AND** retain research validation, editorStatus=success, failed editorPlanValidation, not_attempted writes and zero committed operations

#### Scenario: Report construction fails after a commit
- **WHEN** a confirmed write succeeds but report construction fails
- **THEN** the root retains committed disposition/count and technical failure without inventing unavailable report fields

### Requirement: Run traces distinguish write disposition from research outcome

Write state SHALL remain committed, rolled_back, unchanged, not_attempted or unknown independently of research status. The committed-operation count SHALL be null when transaction disposition is unknown; dry-run previews SHALL not be labelled committed. Logs and traces observing the same write phase SHALL agree on disposition and confirmed changed-operation count.

#### Scenario: Writer rejects an atomic item
- **WHEN** the writer rolls back after failure
- **THEN** the root records rolled_back and zero confirmed changed operations without claiming successful mutation

#### Scenario: No writer invocation occurs
- **WHEN** an attempt finishes without calling the catalog writer
- **THEN** its final write observations report not_attempted and zero committed operations, independently of unchanged, skipped or failed catalog outcome

#### Scenario: Writer returns without a committed change
- **WHEN** a writer invocation returns a no-op or a rolled-back dry-run preview
- **THEN** applicable logs and traces report unchanged and zero committed operations; preview remains identified as dry-run

#### Scenario: Write completion is unknown
- **WHEN** write execution started but no confirmed result or rollback is available
- **THEN** applicable observations retain unknown with a null committed-operation count

#### Scenario: Reporting fails after a confirmed commit
- **WHEN** catalog changes commit and later reporting fails
- **THEN** logs and traces retain committed and the confirmed changed-operation count alongside the reporting failure

### Requirement: Research logging is optional and independent
Local application logging SHALL be independently configurable from tracing, disabled by default, and support debug/info/warn/error levels. Logging failures SHALL produce fixed content-free diagnostics without changing research decisions, budgets, retries, catalog writes, reports, durable run lifecycle/accounting, eval acceptance or exit status.

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
Stored application logs SHALL include a short message, severity, durable runId and useful run/source context. Real trace/span identifiers SHALL be retained when available and SHALL NOT be invented when tracing is disabled. The runId SHALL match the ingestion record and report.

#### Scenario: Source context persists
- **WHEN** a source event is logged within a run
- **THEN** Studio's saved log details include the run and source context, severity, and any real trace/span correlation after reopen

#### Scenario: Local runtime diagnostics respect logging configuration
- **WHEN** application logging is enabled
- **THEN** runtime diagnostics on stderr use the configured level and runId context, while selected stored application records appear once
- **AND** unrestricted automatic runtime logs are not persisted; disabling logging suppresses those stderr diagnostics

#### Scenario: Event identity becomes known
- **WHEN** an input eventId is known, an existing event is matched, or a new event is committed
- **THEN** subsequent application logs and runtime diagnostics include eventId in their context
- **AND** earlier logs are unchanged and transient dry-run creation IDs are not bound as eventId

#### Scenario: SDK emits its own log
- **WHEN** automatic SDK logging occurs
- **THEN** the research exporter does not admit it merely because application logging is enabled

### Requirement: Research logs cover actionable execution events
Enabled logging SHALL describe selected source retrieval, discovery, model steps, completed commentary and returned reasoning, tool calls/results, retries, errors, budget limits, plan validation, write outcomes and run completion. Status/count fields SHALL reflect the observed phase; successful completion SHALL follow durable finalization. Logging SHALL NOT replay work or change generation settings. Model-step and tool-call logs SHALL omit manually measured durationMs; operation timing SHALL come from enabled traces and metrics.

#### Scenario: Source was fetched
- **WHEN** a source returns Markdown
- **THEN** the source event records useful fields such as `sourceCharacters` and selected response status/URL
- **AND** no source Markdown or full response is passed to the logger

#### Scenario: A dry run previews writes
- **WHEN** catalog changes are previewed
- **THEN** the log distinguishes preview from committed writes and retains selected counts without claiming a commit

#### Scenario: Detailed logs without tracing
- **WHEN** logging is enabled while tracing is disabled
- **THEN** model/tool start and outcome events retain timestamps, context and selected results without durationMs fields or synthetic metrics
- **AND** whole-run duration in the report and completion log retains its existing meaning

### Requirement: Research log payloads are selected by event
Logs SHALL contain only useful diagnostic fields. They SHALL exclude full prompts, message history, source Markdown or excerpts, full provider responses, transport headers/bodies, catalog snapshots and raw exception objects. Selected model commentary and returned reasoning MAY be logged with explicit shortening metadata. Debug logging SHALL obey the same exclusions.

#### Scenario: Producer selects nested response fields
- **WHEN** an HTTP response is useful for diagnosis
- **THEN** the saved log includes selected status and URL without the response envelope

#### Scenario: Debug logging is selected
- **WHEN** debug events are enabled
- **THEN** they follow the same content exclusions without unrestricted payload forwarding

### Requirement: Model commentary and returned reasoning remain distinct
Completed-step commentary and provider-returned textual reasoning SHALL be logged as separate labelled channels when available, each limited by default to 4,000 Unicode code points. Text events SHALL include original length and a truncation flag. Logging SHALL NOT collect streaming fragments, infer withheld reasoning or duplicate final structured results.

#### Scenario: Long completed text
- **WHEN** a completed step returns more than 4,000 Unicode code points in either selected channel
- **THEN** that channel logs at most its first 4,000 code points with visible shortening metadata

#### Scenario: Interrupted step
- **WHEN** a model step is interrupted before completion
- **THEN** it may have no text event; earlier completed-step events remain eligible for persistence

### Requirement: Tool events preserve calls and useful selected results

Observed tool starts and outcomes SHALL retain call identity, tool name, step/attempt context, selected arguments, and selected result metadata. Source result logging SHALL use retrieval metadata and source character count without Markdown. Unobserved outcomes SHALL NOT be fabricated; source/discovery host events SHALL not duplicate the same tool operation.

#### Scenario: A source tool completes
- **WHEN** the agent reads a source through its tool
- **THEN** the paired events retain the tool-call ID, selected URL/status and source character count, with no source body

### Requirement: Local research logs remain inspectable after exit
Enabled logs SHALL remain readable locally in Studio after exit, with severity, runId and available trace/span IDs for inspection and correlation. CLI stdout and private reports SHALL retain their contracts. Pending log persistence SHALL receive bounded best-effort completion attempts.

#### Scenario: Inspect saved logs
- **WHEN** the owner opens Studio after a completed run
- **THEN** selected events and scoped context are visible without rerunning research or accessing model credentials

### Requirement: Observability storage has explicit local ownership
Application logs, eligible traces and their execution metrics SHALL remain in local storage separate from the catalog. Contention with another process SHALL produce a bounded diagnostic without disrupting ingestion or taking ownership from that process. Existing historical files SHALL remain untouched; legacy conversion and inspection SHALL remain unsupported.

#### Scenario: Another process owns the store
- **WHEN** another process prevents opening the local observability store
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
CLI and Studio SHALL expose equivalent durable run/report outcomes. Studio SHALL expose both run IDs, preview/apply mode, research/editor/catalog/persistence statuses, known Event ID, counts, usage, safe error codes and refresh scope/saved/returned Edition counts. Version-5 reports SHALL remain durable and private, inspectable locally and excluded from public website reads. Failed starts SHALL NOT allocate ingestion history.

#### Scenario: Failure or cancellation
- **WHEN** a started attempt fails or is cancelled
- **THEN** retain known accounting/committed outcomes and attempt failed finalization; release owned resources after active work settles
- **AND** observed cancellation prevents subsequent writes without undoing confirmed commits

#### Scenario: Final persistence fails
- **WHEN** the terminal run update fails
- **THEN** report failed execution with run_persistence_failed and ingestion ID; retain the running row and committed changes without replay

### Requirement: Registered ingestion executions isolate resources and expose research data
Executions SHALL isolate their resources/results and expose inspectable phase results: research, source reads, model/editor output, operations, receipts and reports. They SHALL share one frozen currentDate and the requested scope. Inspection SHALL exclude credentials, prompts, source bodies, raw provider payloads, live resources and unsanitized exception details. Existing tracing/logging controls and safe run correlation SHALL remain available.

#### Scenario: Overlap or duplicate ID
- **WHEN** executions overlap or a duplicate active engine ID is submitted
- **THEN** keep attempts isolated and reject the duplicate before work
- **AND** rejected execution hooks cannot finalize or release the original attempt

#### Scenario: Supplied execution state is unsupported
- **WHEN** a caller supplies initialState instead of starting a fresh execution
- **THEN** reject the input before allocating attempt resources or performing source/model work

#### Scenario: Inspect execution data
- **WHEN** graph, transport, stored workflow data or errors are inspected
- **THEN** research results are inspectable while credentials, live resources and raw exception details are absent
- **AND** source reads retain retrieval metadata without page Markdown in workflow state or phase outputs, including after failure or cancellation

#### Scenario: Complete tracing
- **WHEN** a traced attempt terminates, including cancellation or persistence failure
- **THEN** finish owned tracing once with both IDs and its safe terminal code; preserve the original result/error and shared inspection store
- **AND** dry-run creates no research traces

#### Scenario: Studio and CLI share scope behavior
- **WHEN** either entry point refreshes the same target with the same scope and injected evidence
- **THEN** scope bounds, returned facts, host rejection, and catalog operations agree
- **AND** phase results are inspectable without credentials or live resources

### Requirement: Studio attempts share observability ownership
Finishing or cleaning up a Studio attempt SHALL leave local observability available for later attempts and inspection. Logging and tracing SHALL remain independently configurable.

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

### Requirement: Research respects a shared budget without a page-count cap
Research SHALL use one shared deadline and configurable agent-step allowance for the complete assignment, defaulting to 15 steps. Page reads SHALL have no count or link-depth cap; application configuration/reports SHALL expose no input-character or source-depth limit. Search/source-size/output safeguards SHALL remain. Exhaustion SHALL report known usage and unfinished checks; oversized assignments SHALL fail explicitly without silently truncating targets.

#### Scenario: Large accumulated model context
- **WHEN** research accumulates more than 240,000 input characters while steps and time remain
- **THEN** the application permits the next model request without an input-character budget failure
- **AND** the final ordinary step disables tools for the final response; any provider context-window error remains a model failure

#### Scenario: Read beyond the old cap
- **WHEN** research reads additional pages within retained safeguards
- **THEN** page count alone does not stop retrieval or reject a candidate; prompts do not impose a replacement page target

#### Scenario: Agent exhausts its allowance
- **WHEN** research exhausts its step allowance or generation time without valid output
- **THEN** report limit_reached with known usage and still finalize the durable attempt
- **AND** initial reads, discovery and retry waits remain bounded by the attempt deadline

#### Scenario: Scope resolution shares the Event budget
- **WHEN** announcement/selection research and assigned field research run for one Event
- **THEN** they share one bounded research session and budget without independent per-Edition budgets

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

#### Scenario: Follow a longer relevant link chain
- **WHEN** research follows more than two successive links to reach a relevant ticket or information page while time and steps remain
- **THEN** source retrieval proceeds without a depth-budget rejection, retaining request accounting and caching
- **AND** deadline exhaustion still blocks uncached reads and retries

### Requirement: Refresh scope fixes the mandatory verification assignment
Refresh SHALL supply scope, one frozen currentDate and saved Edition keys/dates/time zones. Full scope SHALL cover every saved Edition plus the selected current/nearest future Edition when missing; current scope SHALL cover at most one ongoing/nearest future Edition. Both SHALL check announcements. Full SHALL verify populated and missing Event summary/shared links and all supported Edition fields. Current SHALL omit Event summary/shared-link findings and require selected-Edition dates, schedule status, location, tickets and classification assessment; size, precise coordinates and detailed address SHALL be opportunistic. Current SHALL trust identity/shared links established by a prior full run, without re-auditing them or requiring persisted run-history proof; fresh Edition findings SHALL still require inspected evidence. Full SHALL verify source association. Catalog context alone SHALL NOT establish completed Edition verification.

#### Scenario: Research receives only the selected assignment
- **WHEN** research starts for add, full refresh or current refresh
- **THEN** combine shared evidence/output rules with only that assignment; default refresh uses full. Full excludes current-only identity-stop and empty-selection completion exceptions; shared refresh matching/selection rules remain available to both refresh scopes.

#### Scenario: A new announcement cannot substitute for saved history
- **WHEN** full finds nearest 2027 while 2026 is saved
- **THEN** retain every assigned 2026 check and add 2027; model completeness is evaluated, never inferred from omissions.

#### Scenario: Full does not require discovering unsaved history
- **WHEN** full completes saved-Edition checks and announcement/selection research
- **THEN** do not search solely for unsaved historical Editions or missing facts; a resolved recovery issue no longer authorizes search, even if the original URL remains wrong or inaccessible after a usable official replacement is inspected.

#### Scenario: Current scope preserves history
- **WHEN** current selects saved 2027 while 2026 exists
- **THEN** return only 2027 findings and editor plan entries; omit Event summary/shared links. Keep 2026 as matching/country/reuse context, never an update target or preservation-only plan entry.

#### Scenario: A farther future Edition already exists
- **WHEN** nearest and farther-future Editions are saved
- **THEN** full checks both; current checks only its selected Edition.

#### Scenario: No Editions have been saved
- **WHEN** the target Event has no Editions
- **THEN** either scope may research/create one supported selected Edition; unknown Event IDs fail before research and new Events require add.

#### Scenario: A proposed mutation is outside the assignment
- **WHEN** current returns multiple Editions, or full exceeds one new key or the 20-target union
- **THEN** reject before operations; temporal correctness/completeness remain model decisions assessed by evals.

#### Scenario: Opportunistic current fields do not require separate research
- **WHEN** current completes mandatory checks without separate size/coordinate/address research
- **THEN** omission does not force partial; return supported encountered facts. Full still checks all assigned fields.

#### Scenario: Event facts appear on a current source
- **WHEN** current inspects a changed description or social account
- **THEN** omit Event summary/shared-link findings; retain eventName, source summaries and identity diagnostics.

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
The full-refresh prompt SHALL instruct the model to inspect relevant known links and prior results first when a saved or candidate site belongs to another Event. Search SHALL be allowed if those links cannot establish the correct source or leave a material identity/date conflict. A replacement site SHALL require inspection. Full recovery SHALL use the shared budget before returning failure. Current SHALL trust the prior full identity/link baseline; a material identity contradiction SHALL stop current with failed/null and an unresolved identity question requesting full, without recovery or writes. Current SHALL diagnose unavailable sources without searching for replacement websites. Unrelated facts SHALL NOT become target proposals. Research SHALL continue after verifying a replacement site's association. In full scope, if useful target findings remain while identity is unresolved, research SHALL return partial with the contradiction in sources/unresolved; if no usable target findings remain, it SHALL return failed with null data and existing error/question diagnostics. The editor SHALL reject the whole item when a material identity contradiction remains unresolved, preventing all writes and publication.

#### Scenario: A wrong website can be replaced
- **WHEN** a saved namesake site is replaced by an inspected, verified target website
- **THEN** continue research; full proposes the explained Event link. Apply accepted changes atomically under guards; discard namesake facts even across countries.

#### Scenario: The saved URL is the incorrect association
- **WHEN** inspected full-recovery evidence explains the wrong saved website and establishes the target using independent saved country/location/venue clues
- **THEN** the editor may accept the structured replacement finding; the old URL alone does not establish a remaining identity contradiction. Matching names alone remain insufficient.

#### Scenario: Search results alone do not confirm a replacement
- **WHEN** full inspection cannot establish a discovered website’s association
- **THEN** continue recovery within budget; return partial with useful target findings or failed/null otherwise. Unresolved material identity blocks writes/publication.

#### Scenario: Website recovery exhausts the budget
- **WHEN** full recovery limits prevent verifying the correct website
- **THEN** report the recovery limitation; return partial with useful findings or failed/null otherwise. Writes require completed editing and no material identity contradiction.

#### Scenario: Useful partial findings retain an unresolved identity conflict
- **WHEN** full research retains useful findings and a material identity contradiction
- **THEN** research returns partial and editor rejects with a reason. Preserve findings/rejection, successful editor generation and failed item; operations/changes/receipts are empty and content/publication unchanged.

#### Scenario: A recovered website still conflicts with the saved country
- **WHEN** verified replacement facts conflict with the country baseline
- **THEN** fail the whole refresh, including any full-scope website correction.

#### Scenario: Website recovery uses the existing result contract
- **WHEN** verified recovery yields usable findings
- **THEN** explain the wrong association and target match in existing source summaries/fact reasons; require no new identity field or existing-Event data.reason, and retain partial unresolved questions.

#### Scenario: Current stops at an identity contradiction
- **WHEN** current inspects a saved site that clearly belongs to another festival
- **THEN** discard its facts, return failed/null with an identity question requesting full, and perform no replacement-site discovery, editing or writes. Preserve Event links and all Editions.

#### Scenario: Current uses an established baseline
- **WHEN** current starts after full established Event identity and shared links
- **THEN** trust that baseline without repeating identity/link validation; inspect sources for the selected Edition and retain all existing country/scope/write guards. Do not add a database flag or run-history requirement.

#### Scenario: Known link resolves the wrong website

- **WHEN** full finds that a saved site belongs to another Event but an inspected known link establishes the correct festival website without an unresolved material identity/date conflict
- **THEN** research uses that website without searching solely to recover the wrong site

#### Scenario: Known links conflict with the original event

- **WHEN** full inspected known links leave a material identity or date discrepancy with the original event information
- **THEN** instructions allow search to resolve the discrepancy rather than treating the known links as sufficient
- **AND** unrelated facts remain diagnostic context and existing country/editor guards still apply

### Requirement: Country conflicts veto the whole Event refresh
The host SHALL compare researched in-scope countries with the pre-run Event's known Edition countries before editing, and validate editorial country actions before generating operations. A differing known country, explicit clearing of a known country, or conflicting saved country baselines SHALL fail the whole Event refresh with a validation diagnostic. No links, Editions, publication changes, audits, or receipts SHALL be committed. Another year or strong source evidence SHALL NOT create an exception.

#### Scenario: A wrong saved website identifies another country
- **WHEN** a saved country is IE and researched matched facts propose AU, alongside links and tickets
- **THEN** catalog outcome is failed while researchStatus retains research completion, operations are empty, and a country_conflict error identifies the saved and observed countries and Edition keys
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
- **WHEN** research returns an explained countryCode.value:null finding for a known country, returns a differing country fact, or the editor attempts to clear that country, including facts that produce no final catalog diff
- **THEN** the host rejects the whole refresh
- **AND** the guard checks every returned country finding before editing and operation/diff derivation; editor keep/omission cannot hide a research conflict, and questions or omitted fields do not invent countries

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
Research and editor SHALL receive the same scope and frozen currentDate, with their respective catalog-fact projections. Final findings and the editorial plan SHALL satisfy schema, scope and country constraints; changing a temporal finding before final output SHALL NOT require confirmation of an earlier selection. Reports SHALL retain explanations and unfinished checks without certifying temporal correctness or completeness from catalog context alone.

#### Scenario: Valid final findings determine the assignment
- **WHEN** success/partial findings and plan pass schema/scope/country checks
- **THEN** allow application without separate selection confirmation; existing reason/unresolved rules apply.

#### Scenario: Final evidence changes a temporal finding
- **WHEN** later evidence changes dates/status/matching before final output
- **THEN** incorporate it in final findings/editor assessment; host does not compare with an earlier selection.

#### Scenario: Context is a task rather than proof
- **WHEN** reports/Studio exposes scope and saved/returned counts
- **THEN** emit no certified selection outcome or separate fact-verification report; evals check temporal choice, ambiguity, keys and unfinished history.

### Requirement: Research findings and editorial actions use named typed fields
Research SHALL retain named Edition fields, stable keys and value/reason wrappers, with clarified null semantics and evidence in existing source summaries. The editor SHALL return named typed field actions: accept, set, clear or keep. Omission SHALL preserve state without claiming verification. Ownership SHALL follow the enclosing Edition. Generic patch paths, implicit null/empty-string mutation proposals and classification add/remove instructions SHALL NOT be accepted as editorial plans.

#### Scenario: Research reuses existing compound fields
- **WHEN** research returns classification or ticket information
- **THEN** use a complete classification value/reason finding preserving unchallenged saved terms and the complete ticket block as editor input, without directly generating mutations
- **AND** partial ticket information remains in source summaries/unresolved entries when no complete research block is available; the editor supplies a complete replacement or keeps the saved block

#### Scenario: Facts for two editions remain separate
- **WHEN** venue and ticket findings concern different Editions
- **THEN** findings and actions remain under their respective Edition keys

#### Scenario: Typed fields replace generic field names
- **WHEN** a plan contains unknown fields, wrong value types or arbitrary patch paths
- **THEN** reject the entire plan before writing

#### Scenario: A partial field update preserves other facts
- **WHEN** venueName uses set, locality is omitted and venueAddress uses clear with evidence
- **THEN** update the venue, preserve locality and clear only the address

#### Scenario: Missing actions cannot clear values
- **WHEN** a field is omitted or its optional wire slot is null
- **THEN** preserve the saved value without claiming it was reviewed
- **AND** set with null or an empty-string deletion sentinel is rejected; clearing requires a clear action

#### Scenario: Prices remain a complete replacement
- **WHEN** the editor sets tickets
- **THEN** require complete intended variants and basePrice; clear empties the block and keep preserves it
- **AND** incomplete replacements fail before writing

#### Scenario: Classification has one intended result
- **WHEN** the editor changes classification
- **THEN** set supplies complete intended term IDs, preserving unchallenged saved terms; clear removes assignments only where catalog rules permit
- **AND** invalid terms or publication state reject the whole item

#### Scenario: Schedule status has one source
- **WHEN** research establishes cancellation
- **THEN** the editor can set scheduleStatus=cancelled with evidence; reject legacy descriptor status

#### Scenario: Omitted schedule status preserves existing behavior
- **WHEN** scheduleStatus is omitted
- **THEN** preserve stored status or the creation default; historical research needs no completed status

#### Scenario: Add and refresh share one editorial shape
- **WHEN** either mode produces a plan
- **THEN** named field actions use the same typed contract, with creation restricted by mode and assignment

#### Scenario: Unknown or unverified values have no placeholder
- **WHEN** sources do not establish a value or a check is unfinished
- **THEN** research omits that value and describes limitations in unresolved questions
- **AND** the editor keeps or omits the field rather than treating saved values as new evidence

#### Scenario: No field-completion ledger is required
- **WHEN** a field is absent from findings or the plan
- **THEN** the host does not infer not_found, unfinished or verified status for it

#### Scenario: Editorial mutations require structured findings
- **WHEN** editor sets or clears an Event or Edition field, including a link slot or replacement block
- **THEN** the host requires a structured finding for the same owner, Edition key and field; source summaries and unresolved text alone do not authorize it
- **AND** reject the entire plan when that finding is absent; keep or omission remains permitted for saved Editions without findings

#### Scenario: Editor rejects a festival identity conflict
- **WHEN** editor assesses research and saved catalog context and returns `status:rejected` with a reason, including a wrong-festival identity conflict
- **THEN** the host performs no writes or publication and retains the rejection reason and output
- **AND** editor generation is successful while the item outcome is failed, in both add and refresh
- **AND** full research uses saved location as recovery leads and passes unresolved identity evidence to the editor; current instead stops with failed/null on a material identity contradiction before editing

#### Scenario: Editor output separates a plan from rejection
- **WHEN** the editor returns a typed output
- **THEN** it SHALL contain either `status:ready` with event, editions and unresolved, or `status:rejected` with a nonempty reason only
- **AND** missing status or rejected output containing actions fails validation

### Requirement: Research distinguishes disproven values from unknown information
Research SHALL omit unknown or unverified fields. A finding with value:null SHALL mean an existing value is disproven and no replacement is known, and SHALL include a reason and supporting evidence in source summaries. It SHALL NOT itself authorize clearing. Missing content and retrieval failure SHALL NOT be encoded as such a finding.

#### Scenario: Saved venue is disproven
- **WHEN** a source explicitly says the saved venue is no longer used but names no replacement
- **THEN** research may return venueName with value:null, a reason and supporting evidence in source summaries
- **AND** the editor separately decides whether to clear it, subject to catalog rules

#### Scenario: Country is disproven before editing
- **WHEN** research returns an explained countryCode.value:null finding for a known saved country
- **THEN** the country guard rejects the whole refresh before calling the editor, retaining findings and diagnostics without writes

#### Scenario: Country is not found
- **WHEN** useful findings exist but research cannot verify the country
- **THEN** omit the country finding and report the unfinished check; preserve the saved country without claiming confirmation
- **AND** omission alone does not trigger the country-conflict guard

### Requirement: Editing is a bounded tool-free stage
Usable validated research SHALL be followed by at most one editor generation using existing model configuration and the attempt deadline. The editor SHALL receive supplied evidence, relevant saved state, vocabulary and assignment without retrieval/search tools. It SHALL NOT retry, request further research or enter a correction loop. Failed research, country preflight rejection and duplicate add SHALL skip editing.

#### Scenario: Missing evidence cannot trigger more research
- **WHEN** the editor lacks evidence to decide a field
- **THEN** preserve that field and record uncertainty without a source or search request

#### Scenario: Editor call fails or has no time remaining
- **WHEN** generation fails, is cancelled or the deadline expires before a valid plan exists
- **THEN** no writes occur; retain findings, editor failure and known usage without retry or fallback to research mutations

#### Scenario: A duplicate add is recognized
- **WHEN** validated research matches an existing Event during add
- **THEN** return skipped without an editor request, mutations or publication changes

### Requirement: Editorial plans describe explicit catalog actions
The editor SHALL return either `status:ready` with event, editions and unresolved, or `status:rejected` with a nonempty reason only. A rejected item SHALL perform no writes or publication. A ready editorial plan SHALL identify Editions by editionKey and use accept/set/clear/keep for named typed fields or complete blocks. The host SHALL derive the Event from the validated assignment/research and resolve existing versus new Editions from saved keys. New entities SHALL require a creation reason; new Edition keys SHALL have matching research. Event IDs/names and nested target/create objects SHALL NOT be accepted in editor output. It SHALL NOT require overall apply/keep or existing-target update/keep decisions. Accept SHALL inherit the same-field research reason where present; link slots SHALL use a research-link acceptance explanation; other actions SHALL have reasons grounded in supplied research and saved state, without repeated source URLs or evidence-reference arrays. Entity deletion, reassignment, arbitrary field paths and low-level write metadata SHALL NOT be accepted. Omitted fields SHALL remain unchanged.

#### Scenario: Event identity is fixed outside editing
- **WHEN** editor returns a ready Event plan
- **THEN** refresh uses the validated requested Event and add uses research eventName
- **AND** reject editor Event IDs/names or nested target/create objects rather than adapting an obsolete plan

#### Scenario: Edition keys resolve creation or update
- **WHEN** editor addresses an editionKey with field actions
- **THEN** update the matching saved Edition or create a new one only with matching research and a nonempty creation reason
- **AND** Event creation also requires a reason; existing entities do not need a creation reason
- **AND** omitted Editions remain untouched and scope, country, new-entity clear and publication guards remain enforced

#### Scenario: Keep the whole proposal
- **WHEN** the editor finds no supported content changes and keeps or omits all fields
- **THEN** create no content mutations but still evaluate publication for addressed Editions and their owning Event
- **AND** report unchanged only if neither content nor publication changes; publication-only changes report published

#### Scenario: Editor declines Event creation
- **WHEN** add research passes validation but the editor finds insufficient grounds to create the Event
- **THEN** return event:null, editions:[] and an explanation in unresolved; report skipped without content or publication writes
- **AND** reject a null Event target for refresh or a null Event combined with Edition plans

#### Scenario: Considered Edition is preserved
- **WHEN** the editor considers an existing Edition and decides to preserve all its content
- **THEN** return its editionKey with fields:{} (or optional explanatory keep actions), retaining its eligibility for publication evaluation

#### Scenario: Entire Edition is omitted
- **WHEN** an Edition is absent from the editorial plan
- **THEN** do not process it or evaluate its publication, even if it exists in the supplied catalog context

#### Scenario: Editorial questions reuse research question types
- **WHEN** the editor reports unresolved questions or explains declined creation
- **THEN** use the existing ResearchQuestion shape: message with optional editionKey and field, rather than a separate string-only format

#### Scenario: Supported change alongside uncertainty
- **WHEN** evidence supports new dates but ticket information is inaccessible
- **THEN** the editor may set dates and keep tickets with a question, applying the valid plan atomically

#### Scenario: An old value is explicitly withdrawn
- **WHEN** an inspected organizer statement establishes that the saved venue is no longer used and no replacement is known
- **THEN** the editor can clear venueName with that evidence, subject to remaining catalog/publication constraints

#### Scenario: Preserve old data after failed retrieval
- **WHEN** a page fails or does not mention a saved value
- **THEN** absence alone does not permit clearing; the editor keeps or omits the field

#### Scenario: Invalid action combinations fail together
- **WHEN** a field keep action contains a value, set lacks a typed value, clear includes a value, a required field is cleared, or a target is invalid
- **THEN** reject the whole plan rather than silently dropping invalid actions

#### Scenario: Replacement blocks preserve saved entries without new citations
- **WHEN** the editor combines supported research findings with unchanged saved ticket variants or classification terms
- **THEN** its complete replacement and reason need no repeated source references for those entries
- **AND** research retains references for new findings; preserving saved entries does not claim they were freshly verified

#### Scenario: Catalog protection remains deterministic
- **WHEN** a plan violates versions, country constraints, domain invariants or publication requirements
- **THEN** no catalog item changes commit; reasons cannot bypass those checks

### Requirement: Editorial quality is evaluated against actual writes
Ingestion evals SHALL assess final catalog changes and preserved valid facts as well as findings. They SHALL detect wrong-Edition updates, incorrect ticket coverage/eligibility, unsupported clearing, lost valid updates and unsafe changes after unavailable sources. Results SHALL include existing total run cost and duration; a second model call or zero writes SHALL NOT itself count as correctness.

#### Scenario: An editor prevents a plausible wrong update
- **WHEN** research evidence gives a day-ticket price or a previous year's date
- **THEN** the case checks that the full-programme price or current Edition date is not overwritten

#### Scenario: Conservatism loses a valid change
- **WHEN** the editor keeps a value despite clear evidence supporting a required update
- **THEN** the eval records the missing valid update rather than treating no writes as automatically correct

### Requirement: Research estimates festival size from participant evidence

Research SHALL explain each size estimate's basis in its fact reason. Relevant historical attendance MAY inform an upcoming Edition. Unsupported numbers, maximum occupancy alone, and repeated daily admissions without a supported participant interpretation SHALL NOT establish size. Missing size after completed checks SHALL NOT alone require partial.

#### Scenario: Attendance and capacity differ
- **WHEN** sources support roughly 8000 participants and maximum occupancy of 20000
- **THEN** research proposes sizeEstimate of 8000 with its basis explained

#### Scenario: Historical or insufficient evidence
- **WHEN** current participant numbers are unavailable
- **THEN** research may use relevant historical attendance with an explained basis; otherwise it omits sizeEstimate, preserving saved values

### Requirement: Model catalog context excludes storage administration
Research and editor SHALL receive explicit projections of catalog identity and facts. Full research and the editor SHALL retain the existing complete fact projection. Current research SHALL omit Event summary/publication metadata and nonessential historical detail while retaining every saved Edition key, temporal/country and matching clues, links, classification and complete tickets. Database versions, timestamps, Edition/link storage IDs and ownership foreign keys SHALL remain host-only. Projection SHALL NOT preselect a current target, remove facts needed for matching or safe replacement, or narrow the editor preservation context.

#### Scenario: Compact shared catalog input
- **WHEN** research/editor receives saved context
- **THEN** retain identity/temporal/link/ticket facts without storage administration; host keeps its full snapshot for guards/writes.

#### Scenario: Compact current research does not narrow editing
- **WHEN** current research/editor receives the same snapshot
- **THEN** research omits Event summary/publication metadata and may omit Edition size/address, retaining all keys, temporal/country/matching clues, links, terms and complete tickets. Editor keeps the full fact projection.

#### Scenario: Historical and farther-future keys remain matchable
- **WHEN** saved dates are wrong or multiple weekends share a year
- **THEN** retain every saved key/matching clue without host preselection; saved context is a lead, never fresh evidence.

### Requirement: Editor-only evaluation replays research findings
Editor-only evaluation SHALL replay captured, validated research findings against saved fixture state without live research or source discovery. Output SHALL identify editor-only versus pipeline mode and handoff provenance/hash, and assess actual catalog writes. Replayed research SHALL NOT be presented as newly incurred provider charges or complete end-to-end accounting.

#### Scenario: Evaluate editing without new research
- **WHEN** an editor-only eval selects a case with a captured handoff
- **THEN** editor receives those findings and saved fixture context, while existing assertions score the actual resulting writes
- **AND** the report labels the mode and handoff provenance/hash

#### Scenario: Missing handoff
- **WHEN** an explicitly selected editor-only case has no handoff
- **THEN** fail before provider generation rather than silently running live research

### Requirement: Editorial acceptance resolves supported research values
Editor actions SHALL support accept without duplicated value/reason, set with an explained supported transformation, clear where permitted, and keep. An accept action SHALL use only a compatible non-null finding for the same owner, Edition key and field, retaining its explanation. Missing/null findings or incompatible values SHALL invalidate the whole plan. Arrays and blocks, including classification, SHALL be complete replacements. Research SHALL preserve unchallenged saved terms in its complete classification finding; editor SHALL check preservation before accepting or setting that list. Omitted Editions SHALL remain untouched; new Edition creation SHALL require an addressed key, matching research and a reason; deletion SHALL remain unsupported. Editor instructions SHALL permit supported URL/text/list normalization without inventing facts or removing meaningful URL components. The report SHALL retain the original editor response once.

#### Scenario: Accept an Edition field
- **WHEN** editor accepts dates for a keyed Edition
- **THEN** only that Edition's complete research dates and reason govern the catalog update

#### Scenario: Acceptance has no usable finding
- **WHEN** an accepted field is absent, null or incompatible with its editor value contract
- **THEN** no operations are generated for the item

#### Scenario: Accept classification changes
- **WHEN** editor accepts a complete research classification finding containing retained and newly supported terms
- **THEN** the resulting classification uses that complete list and reason without implicit merging

#### Scenario: Replace a list or preserve an Edition
- **WHEN** editor sets a complete list and omits another saved Edition
- **THEN** the list is replaced without merging and the omitted Edition remains untouched

### Requirement: Research tool names describe their actions

Research SHALL expose `readPage` for reading a page URL and `searchWeb` for web search. Model instructions, tool registration and new log/trace tool labels SHALL use these names consistently. Old `readSource` and `discoverSources` aliases SHALL NOT be exposed. Renaming SHALL preserve page-reading behavior and existing retrieval safeguards.

#### Scenario: Registered research tools

- **WHEN** a research agent receives its tools and instructions
- **THEN** the available tool IDs and registration keys are `readPage` and `searchWeb`
- **AND** instructions use the same names without old-name aliases

#### Scenario: New tool observations

- **WHEN** a page read or web search is logged or traced
- **THEN** the selected tool label uses `readPage` or `searchWeb` respectively
- **AND** stored historical observations are not rewritten

### Requirement: Discovery candidates include bounded highlights

Discovery SHALL return unique valid HTTP(S) URLs and titles in provider order, with highlights bounded to 2,000 characters per candidate. Highlights SHALL be untrusted selection leads; catalog facts and website identity SHALL require destination inspection.

#### Scenario: Useful excerpt accompanies a candidate

- **WHEN** a search result includes highlights
- **THEN** the agent receives bounded excerpts with its candidate URL and title
- **AND** absent, blank or invalid highlights yield an empty list without discarding the candidate

#### Scenario: Unsafe or duplicate candidate

- **WHEN** search results include invalid URLs, duplicates and later valid URLs
- **THEN** discovery skips invalid and duplicate candidates and retains later valid candidates up to its configured bound

#### Scenario: Search result has not been inspected

- **WHEN** an excerpt appears to identify the event or announce dates
- **THEN** the model inspects its destination before using those facts or claiming a verified replacement website

### Requirement: Search instructions restrict discovery to exceptional cases

The discovery tool description SHALL limit search to finding an unknown official source, recovering an inaccessible or wrong official source, or resolving material identity/date conflicts with the original event information or other inspected sources. It SHALL require relevant known links and prior results first. Missing announcements or fields alone SHALL NOT justify search. The research prompt SHALL defer to these conditions without a broader search permission.

#### Scenario: No next announcement on inspected official sources

- **WHEN** the official website and accessible relevant official social sources have been checked without finding a next-edition announcement
- **THEN** instructions direct the model to report no announcement found on inspected sources without a discovery call solely to find that announcement
- **AND** no unannounced Edition is invented

#### Scenario: Wrong or inaccessible official site

- **WHEN** an official site is inaccessible or belongs to another festival and known links cannot resolve the problem
- **THEN** instructions allow discovery of an inspectable correct or alternative source

#### Scenario: Relevant candidate already exists

- **WHEN** a prior search or inspected page contains a relevant source link
- **THEN** instructions direct the model to inspect it before searching again for the same question

#### Scenario: Missing optional field

- **WHEN** inspected official sources omit an optional catalog field without a material identity/date conflict
- **THEN** instructions preserve the unknown value without searching solely to fill that field

#### Scenario: Material identity or date conflict

- **WHEN** relevant known links and prior results give event information materially conflicting with the original identity or dates, or with other inspected sources
- **THEN** instructions allow search to resolve that conflict

### Requirement: Owner can capture agent-visible source results locally
The local ingestion process SHALL capture research source content only when `CATALOG_CAPTURE_TOOL_OUTPUTS=true`. It SHALL save each `readPage` and `searchWeb` result as the research agent received it, after existing normalization and limits. It SHALL also save the initial source projection passed in `inspectedSources` before the first agent call. Capture SHALL work for local CLI and Studio attempts and SHALL be off by default.

#### Scenario: Capture a page and a search
- **WHEN** an owner enables capture and a run supplies an initial source, returns a `readPage` result, and returns a `searchWeb` result
- **THEN** the local capture contains the initial source projection, the agent-visible page Markdown and response fields, and the normalized search response
- **AND** it contains no page text beyond what the agent received

#### Scenario: Agent reuses a cached page
- **WHEN** the agent calls `readPage` twice for the same URL and the second result comes from the source cache
- **THEN** the capture retains both responses in call order, including each response's remaining-budget fields

#### Scenario: Capture is disabled
- **WHEN** the capture setting is absent or is not `true`
- **THEN** the run creates no tool-result capture files

### Requirement: Captured results remain separate from durable ingestion records
The process SHALL place captured results under an ignored local `data/catalog-debug/<runId>/` directory and identify their call order and origin. It SHALL NOT add source bodies or search response content to catalog run records, final reports, logs, or traces. A capture write failure SHALL be visible to the owner and SHALL NOT change research, catalog writes, run finalization, or exit status.

#### Scenario: Owner inspects one run
- **WHEN** capture is enabled for a run with several source results
- **THEN** each saved result can be matched to its runId, tool or initial source, and call order
- **AND** the existing report and observability content boundaries remain intact

#### Scenario: Local capture cannot be written
- **WHEN** a capture directory or file cannot be written
- **THEN** the owner receives a bounded capture diagnostic
- **AND** the attempt follows its normal research and catalog outcome

### Requirement: Eligible traced ingestion records execution metrics
Eligible traced apply runs SHALL record operation durations and technical status for agent, model and tool execution, plus available model token usage. Metrics SHALL follow tracing eligibility and remain independent of application logging. Dry runs, injected candidate runs and runs with tracing disabled SHALL emit no ingestion metrics.

#### Scenario: Tracing without application logging
- **WHEN** an eligible apply run executes research, editing and tools with tracing enabled and logging disabled
- **THEN** their completed operations produce duration observations and available model token observations
- **AND** model usage includes available cache and reasoning categories without adding those subsets to total token counts

#### Scenario: Metrics are ineligible
- **WHEN** tracing is disabled or the run is a dry run or uses an injected candidate generator
- **THEN** no ingestion metric records are emitted, even if application logging is enabled
- **AND** when logging is also disabled, the attempt opens no observability store

#### Scenario: SDK emits another metric
- **WHEN** an eligible run emits a metric with a valid technical name and finite nonnegative value outside the currently observed duration and token names
- **THEN** the metric passes the same safe-field projection and persists without an application allowlist update
- **AND** malformed names are dropped with content-free diagnostics

#### Scenario: Technical success is not catalog success
- **WHEN** a tool completes normally with a failed retrieval result or successful editor generation is followed by plan rejection
- **THEN** operation metrics retain their technical status and host diagnostics retain the retrieval or editorial outcome separately
- **AND** an operation success count does not claim successful research or catalog mutation

### Requirement: Execution metrics retain safe correlation
Metrics SHALL retain the durable ingestion runId and real trace/span correlation. Agent, tool and model dimensions SHALL support useful grouping across runs with stable technical names. Stored metric context SHALL exclude prompts, message history, source bodies, full responses, transport payloads and raw errors. Metric labels SHALL exclude per-call URLs, queries and unique identifiers.

#### Scenario: Research and editor usage can be separated
- **WHEN** research and editor use the same model in one traced run
- **THEN** stored observations can be grouped by the responsible agent and model and correlated to the same durable run
- **AND** agent and tool group names remain stable across Events and attempts

#### Scenario: Unsafe content accompanies a metric
- **WHEN** an observability event contains forbidden content in metadata, labels or cost context
- **THEN** the stored metric retains only the selected safe technical fields, or is dropped if a safe projection cannot be produced
- **AND** no raw content appears in failure diagnostics

### Requirement: Metric costs identify their accounting basis
Model metrics SHALL retain valid provider-reported cost when available for the complete generation, otherwise an available pricing estimate. Their cost context SHALL distinguish reported cost from pricing estimates. Missing cost SHALL remain unknown and reported zero SHALL remain zero. Metric costs SHALL NOT be presented as complete ingestion spending or replace durable report accounting.

#### Scenario: Provider reports every completed step cost
- **WHEN** all completed steps in a model generation report valid costs
- **THEN** its metric cost retains their total once with provider-reported provenance
- **AND** summing total input/output token metric costs does not count the same generation charge twice

#### Scenario: Reported generation cost is incomplete
- **WHEN** a completed model step lacks a valid cost
- **THEN** metric cost uses an available pricing estimate with its basis identifiable, or remains unknown if pricing is unavailable
- **AND** the durable report continues to retain known reported cost subtotals under its existing contract

#### Scenario: Known zero and absent pricing
- **WHEN** a generation reports zero cost, or supplies usage without any reported cost or matching pricing
- **THEN** the former retains zero with reported provenance and the latter retains token observations without a cost value

#### Scenario: Search incurs additional charges
- **WHEN** discovery contributes model or search charges outside traced model generation
- **THEN** the durable report retains its existing accounting and model metrics do not claim to include those charges
- **AND** documentation explains this difference before comparing the two totals

### Requirement: Local metrics can be inspected after execution
Metrics SHALL remain queryable locally after exit, with totals, grouped values, time series and latency percentiles. Inspection SHALL require no model credentials or execution. Metric persistence SHALL use the existing local observability ownership and bounded cleanup rules. Failures SHALL NOT change catalog decisions, report accounting, durable lifecycle, eval acceptance or exit status.

#### Scenario: Inspect saved metrics
- **WHEN** a traced run exits and the owner reopens local inspection
- **THEN** saved metrics and their aggregates are available without rerunning research or accessing the catalog
- **AND** inspection can correlate observations with their saved trace and durable runId

#### Scenario: Metric persistence fails
- **WHEN** metric initialization, export, flush or shutdown fails
- **THEN** ingestion preserves its original result and attempts independent bounded cleanup with content-free diagnostics
- **AND** cleanup of a Studio attempt leaves the shared store usable for later attempts and inspection

#### Scenario: Historical observations have no metrics
- **WHEN** an existing observability store is opened after this change
- **THEN** existing logs and spans remain available and new runs can append metrics
- **AND** absent historical metrics are not backfilled or interpreted as zero usage
