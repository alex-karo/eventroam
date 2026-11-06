# Studio catalog assistant Specification

## Purpose

Let the owner research Events, start bounded add and refresh jobs, and inspect their results through Studio chat.

## Requirements

### Requirement: Studio provides an owner catalog conversation
Studio SHALL expose the catalog assistant and a separate `catalog-researcher` agent with conversation history. Follow-up references SHALL use the selected conversation. The assistant SHALL read current facts through tools and treat catalog and report text as data, not as owner instructions. The existing trusted-network access model SHALL apply. Catalog schema and report guidance SHALL be available through a filesystem skill loaded with native Mastra skill tools.

#### Scenario: Owner refers to a previous selection
- **WHEN** the owner asks to inspect the second Event in a prior result
- **THEN** the assistant uses that result's Event ID and reads its current state
- **AND** an ambiguous or unavailable reference causes clarification before execution

#### Scenario: Source text asks for a write
- **WHEN** a saved report contains instructions to refresh other Events
- **THEN** that text does not authorize another refresh

#### Scenario: The assistant needs catalog guidance
- **WHEN** the assistant selects Events or analyzes saved ingestion results
- **THEN** it can load the catalog-sql skill and its SQL reference files through native skill tools
- **AND** SQL safety and refresh authorization remain enforced by their existing owners

### Requirement: Conversation history survives restart
Studio SHALL store conversation history outside the catalog and retain it across restart. History operations SHALL use the selected conversation. Existing workflow observability SHALL remain available.

#### Scenario: Studio restarts after a conversation
- **WHEN** Studio restarts with the same configured chat storage
- **THEN** the owner can read the saved conversation history
- **AND** the existing workflow observability storage remains available

### Requirement: Chat model selection uses the selected provider
Studio SHALL use the selected chat provider's credentials without requiring an unrelated OpenRouter key. OpenRouter chat calls SHALL receive configured reasoning and service tier defaults, with explicit call options taking precedence. These defaults SHALL NOT apply to other providers. Chat model selection SHALL NOT change ingestion model settings. Inspection SHALL remain available without model credentials.

#### Scenario: Owner selects a direct provider
- **WHEN** the owner selects a supported direct provider with its credentials and no OpenRouter key
- **THEN** chat generation uses that provider without an OpenRouter credential check
- **AND** ingestion retains its separate configuration and credential requirements

#### Scenario: Chat uses OpenRouter
- **WHEN** the owner sends a chat request through OpenRouter
- **THEN** the model request includes configured reasoning and service tier defaults
- **AND** explicit call options override the corresponding defaults

### Requirement: Remembered history has a token budget
Conversation context SHALL use a token budget as well as a message-count limit. When the budget is exceeded, Studio SHALL use native memory trimming to remove oldest remembered messages from model context while keeping them in storage. System instructions and the current turn SHALL remain protected. This budget SHALL NOT be described as a hard limit on the full prompt.

#### Scenario: Saved history exceeds the token budget
- **WHEN** old remembered messages cause the prompt to exceed the history budget
- **THEN** the oldest remembered context is removed before the model call
- **AND** recent context that fits, system instructions, and current input remain available
- **AND** removed messages remain in conversation storage

### Requirement: Tool execution validates input and trusts host controls
Assistant tools SHALL validate input before execution. Submission limits SHALL use host-controlled state for each assistant execution, without client or model overrides. Job submission and request cancellation SHALL follow the ingestion-tasks contract.

#### Scenario: Tool input is invalid
- **WHEN** tool input does not match its input schema
- **THEN** it is rejected before tool execution

#### Scenario: The refresh request is aborted
- **WHEN** cancellation is observed before submission
- **THEN** the wrapper creates no jobs
- **AND** the assistant does not report acceptance

