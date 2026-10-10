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

Tracing SHALL use a dedicated local store separate from the catalog. Saved spans SHALL be inspectable after exit without a hosted account. Completion, handled errors and cooperative aborts SHALL finalize the run summary/report or failure, end spans, then await flush and shutdown attempts. Overlapping background writes or forced termination may leave incomplete traces.

#### Scenario: Inspect a finished invocation
- **WHEN** the owner opens local trace inspection after a run
- **THEN** saved traces and the registered ingestion graph are available without rerunning research, opening the catalog, or requiring model credentials; execution dependencies are checked only when the owner starts a workflow

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
Each execution SHALL own its resources and results. Workflow data/errors SHALL exclude credentials, prompts, pages, raw provider payloads, full model responses and live resources. Existing sanitized apply-only tracing and silent SDK logging SHALL be retained, adding both IDs and safe terminal codes.

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

### Requirement: Studio execution starts fresh without replaying writes
Ingestion SHALL disable automatic retries/restart recovery and reject per-step starts, resume, restart and time travel before attempt allocation. Fresh full runs SHALL use new ingestion IDs and current state; forced termination SHALL retain unknown-completion semantics.

#### Scenario: Unsupported execution mode
- **WHEN** any start/stream request uses perStep true, or a caller requests resume/restart/time travel
- **THEN** reject it without an ingestion row, attempt resources or source/model work

#### Scenario: Rerun after interruption
- **WHEN** the owner starts a fresh full run
- **THEN** research current state under a new ingestion ID without modifying or resuming the unfinished attempt
