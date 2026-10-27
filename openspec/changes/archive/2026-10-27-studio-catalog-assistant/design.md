# Design

## Change size

Medium. The change adds an owner-facing agent, SQL execution, and chat memory. It reuses catalog writes and run reports. The main risks are unrestricted SQL input, blocking queries, and ingestion cancellation. The owner accepts synchronous SQL without a hard timeout for this MVP.

## Approach

Register one `catalog-assistant` agent in the existing Mastra instance. Give it two catalog tools: `query_catalog` and `refresh_events`. The agent selects Events with SQL, runs a small explicit selection through the existing workflow, and explains saved results. See the [proposal](proposal.md) and [assistant contract](specs/catalog/studio-assistant/spec.md).

`src/mastra/index.ts` registers the assistant and `catalog-ingestion`. `src/mastra/ingestion.ts` supplies configured catalog connections and the shared observability store. Both entry points use the same workflow factory and fresh-run entry point. Do not execute shell commands or make HTTP requests back to Studio to refresh Events.

## Contracts

- `query_catalog({ sql, parameters? })` returns columns, rows, row count, and truncation state, or a safe typed error. Parameters are bound scalar values. Proposed defaults are 16 KiB SQL input, 200 result rows, and 64 KiB serialized output. These limits do not bound query execution time. Null stays null. Large integers use lossless text and binary values use an explicit encoded representation.
- `refresh_events({ eventIds, scope = full, dryRun = true })` accepts one to three distinct Event IDs. Validate all IDs before starting any run. Reject oversized selections rather than silently taking a subset. Return each Event ID with the existing `studioIngestionResultSchema` summary. Add a small safe failure wrapper only when execution has no result. Read saved lifecycle and report evidence through query_catalog using ingestionRunId, not engineRunId.

The defaults above are proposed implementation settings for this MVP. They are not claims about existing behavior. Scope, workflow mode, and dryRun remain explicit in tool results. No schema change to catalog records or ingestion reports is needed.

## Architecture

Keep the agent, filesystem skill, tools, and SQL adapter together under `src/mastra/catalog-assistant/`. Define tools with Mastra createTool and inputSchema validation. Use the supplied requestContext and abortSignal; do not add a custom tool dispatcher, context container, or cancellation protocol. Existing ingestion and catalog operations continue to own business validation and writes.

```text
Studio chat --> Catalog assistant --> SQL adapter --> Read-only catalog and saved reports
                                 --> Existing ingestion workflow --> Catalog writer
```

The `skills/catalog-sql/` directory owns the catalog schema, report instructions, and SQL examples. Register its filesystem path through native `Agent.skills`; no Workspace or custom loader is needed. Mastra supplies `skill`, `skill_read`, and `skill_search`. Keep owner authorization, refresh limits, and treatment of untrusted data in the permanent prompt.

The skill describes the configured catalog, including private run history. It does not grant access to runtime stores or arbitrary files. Read-only enforcement and output limits remain in the SQL adapter. The dev launcher supplies an absolute skill path before Mastra changes its working directory. The build copies the skill beside the built Studio entry points; the container retains it with the command files.

## Key decisions

### SQL execution and read-only access

Execute SQL synchronously inside Studio with the installed `better-sqlite3` driver. Open a separate read-only connection for each tool call and close it in a finally block after result collection or failure. Do not reuse the ingestion writer connection. No child process, worker thread, IPC, query executable, or process cleanup is required.

Queries execute one at a time on the Studio thread. Do not add an application queue or promise an immediate busy response while SQL blocks that thread. Other requests can wait until the current query returns. There is no hard execution timeout and no interruption of SQL that has already started. Check an already-aborted request before opening the connection. After SQL returns, observe cancellation before starting any later tool work.

A costly join, sort, aggregate, or recursive query can block Studio, even with a small result limit. Row and byte limits bound returned data only. Provide simple query examples in the schema guide, but do not treat model instructions as a computation limit. This is the accepted MVP trade-off.
Open only the configured catalog with `readonly: true` and `fileMustExist: true`. Set query-only mode in host code. Do not expose extension loading or custom functions with side effects. Accept only a read query that can be prepared inside a host-owned SELECT subquery. Bind parameters, check statement read-only metadata, and iterate results within byte and row limits. The installed driver rejects extra statements during prepare. SQLite parsing and the read-only connection enforce the boundary; a keyword regex is not the boundary. Reject embedded NUL bytes before prepare.

