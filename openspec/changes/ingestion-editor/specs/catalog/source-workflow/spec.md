# Spec Delta

## MODIFIED Requirements

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

### Requirement: One research result governs each atomic catalog update
Research SHALL produce one final findings result. Only validated usable success/partial findings that pass country guards SHALL enter editing. Only a valid editorial plan for the requested assignment SHALL produce catalog operations; omitted values SHALL be preserved. Failed or invalid research or editing SHALL produce no operations or automatic model correction attempts. Catalog updates SHALL enforce structural, version, no-op, and publication rules atomically: an invalid operation SHALL leave the whole item unchanged.

#### Scenario: A validated proposal violates catalog constraints
- **WHEN** an editorial plan passes plan validation but violates catalog constraints, such as clearing dates while retaining scheduled status
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
- **AND** only the final editorial plan that passes schema and target validation can produce operations

### Requirement: Dates and coordinates are complete grouped facts
Dates SHALL group startsOn/endsOn/state; coordinates SHALL group latitude/longitude/precision, each with one reason. Editor set actions SHALL replace all components; keep or omission SHALL preserve them; clear SHALL clear the pair and set state/precision to unknown.

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
Research SHALL return at most one Event website, one account per supported social key, and one ticket URL per edition. Research SHALL provide evidence of officiality/association and the editor SHALL decide set/clear/keep for the same owner/kind slots; their position in the result SHALL determine ownership.

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
- **WHEN** an editorial slot is omitted, wire-null, or explicitly kept
- **THEN** preserve its saved links; inaccessible pages alone never delete them

#### Scenario: Replace a supplied link slot
- **WHEN** the editor sets a new URL for an owner/kind slot
- **THEN** replace all previous links in that slot with the selected URL, preserving other kinds/owners and public inheritance
- **AND** invalid replacements fail atomically without deleting the old links

#### Scenario: Reject malformed link proposals
- **WHEN** links are non-HTTP(S), socials is an array, keys are unknown, set values are not strings or clear/keep actions contain values, or targets invalid
- **THEN** reject the candidate before writing

#### Scenario: Malformed URLs preserve the failure report
- **WHEN** source summaries or the X/Twitter slot contain a malformed URL
- **THEN** the run reports invalid_candidate, retains the raw response and retrieval history, and produces no catalog operations

#### Scenario: Equivalent and shared URLs
- **WHEN** a slot already contains exactly its proposed normalized URL
- **THEN** the replacement is a no-op; multiple old links collapse to one when explicitly replaced
- **AND** one ticket URL explicitly assigned to two editions remains on both

#### Scenario: Clear a disproven link
- **WHEN** supplied evidence establishes that a saved link is no longer associated with its owner and the editor clears that slot
- **THEN** remove only that owner's links of that kind, preserving other slots and owners
- **AND** inaccessible destinations alone do not authorize clearing; empty-string deletion sentinels are rejected

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
Refresh SHALL give the model selection rules in its prompt, with scope and `currentDate` (an ISO 8601 timestamp string fixed once per run) alongside the catalog input, with the same assignment supplied to the editor. The host SHALL enforce schema, simple scope bounds and country guards without a separate selection resolver tool, callback or selection protocol beyond the findings and editorial plan. Temporal choice and research completeness SHALL be assessed through evals; catalog context SHALL NOT certify either.

#### Scenario: Final result needs no intermediate selection call
- **WHEN** a refresh returns valid success/partial findings and a valid plan within scope bounds and country guards
- **THEN** no missing-resolution check rejects them
- **AND** existing reason/unresolved semantics govern explanations and unfinished checks

#### Scenario: Final evidence changes a temporal finding
- **WHEN** later inspected evidence changes dates, status or matching before final output
- **THEN** research incorporates it in the final findings and the editor uses that evidence without re-resolution
- **AND** host validation does not compare it with an earlier model decision

#### Scenario: Context is a task rather than proof
- **WHEN** a private report or Studio exposes scope and saved/returned counts
- **THEN** it exposes no host-certified selected/none-found/unresolved outcome or separate confirmed/changed fact report
- **AND** separate eval assertions check ongoing-first/local-date choice, ambiguity, stable keys and unfinished historical research

### Requirement: Runs report attributable outcomes
The system SHALL report each run's mode (`add` or `refresh`) and resulting record outcome (`created`, `updated`, `published`, `unchanged`, `skipped`, or `failed`), with stable catalog identifiers where a record exists. Reports SHALL include the run's proposed or applied old/new values, factual explanations, and inspected source URLs. Refresh reports SHALL also include top-level scope/currentDate and saved/returned Edition counts, without a separate refresh-context payload, and retain returned facts, including unchanged findings, in the raw model response, plus existing unresolved questions and source summaries, even when nothing changes. Omitted facts SHALL NOT receive inferred not_found/unfinished outcomes or confirmations. Reports SHALL NOT include a separate verification array or returned-fact counters; actual changes SHALL use the existing writer audit. They SHALL separately identify research status, execution errors with stages, and unresolved questions; a catalog mutation outcome SHALL NOT stand in for research completion. Source-check results SHALL identify the inspected URL, UTC check time, and outcome, distinguishing unsupported retrieval from successful checks and failures. CLI/eval reports SHALL use version 5. Failed research/editing/writing SHALL exit nonzero; partial alone SHALL exit zero. Reports SHALL NOT require persistent source identifiers. Every started attempt SHALL retain its durable runId and final report in ingestion_runs, including failures, previews, and no-ops; exported reports SHALL match stored reports.

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

#### Scenario: Report compatibility is owned by application code
- **WHEN** the private run-table migration removes ingestion_runs_report_ck
- **THEN** existing rows and report JSON remain unchanged, including historical version-2 reports
- **AND** application finalization validates the active report version and run correspondence; database report storage does not restrict report versions

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