### Requirement: SQL access is read only with bounded output
The SQL tool SHALL accept one catalog read query. It SHALL enforce read-only access outside the model. It SHALL reject mutations, scripts, connection changes, attached databases, and extension loading. It SHALL bound result rows and result bytes. It SHALL report truncation and safe errors explicitly.

#### Scenario: Owner requests a joined selection
- **WHEN** the assistant queries Events and Editions with a supported join or read-only CTE
- **THEN** the tool returns column names and rows from the configured catalog without changes

#### Scenario: SQL attempts to change storage
- **WHEN** a query attempts a write, PRAGMA statement, ATTACH, or multiple statements
- **THEN** the tool rejects it without changing database content or connection settings

#### Scenario: Query result exceeds output limits
- **WHEN** rows or bytes exceed the result limit
- **THEN** the response identifies the returned subset as truncated

### Requirement: MVP SQL execution is synchronous
The SQL tool SHALL execute queries synchronously inside Studio with a separate read-only connection. The MVP SHALL NOT provide a hard query timeout or cancellation of an executing SQL query. Studio SHALL document that costly queries can block other work and that output limits do not bound execution time. It SHALL NOT promise an immediate busy response during a query.

#### Scenario: A query takes time to compute
- **WHEN** a read query needs substantial computation before returning rows
- **THEN** it can block Studio until it returns or fails, regardless of its result limit
- **AND** chat cancellation does not interrupt that active query

#### Scenario: A request is already cancelled
- **WHEN** the SQL tool observes cancellation before execution starts
- **THEN** it does not start the query

### Requirement: Refresh uses an explicit bounded selection
The assistant SHALL resolve the complete Event ID selection before calling refresh_events under the ingestion-tasks contract. It SHALL NOT split requests to bypass the selection limit or submit a truncated selection as complete. It SHALL report accepted count and batch ID separately from ingestion completion.

#### Scenario: Owner refreshes selected Events
- **WHEN** the owner explicitly requests an update for 67 resolved Events
- **THEN** the assistant submits them with dryRun false
- **AND** it reports acceptance separately from completion

#### Scenario: Selection is invalid
- **WHEN** submission rejects the selected Event IDs
- **THEN** the assistant explains the rejection without reporting acceptance
- **AND** it does not split or retry the selection to bypass the limit

#### Scenario: One item fails
- **WHEN** saved run evidence shows an ingestion failure for a done job
- **THEN** the assistant reports that attempt failure with available job and run IDs
- **AND** it does not describe done as proof of success

#### Scenario: Count alone does not resolve targets
- **WHEN** the prior query returned only a count or a truncated list and the owner requests all selected Events
- **THEN** the assistant resolves the complete Event ID selection before submission
- **AND** it asks for a narrower selection if it cannot resolve the complete set within the limit

### Requirement: One assistant execution starts one refresh selection
The host SHALL allow at most one validated selection to enter submission within one assistant execution. Parallel calls and retries SHALL share that limit. Invalid input SHALL NOT consume the limit. Once a validated selection enters submission, the host SHALL reject further submissions in that execution, including after a submission error. Later valid calls SHALL return selection_consumed without creating more jobs or returning a cached submission result. A lost submission response SHALL NOT authorize an automatic repeat. A new owner message SHALL start a new execution with a new limit.

#### Scenario: The agent repeats a refresh call
- **WHEN** submission has begun and the agent submits again in the same execution
- **THEN** the second call creates no jobs and returns selection_consumed

#### Scenario: Refresh calls arrive together
- **WHEN** two valid submission calls arrive concurrently in one assistant execution
- **THEN** at most one selection enters submission

### Requirement: Owner intent controls execution mode
An explicit owner request to refresh SHALL authorize apply for the resolved selection without a second confirmation. A direct catalog edit SHALL require approval of its proposal. A preview request SHALL make no catalog changes. Unclear write intent or targets SHALL require clarification. Omitted refresh scope SHALL use full. Republish SHALL remain off. Read and analysis requests SHALL NOT start ingestion by themselves.

