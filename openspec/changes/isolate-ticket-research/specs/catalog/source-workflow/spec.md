# Source-backed catalog workflow delta

## MODIFIED Requirements

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

## ADDED Requirements

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
