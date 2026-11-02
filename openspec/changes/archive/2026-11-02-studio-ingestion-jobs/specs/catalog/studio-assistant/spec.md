# Spec Delta

## MODIFIED Requirements

### Requirement: Tool execution validates input and trusts host controls
Assistant tools SHALL validate input before execution. Submission limits SHALL use host-controlled state for each assistant execution, without client or model overrides. Job submission and request cancellation SHALL follow the ingestion-tasks contract.

#### Scenario: Tool input is invalid
- **WHEN** tool input does not match its input schema
- **THEN** it is rejected before tool execution

#### Scenario: The refresh request is aborted
- **WHEN** cancellation is observed before submission
- **THEN** the wrapper creates no jobs
- **AND** the assistant does not report acceptance

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

### Requirement: Assistant tools use existing application logging
Assistant tools and the job executor SHALL use existing logging controls and sinks. Logs SHALL identify starts, safe outcomes, cancellation, elapsed time, and available agent, thread, tool call, batch, job, Event, and run IDs. Application logs SHALL NOT copy query text, parameters, result rows, reports, prompts, or raw exceptions. Native SDK logs and traces SHALL follow the existing ingestion-diagnostics contract. Log failures SHALL NOT change execution results.

#### Scenario: Owner inspects a tool call
- **WHEN** logging is enabled and the assistant queries or submits a selection
- **THEN** stderr and Studio contain selected tool events at the configured level
- **AND** worker execution events use its selected diagnostic store and include available job and run identities

#### Scenario: Logging is disabled or fails
- **WHEN** logging is disabled or a log sink fails
- **THEN** submission and processing keep their normal behavior

### Requirement: Analysis uses saved evidence through SQL
The assistant SHALL read saved attempts and reports through the SQL tool by ingestion run ID or job ID. It SHALL distinguish queue progress, each attempt lifecycle, research completeness, and catalog outcome. Several runs for one job SHALL remain distinct. It SHALL link conclusions to run IDs and available sources, distinguish proposed from applied changes, and state missing evidence. It SHALL NOT describe report analysis as a new independent source check.

#### Scenario: Owner asks about a refresh result
- **WHEN** a job SQL read provides an ingestion run ID
- **THEN** the assistant uses that ID to query the saved attempt and report
- **AND** it selects evidence relevant to the owner's question

#### Scenario: Research made no changes but is incomplete
- **WHEN** queried evidence shows an unchanged outcome and partial research
- **THEN** the assistant reports both facts and the unresolved questions

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: MVP execution has no automatic recovery
**Reason**: The ingestion-tasks capability now owns durable execution, restart, and cancellation behavior.
**Migration**: Chat submits jobs under that contract and reads saved progress through query_catalog.
