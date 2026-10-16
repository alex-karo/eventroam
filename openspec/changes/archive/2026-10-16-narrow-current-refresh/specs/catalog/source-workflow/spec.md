# Spec Delta

## MODIFIED Requirements

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
