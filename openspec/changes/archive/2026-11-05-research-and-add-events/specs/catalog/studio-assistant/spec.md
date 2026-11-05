## MODIFIED Requirements

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

## ADDED Requirements

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
