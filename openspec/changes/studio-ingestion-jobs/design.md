# Design

## Change size

Medium. This adds a catalog queue and changes chat refresh to durable submission. Main risks are repeated work after a worker restart, cancellation at job start, separate process storage, and confusing queue progress with ingestion results.

## Approach

Studio validates a fixed selection and stores one job per Event in a single catalog transaction. A separate worker process takes the next pending or saved running job, runs the existing ingestion workflow, marks the job done, then takes the next job. Studio does not start or stop that process. Both processes use the same catalog SQLite file. The chat tool returns after submission. `ingestion_jobs` owns scheduling; `ingestion_runs` owns attempts and reports.

Mastra owns workflow execution and diagnostic storage. See [the proposal](proposal.md) and [job behavior](specs/catalog/ingestion-tasks/spec.md).

## Contracts

### Submission

Keep `refresh_events` input names. Accept 1–200 distinct existing Event IDs, scope current or full, and dryRun default true. Scope defaults to full; republish remains off. Submission needs the migrated catalog, not worker availability or ingestion credentials. The worker validates its credentials and processing configuration before research. Jobs can wait while the worker is stopped. Parse input once before the catalog write transaction. Inside that transaction, validate schema readiness and the complete Event ID selection before inserts. Save IDs and operation settings, not catalog snapshots or selection SQL.

Generate a batch UUID and job UUIDs in the host. Insert all jobs in selection order in one transaction. Return only `{ batchId, acceptedCount }` after commit. Read individual job IDs and Event associations through `query_catalog`. Validation or transaction failure leaves no accepted subset. Include the batch ID in existing host logging when logging is available. If the response is lost after commit, jobs remain accepted. Find the saved batch through read-only catalog SQL rather than submit again; recovery must work without logs. A later owner message does not provide cross-request deduplication.

Reuse the host consumed flag. Invalid input does not consume the limit. After selection validation inside the synchronous submission transaction, check and set the flag before inserts. No asynchronous gap is allowed between validation, flag acquisition, and insertion. Later calls in that assistant execution return `selection_consumed`, including after a transaction error. Do not cache responses or retry automatically. Observe request abort before the transaction. Once committed, the jobs remain accepted regardless of request abort or response delivery.

### Stored state and run association

Add `ingestion_jobs` to the catalog schema with job ID, batch ID, selection position, Event ID, scope, dryRun, queue status, and UTC created_at. Jobs have no started_at or finished_at; attempt timing remains in ingestion_runs. This omits separate job start and finish times, including for jobs with no attempt. Use pending, running, done, and cancelled states. Done means processing ended; it does not mean ingestion succeeded. Do not store reports, outcome, failure details, or result summaries in jobs. Order by batch creation and batch ID, then selection position. Keep batch creation time common to all jobs in a submission. Preserve the requested Event ID as historical input without an Event foreign key, as ingestion_runs already does.

Add nullable indexed `ingestion_runs.job_id` referencing `ingestion_jobs.id`. It is not unique: a restart can create another attempt for the same job. Each attempt has a fresh run ID. Historical and direct attempts keep null. Attempt creation validates the running job and input agreement and saves the association before source or model work. Put related-state checks and insertion in a short transaction owned by the start operation; the current startIngestionRun rejects an existing transaction, so do not wrap it unchanged in an outer transaction. Keep run lifecycle and report version 7 unchanged. SQLite owns structural constraints; business validation stays in application operations.

A job can reach done without a run if validation fails before attempt creation. Report the safe processing error through existing diagnostics when available; do not invent a run or job result. A failed final report write leaves its run unfinished under the existing contract. Keep job and run records with catalog history; this version has no automatic expiry or pruning.

### Inspection and cancellation

If the batch ID is missing after a lost response, use `query_catalog` to find recent batches in `ingestion_jobs`. Compare saved creation time, Event IDs, and operation settings with the available request context. Use bounded queries and state truncation or missing evidence. Resolve the batch only when the saved evidence identifies it; ask the owner if several candidates remain or the evidence is incomplete. Then read its progress through the same SQL tool. This read path creates no jobs and needs no new table, tool, or log store.

Use `query_catalog` for queue progress, job settings, and all associated runs and their results. Add catalog-sql guidance for aggregate status counts and joins from jobs to runs. Count queue states from jobs with SQL aggregation. A join can return several runs per job; do not count joined rows as jobs or discard earlier attempts. Read item details with the existing row and byte limits, and state missing or truncated evidence. Separate queries can observe different moments while processing continues. Keep job records private and exclude them from public website reads. No separate inspection API or response schema is needed. Stored jobs do not establish whether the processor is currently active; chat must not infer processor health from them.

