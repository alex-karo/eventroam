# Studio catalog assistant Specification

## Purpose

Let the owner select catalog Events, start bounded refreshes, and inspect their results through Studio chat.

## Requirements

### Requirement: Studio provides an owner catalog conversation
Studio SHALL expose one catalog assistant with conversation history. Follow-up references SHALL use the selected conversation. The assistant SHALL read current facts through tools and treat catalog and report text as data, not as owner instructions. The existing trusted-network access model SHALL apply. Catalog schema and report guidance SHALL be available through a filesystem skill loaded with native Mastra skill tools.

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
An explicit owner update request SHALL authorize apply for the resolved selection without a second confirmation. A preview request SHALL make no catalog changes. Unclear write intent or targets SHALL require clarification. Omitted scope SHALL use full. Republish SHALL remain off. Read and analysis requests SHALL NOT start ingestion by themselves.

#### Scenario: Owner asks only for an explanation
- **WHEN** the owner asks why an Event has no dates
- **THEN** the assistant reads existing facts and reports without starting refresh

#### Scenario: Owner asks for proposed changes
- **WHEN** the owner asks to preview current-scope changes
- **THEN** the tool starts current-scope attempts with dryRun true and republish off

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
The assistant SHALL use query_catalog for job progress and saved attempt evidence. Batch counts SHALL describe the full batch rather than a truncated item result. Stored job state SHALL NOT be treated as proof that the processor is active. An explicit owner request SHALL authorize cancellation of pending jobs in a resolved batch through a validated tool. Missing or ambiguous batch references SHALL require clarification. Status requests SHALL not start or cancel jobs. Unavailable catalog storage and unknown batches SHALL be stated explicitly.

#### Scenario: Owner asks for progress
- **WHEN** the owner asks how a submitted batch is progressing
- **THEN** the assistant reads job counts and available run identities through query_catalog
- **AND** it does not claim a done job proves ingestion success or complete research

#### Scenario: Owner stops remaining work
- **WHEN** the owner asks to stop a resolved batch
- **THEN** the assistant calls the cancellation tool under the ingestion-tasks contract
- **AND** it reports active jobs and any cancellation error

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