The SQL adapter limits result output even if model SQL contains comments or terminates the intended wrapper. No SQL from the model reaches `exec`, `pragma`, attach helpers, or an extension API. Test PRAGMA table functions separately: metadata reads can be allowed, but connection changes and external file access cannot be allowed.

### Reports use the SQL tool

Read ingestion_runs by ingestionRunId, not engineRunId. The catalog-sql skill owns report version 7 guidance and direct JSON extraction examples. Read preview/apply from input_json.dryRun; report_json has no dryRun. Check the returned version before interpreting report fields or reading evidence arrays.

Malformed report or input JSON can reject the extraction query. The skill supplies a separate state query without JSON extraction to inspect lifecycle, report presence, and JSON validity. A query error alone proves neither malformed JSON nor an absent run. Missing reports, unsupported versions, and truncated results limit analysis.

Use the same SQL adapter and output limits for reports and other catalog reads. Full reports remain stored. No report reader, summary DTO, field-shortening algorithm, or pagination API is added.

### Existing workflow owns refresh

Keep refresh as a thin createTool wrapper. It owns selection checks, execution limits, sequential calls, cancellation forwarding, and result mapping only. The agent uses dryRun true for preview and false for apply. Forward dryRun directly and always set workflow mode to refresh. Do not add a preview/apply mode field to tool input. Preserve the existing mode and dryRun fields in workflow results. Do not copy research, persistence, or report-finalization logic into the wrapper. Use `workflow.createRun()` for each selected Event and retain its cancellable run handle. Pass the Studio-owned observability store. Do not use the CLI convenience `runCatalogResearch()`, which hides the run handle and has no caller abort input. No new queue, batch table, scheduler, or workflow resume path is added. The tool reads the supplied abortSignal, checks it before every item, and forwards abort to the active run through its cancel method. Remove the abort listener when the run ends. Handle a signal that is already aborted before starting work. Mastra supplies the signal; the wrapper still owns this link to the run handle. Preserve known commits and persistence errors using existing ingestion contracts. Do not automatically repeat a failed write-capable call.

At the assistant execution entry, host code initializes trusted values in Mastra requestContext: `refreshConsumed: false` and the Studio conversation ID. Do not accept these control values from model input or client overrides. Initialize them once per execution, not once per tool call. All refresh tool calls in that execution share this trusted context. No separate turn ID or execution-key registry is needed. After validating a selection, check and set the flag synchronously before starting ingestion. Keep it set through failures and tool retries until the execution ends. A new owner message gets a new context.

Add a process-local conversation guard that rejects a concurrent refresh in the same conversation. Release that guard on completion, error, or abort. Existing catalog baseline checks remain responsible for conflicts with other Studio or CLI operations; this change adds no global lock service.

### Owner intent and conversation state

Agent instructions require an explicit owner update request for apply. A clear request is sufficient; do not add a second approval screen. The tool validates dryRun, scope, IDs, and limits in code. Catalog data and source text cannot grant authorization. If the selection or mode is ambiguous, the agent asks before calling refresh. Limit one server-side assistant execution to one refresh selection. Parallel and repeated calls share the same `refreshConsumed` flag. A new owner message starts a new execution. Cross-request deduplication after a network retry is not promised by this MVP; no client automatically retries refresh execution.

Use Mastra message-history memory for conversation references. Do not add embeddings, semantic recall, or a custom selection database. The installed DuckDBStore supports observability only. Add compatible pinned `@mastra/memory` and `@mastra/libsql` packages. Pass a dedicated LibSQLStore directly to the agent's Memory instance and store chat history in a separate local file under the existing data volume. Keep Memory outside the existing composite workflow and observability storage. That composite owns workflow SQLite and DuckDB providers; StudioMastra also owns the separate chat provider. Close all providers on shutdown and preserve workflow store injection. Verify Studio history operations use the agent's Memory storage.

Use the existing configured OpenRouter model by default. Native Studio model selection can select another provider for chat; that provider uses its own credentials without requiring an OpenRouter key. A native prepareStep hook checks the resolved provider. For OpenRouter only, it validates the research configuration and adds reasoning and service tier defaults, with explicit call options taking precedence. Ingestion keeps its separate model configuration. Existing inspection without credentials must still work.