Keep a validated cancellation tool for a resolved batch ID. Cancel all pending jobs in that batch in one catalog transaction. Return not found for an unknown batch and a safe error if catalog access fails; do not create or migrate the catalog. Pending claim and cancellation use conditional updates from pending, so a job is either cancelled or claimed. Running and terminal jobs remain unchanged by cancellation, including a saved running job whose new execution has not started. Return counts from the transaction. Status reads never submit work. No generic queue writes are exposed through `query_catalog`.

Queue state, attempt lifecycle, research completeness, and catalog outcome remain separate. A done job can have failed or unfinished attempts. After restart, a running job can also have an earlier finalized attempt. Read results from the associated runs; never infer success from done or replace missing reports with an invented result.

## Architecture

```text
Studio chat -> validated submission -> catalog ingestion_jobs
                                          |
                               separate worker (one job)
                                          |
                               existing ingestion workflow
                                          |
                                ingestion_runs + catalog

Studio chat -> pending cancellation -> catalog
Studio chat -> query_catalog -> jobs, saved attempts, and reports
```

Keep job validation, storage operations, and processing under `src/ingestion/jobs/`. Inject the workflow runner into the processor. A new `commands/catalog-worker.ts` owns worker resources and signal handling. It composes the existing workflow, catalog connection, and diagnostic providers without importing the Studio server or opening chat and eval stores. Reuse the existing workflow and attempt insertion paths; do not add another ingestion engine. Remove the synchronous chat loop, active-conversation guard, and request-to-active-workflow cancellation listener. Background concurrency one does not serialize direct CLI or Studio form runs.

## Key decisions

### One worker per catalog

Operate one worker per catalog. This is an operating constraint, not a programmatic guarantee. Add no processor lock, owner record, lease, or heartbeat. Starting several workers for the same catalog is unsupported and can execute the same job at the same time. Studio startup and dev reload never claim or execute jobs.

Use one sequential loop with a bounded idle polling interval and no overlapping ticks. Do not keep a second in-memory queue. In a short transaction, select the oldest job whose status is pending or running, using the existing queue order. Change a pending job to running; a saved running job stays running. Invoke the workflow after the transaction and await it before selecting another job. Conditional updates handle cancellation racing with pending job start; SQLite transactions remain part of normal writes. Never hold a transaction across research.

### Restart and failures

Use the same loop for new and interrupted work. Do not reset running jobs to pending at startup or add a separate recovery pass. A saved running job remains running until its fresh execution ends; it is not eligible for pending cancellation while waiting. Each execution calls workflow.createRun() for a fresh engine run ID and starts from the beginning with current catalog facts. Attempt creation also allocates a fresh ingestion run ID. Do not resume saved workflow steps or change earlier run records.

A previous attempt can have committed changes or even finalized its report before the worker stopped. The job still runs again if its queue state remained running. This is deliberate restart behavior, not exactly-once execution. A new attempt can add model calls and source reads; earlier catalog commits are not rolled back. Done and cancelled jobs are not restarted.

Reuse validation in `CatalogAttempt` for Event and processing prerequisites before attempt insertion. Submission still checks the complete selection before acceptance. Add only running-job and input-association checks to attempt start. Missing credentials or a removed target can stop processing before an attempt exists. Once a workflow returns or throws normally, mark its job done and continue; do not retry ordinary failures within the same process.

If reading or writing queue state fails, stop dispatch and use existing diagnostics. Leave the job running when its final queue state cannot be saved. A later worker restart selects it as running and executes it again, even if an earlier attempt finalized. Do not infer a job result from an exception or parse JSON from error.message.

### Worker lifecycle and launch

Add `pnpm run catalog:worker` for local use with the existing .env loading pattern. Add `worker:start` for the built command, which reads runtime environment inputs. Neither command starts an HTTP server, migrates the catalog, or starts Studio. Use the same absolute DATABASE_PATH in Studio and the worker. Open the existing catalog with fileMustExist, foreign keys enabled, and the current busy timeout. Missing or unmigrated storage fails worker startup with a safe error and nonzero exit. Initialize required workflow storage before starting the loop.

On SIGINT or SIGTERM, stop taking jobs and cancel the active workflow through its existing cancellation path. Await cleanup and leave a shutdown-interrupted job running so the next worker startup processes it again. Do not mark it done merely because cancellation settled the workflow. A job that finished normally before shutdown remains done. Preserve all saved reports and commits. Flush observability after cleanup, then close stores. Keep repeated shutdown safe. Chat cancellation, batch cancellation, and Studio shutdown do not stop the active worker workflow. Stop the old worker before starting its replacement.