#### Scenario: Owner asks only for an explanation
- **WHEN** the owner asks why an Event has no dates
- **THEN** the assistant reads existing facts and reports without starting refresh

#### Scenario: Owner asks for proposed changes
- **WHEN** the owner asks to preview current-scope changes
- **THEN** the tool starts current-scope attempts with dryRun true and republish off

#### Scenario: Owner supplies a direct edit
- **WHEN** the owner asks to set an Event's full description to supplied text
- **THEN** the assistant offers the edit for approval without starting a refresh

### Requirement: Analysis uses saved evidence through SQL
The assistant SHALL read saved attempts and reports through the SQL tool by ingestion run ID or job ID. It SHALL distinguish queue progress, each attempt lifecycle, research completeness, and catalog outcome. Several runs for one job SHALL remain distinct. It SHALL link conclusions to run IDs and available sources, distinguish proposed from applied changes, and state missing evidence. It SHALL NOT describe report analysis as a new independent source check.

#### Scenario: Owner asks about a refresh result
- **WHEN** a job SQL read provides an ingestion run ID
- **THEN** the assistant uses that ID to query the saved attempt and report
- **AND** it selects evidence relevant to the owner's question

#### Scenario: Research made no changes but is incomplete
- **WHEN** queried evidence shows an unchanged outcome and partial research
- **THEN** the assistant reports both facts and the unresolved questions

### Requirement: Report interpretation checks available evidence
The assistant SHALL check attempt presence, lifecycle, report presence, JSON validity, and report version before interpreting report fields. Unknown runs, absent reports, invalid JSON, and unfamiliar versions SHALL be described as evidence limits. The SQL tool SHALL return ordinary query results or safe query errors, without a separate report response contract.

#### Scenario: A saved report is absent
- **WHEN** an attempt exists but has no saved final report
- **THEN** the assistant states the available lifecycle and the absence of a final report
- **AND** it does not invent a completed outcome

#### Scenario: Report data cannot be interpreted
- **WHEN** a query shows malformed report JSON or a version not described in the schema guide
- **THEN** the assistant states that limitation without interpreting fields as a known report version

#### Scenario: A report extraction query is rejected
- **WHEN** JSON extraction returns a safe query error
- **THEN** the assistant queries attempt state, report presence, and JSON validity without JSON extraction
- **AND** it does not treat the query error alone as proof of malformed JSON or an absent run

### Requirement: Report reads use SQL output limits
Report reads SHALL use the same row and byte limits as other SQL reads. Full stored reports SHALL remain unchanged. The assistant SHALL state when its analysis uses selected fields or truncated results. No separate report summary tool or pagination API SHALL be provided.

#### Scenario: A report query exceeds the output limit
- **WHEN** a report query returns truncated output
- **THEN** the assistant identifies the evidence as incomplete and can query a smaller part
- **AND** it does not treat an empty truncated result as proof that the run is absent

### Requirement: Assistant tools use existing application logging
Assistant tools and the job executor SHALL use existing logging controls and sinks. Logs SHALL identify starts, safe outcomes, cancellation, elapsed time, and available agent, thread, tool call, batch, job, Event, and run IDs. Application logs SHALL NOT copy query text, parameters, result rows, reports, prompts, or raw exceptions. Native SDK logs and traces SHALL follow the existing ingestion-diagnostics contract. Log failures SHALL NOT change execution results.

#### Scenario: Owner inspects a tool call
- **WHEN** logging is enabled and the assistant queries or submits a selection
- **THEN** stderr and Studio contain selected tool events at the configured level
- **AND** worker execution events use its selected diagnostic store and include available job and run identities

#### Scenario: Logging is disabled or fails
- **WHEN** logging is disabled or a log sink fails
- **THEN** submission and processing keep their normal behavior

