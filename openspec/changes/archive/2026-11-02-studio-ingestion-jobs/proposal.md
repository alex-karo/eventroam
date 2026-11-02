# Proposal

## Why

Studio chat cannot refresh the 67 Events selected by a country query because its current limit is three Events per request. The owner needs to submit the selection and inspect progress without keeping a chat request open.

## What Changes

- Store one `ingestion_jobs` row per Event in catalog SQLite. The application owns submission, sequential execution, cancellation, and restart handling.
- **BREAKING**: Replace synchronous chat refresh with background submission for up to 200 distinct Events. Accept the complete selection in one transaction and return a batch ID before research finishes.
- Run the queue in a separate worker process. Studio submits jobs, reads progress, and cancels pending jobs. Processing continues when Studio stops. Operate one worker per catalog without a processor lock. On worker restart, run pending and saved running jobs from the beginning with new attempts.
- Keep ingestion attempts, reports, and recorded errors in `ingestion_runs`. Jobs store no ingestion result or error. Each job can have several attempts after process restarts. A pending job is not an ingestion attempt.
- Read batch progress through the existing query_catalog tool and keep a tool to cancel pending jobs. Find batches after a lost response through saved catalog jobs, without requiring logs. Keep active attempts running when the owner cancels remaining work.
- Keep direct CLI and Studio form execution. Retain the host `selection_consumed` guard and existing ingestion validation and report contracts.

## Capabilities

### New Capabilities

- `catalog/ingestion-tasks`: Durable refresh jobs, atomic selection submission, SQL progress reads, pending cancellation, and execution independent of Studio.

### Modified Capabilities

- `catalog/studio-assistant`:
  - **Before**: Chat executes up to three Events within the request and has no durable queue.
  - **After**: Chat submits a fixed selection and reads job progress through catalog SQL. Request cancellation does not stop accepted work.
- `catalog/ingestion-runs`:
  - **Before**: Attempt history has no background job association.
  - **After**: Each background attempt saves its job association before research. One job can have several distinct attempts. Direct attempts need no association.

## Impact

Add catalog schema, migration, and job operations under `src/ingestion/jobs/`. Add a worker command with its own startup and shutdown. Include the command in the existing application build and run it as a separate Compose service. Share workflow history with Studio and use a separate worker DuckDB file for concurrent use. Replace the chat refresh wrapper and update assistant tools, instructions, tests, and ingestion and operations documentation. Remove the unfinished native-task integration during implementation. Mastra continues to run ingestion workflows and provide diagnostics; Mastra Background Tasks does not own the queue. No upstream fix or task database is required. Public website behavior does not change.