Bundle the worker entry with the existing Studio command build. Reuse the Studio image for a `worker` Compose service with a command override, the shared /data volume, the same provider settings, and the shared workflow history at /data/mastra-workflows.sqlite, and worker observations at /data/mastra-worker-observability.duckdb. Publish no worker port and disable the inherited Studio HTTP health check. Use the existing restart policy; do not add a worker health API. Verify the service can stay running with an empty queue and no provider keys. Extend the existing container smoke check to cover worker startup alongside Studio.

Database transfer and maintenance must stop the worker as well as Studio and web. Update db-transfer service stop/restore handling and include the worker DuckDB file in --with-mastra transfers. Document local and built launch, provider settings, one worker per catalog, and safe replacement in the ingestion and infrastructure guides.

### Diagnostic storage

Use the same workflow SQLite file as Studio and CLI. The existing LibSQL adapter uses WAL and a busy timeout for writes from separate processes. Keep one workflow history path so Studio can list worker executions and their saved steps. Verify concurrent writes and reads in a two-process test before treating this integration as complete.

Studio and worker cannot write to the same DuckDB file. Use CATALOG_WORKER_OBSERVABILITY_DATABASE_PATH with default `data/mastra-worker-observability.duckdb` for the worker and transfer commands. The worker maps that path to the existing observability provider input. This keeps a shared .env from selecting the Studio DuckDB file for the worker. Keep Studio and direct CLI defaults unchanged. Use the same CATALOG_WORKFLOW_DATABASE_PATH as Studio. Resolve paths from the project root for local use; built launch uses explicit absolute paths. Run existing path collision validation before opening providers. Explicit overrides must keep worker observations separate from DuckDB files used by live Studio or CLI processes.

Catalog progress and all ingestion reports remain available in the running Studio through query_catalog. Native workflow history is also available through the shared workflow store. Worker logs, traces, and metrics use its own DuckDB file and are not merged into the live Studio view. To inspect them, stop the worker and open Studio with that DuckDB file selected. Existing logging and tracing controls still apply; optional observation failures do not change ingestion results.

### Dependency boundary

The application owns the queue. Do not enable Mastra Background Tasks or copy its leases, task identities, retries, or retention. Remove only the unfinished native-task prototype introduced for this change, including its storage-domain additions and expected-failure fixture. Keep existing workflow and eval storage ownership.

## Simpler options

A single batch row with a mutable list would make per-Event state and run association harder to query and update. One row per Event gives independent progress and pending cancellation without another table. A batch table, processor locks, leases, retry scheduling within a process, and a retention service are outside this version. The separate worker uses the existing application image and workflow providers; it needs no broker or HTTP control protocol.

## Risks and validation

- Use real SQLite transactions to verify complete acceptance, rollback, fixed selection, and the 200-Event bound.
- Verify cancellation before and after job start, including an interrupted running job waiting for fresh execution. Verify non-overlapping loop ticks and continuation after ordinary workflow failure.
- Use a worker process fixture: stop with one running job and several pending jobs, then restart. All unprocessed jobs must run in queue order; the old running job starts a new workflow with a new run ID. Verify the loop reads both eligible states without a startup reset. Preserve old run records.
- Cover restart before attempt creation, after unfinished work, and after report finalization but before done is saved. Verify repeated research uses current catalog facts and keeps prior commits. Done and cancelled jobs must not run again.
- Verify several attempts can reference one job, all remain queryable, and SQL progress counts do not increase because of run joins. Failed ingestion must leave a done job without storing its result in the job row.
- Inject attempt insertion and done-update failures. Ensure no research starts without a saved run, a failed queue update stops dispatch, and restart can try the remaining running job again.
- Exercise local and built worker launch, shutdown cleanup, and repeated shutdown under the one-worker operating constraint. Keep Studio running during worker restart and keep the worker running during Studio restart. Verify Studio restart does not change running jobs and only the worker executes them. Document the unsupported multiple-worker case; add no lock tests.
- Verify batch discovery after a lost response with logging disabled and with a failed sink. Cover ambiguous and incomplete evidence; discovery must not submit jobs.
- Verify request abort before submission and after acceptance, the consumed flag, submission with a stopped worker or without ingestion credentials, worker processing failures, missing catalog storage, and direct CLI/form behavior. Verify concurrent snapshots, Studio history reads, direct form execution, and Studio restart against the shared workflow file. Verify worker observation inspection after worker shutdown.

Update `docs/ingestion-tools.md` for submission, inspection, cancellation, and restart behavior. Update `docs/infrastructure.md`, `docs/development.md`, `docs/project-structure.md`, and catalog-sql guidance for job/run ownership. Use existing logging controls and safe correlation under `operations/ingestion-diagnostics`; add no trace processor or sink. Main specs stay unchanged until implementation is verified and synced.