### Requirement: Chat controls jobs explicitly
The catalog assistant SHALL use query_catalog for job progress and saved attempt evidence. Batch counts SHALL describe the full batch rather than a truncated item result. Stored job state SHALL NOT be treated as proof that the processor is active. An explicit owner request SHALL authorize cancellation of pending jobs in a resolved add or refresh batch through `cancel_batch({batchId})`. Only `catalog-assistant` SHALL expose this tool. Missing or ambiguous batch references SHALL require clarification. Status requests SHALL not start or cancel jobs. Unavailable catalog storage and unknown batches SHALL be stated explicitly.

#### Scenario: Owner asks for progress
- **WHEN** the owner asks how a submitted batch is progressing
- **THEN** the assistant reads job counts and available run identities through query_catalog
- **AND** it does not claim a done job proves ingestion success or complete research

#### Scenario: Owner stops remaining work
- **WHEN** the owner asks the catalog assistant to stop a resolved add or refresh batch
- **THEN** the assistant calls `cancel_batch` under the ingestion-tasks contract
- **AND** it reports the cancellation result, active jobs, and any error

#### Scenario: Job details exceed SQL output limits
- **WHEN** a query returns a truncated subset of job details
- **THEN** the assistant states the limit and obtains complete batch counts separately
- **AND** it does not count the returned subset as the full batch

#### Scenario: Batch does not exist
- **WHEN** no stored jobs match the resolved batch ID
- **THEN** the assistant states that no matching jobs were found without inventing a submission history

### Requirement: Missing batch references use saved job evidence
When a submission response is lost, the assistant SHALL use bounded catalog SQL reads to find saved batches by available time, Event IDs, and settings. Discovery SHALL work without logs and SHALL NOT submit jobs. Ambiguous candidates, truncated results, or missing evidence SHALL require clarification before selecting a batch.

#### Scenario: Find a batch without logs
- **WHEN** the submission response was lost, logging is disabled or failed, and saved job evidence identifies one matching batch
- **THEN** the assistant resolves that batch ID and reads its progress through query_catalog
- **AND** it creates no jobs

#### Scenario: Several batches can match
- **WHEN** several saved batches match the available request context
- **THEN** the assistant presents the candidates and asks the owner to select one
- **AND** it does not select the newest batch without sufficient evidence

#### Scenario: Discovery evidence is incomplete
- **WHEN** bounded queries are truncated or no saved batch can be identified
- **THEN** the assistant states the evidence limit and asks for clarification
- **AND** it does not infer that no submission committed or automatically submit again

### Requirement: The researcher finds candidates on request
The researcher SHALL offer web search with Exa through OpenRouter. It SHALL show relevant candidate links from search results. Search alone SHALL start no add jobs. A search failure SHALL be visible and SHALL NOT produce invented results.

#### Scenario: Search without submission
- **WHEN** the owner asks which festival matches a note
- **THEN** the researcher can return candidates and links for discussion without submitting ingestion

### Requirement: The researcher submits selected Events for add
The researcher SHALL submit one add job per intended Event. Each input SHALL keep the owner's clues and relevant candidate links. An explicit request to add authorizes apply. A preview request authorizes preview only. The researcher SHALL clarify unclear grouping, references, or write intent before submission. The host SHALL enforce the existing one-selection limit per execution.

#### Scenario: Add the selected candidates
- **WHEN** the owner asks to add three clear candidates discussed in the selected conversation
- **THEN** the researcher submits one batch with three items and apply enabled
- **AND** it reports the accepted count and batch ID separately from completion

#### Scenario: Preview one Event with several clues
- **WHEN** the owner supplies a name, a map link, and a note about one festival and asks for a preview
- **THEN** the researcher submits one job that retains all three clues in preview mode

#### Scenario: The intended grouping is unclear
- **WHEN** the researcher cannot tell whether two links describe one or two requested Events
- **THEN** it asks the owner before submitting any jobs