### Requirement: Studio runs retain durable lifecycle and bounded results
CLI and Studio SHALL share initialization after Mastra creates its engine run. Failure before engine run creation SHALL allocate no ingestion history or attempt resources. Studio SHALL preserve existing durable run/report semantics and expose both run IDs, preview/apply mode, research/editor/catalog/persistence statuses, known Event ID, counts, usage, safe error codes, and refresh scope/saved-Edition/returned-Edition counts. Complete version-5 reports SHALL remain durable in ingestion_runs and MAY appear in local Studio workflow data; public website reads SHALL NOT expose them.

#### Scenario: Failure or cancellation
- **WHEN** a started attempt fails or is cancelled
- **THEN** retain known accounting/committed outcomes and attempt failed finalization; release owned resources after active work settles
- **AND** observed cancellation prevents subsequent writes without undoing confirmed commits

#### Scenario: Final persistence fails
- **WHEN** the terminal run update fails
- **THEN** report failed execution with run_persistence_failed and ingestion ID; retain the running row and committed changes without replay

### Requirement: One catalog-run trace covers the final result

Each eligible apply trace SHALL begin before context and initial retrieval, parent research/editor/source work, and end after validation, write/rollback and report construction or failure. Root host fields SHALL be explicit ordinary objects with independent structuralValidation, targetValidation, editorStatus (success, failed or not_run), without a claim of independent source verification, writeState, known committedOperationCount, and report researchStatus/outcome when available. No logging producer SHALL depend on a trace summary to calculate its own straightforward outcome fields.

#### Scenario: Report construction fails after a commit
- **WHEN** a confirmed write succeeds but report construction fails
- **THEN** the root retains committed disposition/count and technical failure without inventing unavailable report fields

### Requirement: Registered ingestion executions isolate resources and expose research data
Each execution SHALL own its resources and results. Native Mastra workflow state SHALL accumulate one serializable catalog research context with a frozen `currentDate` ISO 8601 timestamp string and existing research result, source reads, model research output, editor output/plan, prepared operations, receipts and reports without a separate refresh-context object or second attempt-owned checkpoint. Input SHALL supply scope; country guards SHALL use the saved catalog snapshot. Each workflow step SHALL return its phase result for local Studio inspection. Caller-provided initialState SHALL be rejected; workflow initialization SHALL create state. Workflow data SHALL exclude credentials, configuration containing secrets, prompts, raw provider transport payloads and live resources. Exception messages, stacks and causes SHALL remain sanitized. Existing apply-only tracing and independently configurable application logging SHALL be retained, adding both IDs and safe terminal codes; the workflow SDK logger and automatic log export SHALL remain disabled.

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

## REMOVED Requirements

### Requirement: Edition proposals use named typed fields
**Reason**: Research no longer authorizes writes directly; its existing typed shape feeds explicit editorial actions instead of implicit clearing and host-applied classification patches.
**Migration**: Clarify existing research null semantics without adding output fields; rename referenceInstant to currentDate across agent inputs, workflow state and report v5; replace direct candidate preparation with a typed editorial plan adapter. Update producers/consumers together without a legacy write path.

### Requirement: Size contracts use report version 4
**Reason**: The unified current ingestion report contract now includes editorial plans and uses v5.
**Migration**: Use the current attributable-outcomes contract; stored v4 reports remain untouched and unsupported.

## ADDED Requirements

### Requirement: Research findings and editorial actions use named typed fields
Research SHALL retain named Edition fields, stable keys and value/reason wrappers, with clarified null semantics and evidence in existing source summaries. The editor SHALL return named typed field actions: set, clear or keep. Omission SHALL preserve state without claiming verification. Ownership SHALL follow the enclosing Edition. Generic patch paths, implicit null/empty-string mutation proposals and classification add/remove instructions SHALL NOT be accepted as editorial plans.

#### Scenario: Research reuses existing compound fields
- **WHEN** research returns classification or ticket information
- **THEN** retain existing classification add/remove suggestions and the complete ticket block shape as editor input, without directly generating mutations
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
An editorial plan SHALL identify allowed existing targets, explicitly request creation of new entities and use set/clear/keep for named typed fields or complete blocks. It SHALL NOT require overall apply/keep or existing-target update/keep decisions. Actions SHALL have reasons grounded in supplied research and saved state, without repeated source URLs or evidence-reference arrays. Entity deletion, reassignment, arbitrary field paths and low-level write metadata SHALL NOT be accepted. Omitted fields SHALL remain unchanged.

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
- **THEN** return its target with fields:{} (or optional explanatory keep actions), retaining its eligibility for publication evaluation

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
Ingestion evals SHALL assess final catalog changes and retained valid facts as well as research findings. Captured-source cases SHALL cover wrong-Edition evidence, ticket coverage/eligibility, justified clearing and unavailable sources. Evaluation SHALL use existing total run cost and duration alongside correctness, without requiring per-agent metrics; a second model call SHALL NOT itself count as successful verification.

#### Scenario: An editor prevents a plausible wrong update
- **WHEN** research evidence gives a day-ticket price or a previous year's date
- **THEN** the case checks that the full-programme price or current Edition date is not overwritten

#### Scenario: Conservatism loses a valid change
- **WHEN** the editor keeps a value despite clear evidence supporting a required update
- **THEN** the eval records the missing valid update rather than treating no writes as automatically correct

#### Scenario: Small paired quality comparison
- **WHEN** evaluating the initial editor pipeline
- **THEN** compare five captured-source cases before and after: wrong year, day-ticket price, justified clearing, unavailable source and a valid update
- **AND** record expected/actual writes and existing total cost/duration without a new scoring framework or mandatory repeated runs