Keep at most 40 remembered messages and use native Memory messageHistory with maxTokens 16000 and atMaxRemoveTokens 4000. Mastra counts the full prompt and removes oldest remembered messages when needed. It retains removed messages in storage and protects system instructions and the current turn; this is not a hard limit on the full prompt. Conversation history supplies references; tools supply current facts. New conversations do not inherit another conversation's selection.

### Assistant tool logs

Reuse the existing Pino logger, selected application log writer, and Studio log exporter. CATALOG_LOGGING and CATALOG_LOG_LEVEL control both assistant and ingestion logs. Register logs-only observability for Studio; this does not add chat tracing. Keep SDK log export off. Flush selected logs before Studio closes its observability store.

Log each tool start and completion with agent ID, available thread ID, tool call ID, available native agent run ID, and duration. SQL completion includes row count, truncation, or a safe error code. Refresh logs include selected Event IDs, scope, dryRun, and each available ingestion and engine run ID with a safe result summary. Log cancellation and failure at warn or error level. Do not log SQL text, parameters, result rows, report bodies, prompts, or raw exceptions. A log failure must not change a tool result.

### Lifetime and reporting

Runs belong to the active Studio request and process. For refresh, explicit cancellation or request abort propagates to active ingestion and prevents remaining Events from starting once the server can process it. An active synchronous SQL query can delay that processing; it cannot be interrupted by chat cancellation. Closing a tab has no promise of background completion; document the observed Studio abort behavior. Process restart never replays the selection. Persisted attempts remain the source for later inspection.

Analysis summarizes saved evidence and identifies its run IDs. No independent research agent or general web-search tool is added. A new source check requires an owner-requested refresh. The assistant distinguishes proposed changes in preview from committed changes in apply. The assistant states when analysis uses selected fields or truncated SQL results. It can query other fields when needed, within the same SQL limits.

## Simpler options

Direct synchronous SQL is the selected MVP approach. It removes process management and packaging at the cost of Studio responsiveness during a costly query. A child process can be considered later if a hard deadline is needed. Fixed search filters would remove arbitrary SQL but would also lose the requested flexible selection.

Use SQL for both catalog selection and report reads. This removes a separate report tool and its validation and summary logic. Report interpretation now depends on agent instructions and tested query examples instead of a fixed validated response. Use Studio's existing chat UI and Mastra memory instead of building a custom UI or history API. Give Memory its own storage instead of composing storage domains. Use standard tool schemas, requestContext, and abortSignal instead of custom execution infrastructure. Keep a thin refresh tool because direct workflow exposure alone does not enforce the chat selection and execution limits. Keep small request-bound refreshes instead of introducing durable job recovery. These choices retain the requested minimum and defer unattended execution.

## Risks and validation

- SQL boundary: test real SQLite files with joins, CTEs, mutations, multiple statements, ATTACH, PRAGMA, extension calls, comments, and NUL input. Confirm no changed rows or created files.
- Query limits: test large values, truncated results, connection closure after success or failure, and rejection before SQL starts when cancellation is already known. Use finite fixture queries; do not add tests that wait for an unbounded query or assert a timeout, active-query interruption, or Studio responsiveness during SQL.
- Refresh: test wrapper input and selection checks, direct dryRun and scope forwarding, result and run-ID preservation, mixed results, no automatic retry, cancellation forwarding and stopping later items, and execution guards. Use controlled workflow results for wrapper checks. Reuse src/ingestion/workflow.test.ts and src/mastra/ingestion.transport.test.ts for ingestion cancellation, known commits, and finalization failures; do not repeat those internal failure scenarios in a new chat suite. Keep a focused Studio integration check for the new connection between chat and workflow.
- Reports: verify guide queries against saved fixture reports, including absent rows, null reports, invalid JSON, unfamiliar versions, and large evidence arrays. Check run ID mapping, SQL truncation, preview/apply interpretation, and partial research versus unchanged outcomes through deterministic agent/tool fixtures. Do not add a report-specific validator or summary test suite.
- Chat: use deterministic tool fixtures to check follow-up IDs, read-only requests, clear apply requests, ambiguous requests, and instructions embedded in report text.
- Runtime: build the Studio image and verify direct SQL reads with the native SQLite dependency, chat storage persistence, and shutdown of all storage providers. Use the built-in Browser for a Studio smoke test with bounded fixtures. Real paid ingestion is not required for routine tests.
- Update the development and project-structure guides during implementation. Sync the owning specs only after implementation passes its checks.