### Requirement: The researcher reads add progress by batch ID
On a status request, the researcher SHALL read saved jobs for the batch ID. It SHALL report full counts by queue state and retrieve individual item outcomes from associated runs when available. It SHALL distinguish preview from apply, retries from separate jobs, and queue completion from catalog success. Inspection SHALL start no search or job.

#### Scenario: Mixed batch results
- **WHEN** one add is pending, one finished as a duplicate, and one finished without a report
- **THEN** the response shows one pending and two done
- **AND** it can identify each item by position, report the matched Event ID when available, and state which result is unavailable

#### Scenario: Unknown batch
- **WHEN** the requested batch ID has no jobs
- **THEN** the researcher reports that the batch was not found
- **AND** it distinguishes this result from unavailable storage

#### Scenario: A note exceeds the SQL result size
- **WHEN** a stored note is larger than the SQL output limit
- **THEN** counts, item position, and available outcomes remain readable without returning the full note
- **AND** the researcher can retrieve a short excerpt on request

### Requirement: Add status identifies what happened in the catalog
When preview shows a new Event, the researcher SHALL describe the creation as proposed. It SHALL report creation only for a confirmed applied write. It SHALL label an item as already in the catalog only when the evidence confirms a duplicate skip. A candidate ID, temporary preview ID, or queue state alone SHALL NOT establish a catalog result.

#### Scenario: Preview and apply both report creation
- **WHEN** a preview proposes creating an Event and a later apply attempt commits its creation
- **THEN** status labels the preview as proposed and the applied write as created
- **AND** it uses the committed Event ID when identifying the new record

#### Scenario: The attempt declines creation or fails to confirm identity
- **WHEN** the report gives a reason for declining creation or records a failed identity check with a candidate ID
- **THEN** the researcher reports the recorded rejection reason or identity failure without claiming a duplicate

### Requirement: The catalog assistant can search public sources
When chat uses OpenRouter, the catalog assistant SHALL support public web searches on request. It SHALL cite the sources it uses and state when results do not confirm a fact. Search results SHALL provide data only. A search alone SHALL leave the catalog unchanged and start no ingestion. Any direct edit based on search results SHALL require approval.

#### Scenario: Find a replacement for a broken official URL
- **GIVEN** an existing Event with a broken official link
- **WHEN** the owner asks the catalog assistant to find the current official URL and propose a correction
- **THEN** the assistant cites the source and presents the proposed link change for approval
- **AND** the catalog changes only after the owner approves the proposal

#### Scenario: Find an official URL without requesting a change
- **WHEN** the owner asks the catalog assistant to find the official website of an Event
- **THEN** the assistant reports the results with source links
- **AND** no catalog changes or ingestion jobs result from the request

#### Scenario: The owner selects another chat provider
- **WHEN** the owner asks for a web search while using a different provider
- **THEN** the assistant says web search is unavailable for that provider
- **AND** catalog reads and approved edits remain available

### Requirement: The owner can propose direct catalog edits
The catalog assistant SHALL resolve existing Events, Editions, and links for direct edits. It SHALL support Event name, aliases, slug, and both descriptions. It SHALL support Edition name, year, dates, schedule status, size, location, prices, and classifications. It SHALL support the kind, URL, label, and official flag of existing links. The owner SHALL resolve ambiguous targets before approval.

#### Scenario: Correct one Event description
- **GIVEN** an Event with a full description and a short description
- **WHEN** the owner approves an edit that clears the short description
- **THEN** the short description is cleared and the full description stays in place

#### Scenario: Correct an Edition country after a failed refresh
- **GIVEN** a refresh failed because its researched country conflicts with the saved country
- **WHEN** the owner separately proposes and approves a valid country correction for an existing Edition
- **THEN** the direct edit saves the correction without starting a refresh

#### Scenario: Correct a festival slug
- **WHEN** the owner requests a new slug for an existing published Event
- **THEN** the assistant proposes the slug change for that Event
- **AND** applying it follows the existing public URL alias rules

