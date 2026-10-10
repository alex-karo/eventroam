# Spec Delta

## MODIFIED Requirements

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

### Requirement: Local traces use best-effort persistence and can be inspected

Tracing SHALL use the local observability store separate from the catalog and remain inspectable after exit. Completion, handled errors and cooperative aborts SHALL end owned spans and attempt bounded flush and shutdown. Logging and tracing SHALL be independently configurable. Overlapping background writes or forced termination may leave incomplete traces without changing catalog transaction guarantees.

#### Scenario: Fresh process inspection
- **WHEN** a completed run releases the store and Studio later opens it
- **THEN** safe root/source labels, result fields and the registered ingestion graph are visible without model credentials or catalog access; execution dependencies are loaded only when starting a workflow

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

## ADDED Requirements

### Requirement: Local Studio exposes an executable ingestion graph
Studio SHALL expose the shared ingestion phases and lifecycle steps, with single-target execution and live progress. Inspection SHALL require neither catalog access nor model credentials and SHALL NOT start an attempt.

#### Scenario: Inspect or execute
- **WHEN** the owner opens Studio
- **THEN** the graph and saved traces are inspectable without research or catalog creation
- **AND** missing execution prerequisites fail before a durable attempt or external work

### Requirement: Studio ingestion defaults to a single-target preview
Studio SHALL accept add by name and refresh/check by one Event ID. Dry-run SHALL default to true and republish to false. Actor SHALL be catalog-research; environment configuration SHALL supply paths, credentials and research settings.

#### Scenario: Preview or apply
- **WHEN** the owner starts valid input
- **THEN** preview rolls back catalog mutations/audits/receipts but persists its report
- **AND** explicit dry-run false applies eligible changes atomically from current state, without reusing a preview

#### Scenario: Reject invalid input
- **WHEN** input has invalid/conflicting targets, an unknown Event or unsupported overrides
- **THEN** reject it before external work or mutation; expose only mode, name, Event ID, dry-run and republish in the form

### Requirement: Studio runs retain durable lifecycle and bounded results
Studio SHALL preserve existing durable run/report semantics and expose both run IDs, preview/apply mode, research/catalog/persistence statuses, known Event ID, counts, usage and safe error codes. Complete version-2 reports SHALL remain private in ingestion_runs.

#### Scenario: Failure or cancellation
- **WHEN** a started attempt fails or is cancelled
- **THEN** retain known accounting/committed outcomes and attempt failed finalization; release owned resources after active work settles
- **AND** observed cancellation prevents subsequent writes without undoing confirmed commits

#### Scenario: Final persistence fails
- **WHEN** the terminal run update fails
- **THEN** report failed execution with run_persistence_failed and ingestion ID; retain the running row and committed changes without replay

### Requirement: Registered ingestion executions remain isolated and private
Each execution SHALL own its resources and results. Workflow data/errors SHALL exclude credentials, prompts, pages, raw provider payloads, full model responses and live resources. Existing apply-only tracing and independently configurable application logging SHALL be retained, adding both IDs and safe terminal codes; the workflow SDK logger and automatic log export SHALL remain disabled.

#### Scenario: Overlap or duplicate ID
- **WHEN** executions overlap or a duplicate active engine ID is submitted
- **THEN** keep attempts isolated and reject the duplicate before work
- **AND** rejected execution hooks cannot finalize or release the original attempt

#### Scenario: Inspect execution data
- **WHEN** graph, transport, stored workflow data or errors are inspected
- **THEN** only allowed input and bounded projections/diagnostics are present, including error messages, stacks and causes; snapshots are disabled

#### Scenario: Complete tracing
- **WHEN** a traced attempt terminates, including cancellation or persistence failure
- **THEN** finish owned tracing once with both IDs and its safe terminal code; preserve the original result/error and shared inspection store
- **AND** dry-run creates no research traces

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
CLI and Studio research SHALL use Mastra iteration and generation-time limits instead of a separate ordinary model-call limiter and generation timer. Page reads SHALL have no count cap. Search/depth/size safeguards, the attempt deadline outside generation and existing retry policy SHALL remain. Counts and known usage SHALL remain reportable, with historical version-2 reports readable.

#### Scenario: Read beyond the old cap
- **WHEN** research reads additional pages within retained safeguards
- **THEN** page count alone does not stop retrieval or reject a candidate; prompts do not impose a replacement page target

#### Scenario: Agent exhausts its allowance
- **WHEN** Mastra exhausts research iterations or generation time without valid output
- **THEN** report limit_reached with known usage and still finalize the durable attempt
- **AND** initial reads, discovery and retry waits remain bounded by the attempt deadline