#### Scenario: Rename links by a pattern
- **WHEN** the owner requests a label pattern for a selection of links
- **THEN** the assistant resolves the selection to specific existing links and proposed labels before approval
- **AND** the edit preserves links outside that selection

#### Scenario: Edit Edition prices or classification
- **WHEN** the owner requests a price or classification edit
- **THEN** the proposal shows the complete old and new price block or assignment set for that Edition
- **AND** the existing price and classification rules apply to the write

### Requirement: Direct edits stay within existing records
Direct edits SHALL preserve Event and Edition identities, Edition keys, ownership, and publication state. The assistant SHALL reject requests to create or delete an Event or Edition, add a link, or remove a link through direct editing.

#### Scenario: An operation is outside direct editing scope
- **WHEN** the owner requests a direct edit that adds a link, removes a link, changes an Edition key, moves a link to another owner, or changes publication state
- **THEN** the assistant rejects that operation before approval

### Requirement: Studio shows the complete proposal before approval
Studio SHALL show all targets, before and after values, and the audit mode before approval. The default SHALL record changes. Omission SHALL require an explicit owner request. If the full proposal cannot be shown, Studio SHALL offer no approval for it.

#### Scenario: The owner reviews a correction
- **WHEN** the assistant proposes a URL correction with no audit mode specified
- **THEN** Studio shows the old URL, new URL, target link and owner, and that it will record the change
- **AND** the catalog changes only after the owner approves that proposal

#### Scenario: Studio cannot show the full selection
- **WHEN** the complete proposed edit exceeds the supported review size
- **THEN** the assistant reports the limit and requests a smaller selection
- **AND** Studio presents no truncated proposal for approval

### Requirement: Direct edits require Studio approval
The server SHALL require explicit approval through the built-in controls in a Studio chat thread. The owner SHALL resolve one pending proposal before requesting another. The server SHALL apply only the pending proposal's new values and audit mode. The before values describe the catalog at preview time. A revised proposal SHALL require new approval. Preview and rejection SHALL leave catalog records, versions, audit entries, and receipts unchanged.

#### Scenario: The owner declines the proposed edit
- **WHEN** the owner declines the proposal in Studio
- **THEN** the server applies none of its operations

#### Scenario: The owner approves successive edits
- **GIVEN** the owner has resolved the first proposal
- **WHEN** the owner requests another edit and approves its pending proposal
- **THEN** the server applies that proposal and reports the result

#### Scenario: A direct call tries to bypass approval
- **WHEN** a client directly invokes the edit tool or tries to supply approval outside the owner's confirmation of the pending call
- **THEN** the server rejects the attempt without writing to the catalog

### Requirement: Direct edits apply to the current record
The server SHALL apply the approved fields to the current record without requiring a preview version. The server SHALL preserve fields and links outside the edit.

#### Scenario: A record changes while approval is pending
- **GIVEN** a proposed Event description correction
- **WHEN** the Event name and description both change before the owner approves the correction
- **THEN** the server sets the description to the approved value and preserves the current name

#### Scenario: Another link is added while approval is pending
- **GIVEN** a proposed label change for an existing link
- **WHEN** another link is added to the same record before the owner approves the change
- **THEN** the server applies the label change and keeps the added link

### Requirement: Each target has an independent result
The server SHALL apply each Event or Edition and its link edits as one unit and report whether each unit changed, needed no change, or failed. A failed unit SHALL keep its previous catalog state.

#### Scenario: A link is no longer available
- **GIVEN** a proposed batch contains an Event edit and an Edition link edit
- **WHEN** the Edition link is gone by the time the owner approves the batch
- **THEN** the valid Event edit commits and the Edition edit reports a missing target

#### Scenario: One operation in a unit fails
- **WHEN** a link operation fails during application of an approved unit that also changes the Event description
- **THEN** the Event unit reports failure and retains its old description and links
- **AND** the server continues with other units in the batch
