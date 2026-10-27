# Tasks

## 1. Read-only catalog SQL

- [x] 1.1 Add the synchronous SQL adapter inside Studio with a separate read-only connection and the design's input limits. Verify real SQLite tests reject writes, scripts, connection changes, external access, and malformed input while joins and CTEs work.
- [x] 1.2 Enforce output bounds and close the query connection after success or failure. Verify oversized results show truncation, known cancellation prevents query startup, and later queries work after a query error. Use finite queries; do not require a hard timeout or active-query interruption.
- [x] 1.3 Add schema guidance and the query tool. Include ingestion_runs and current report fields. Add two main SQL examples with direct JSON extraction: an inspect-run query and an evidence-array query. Keep report version checks in agent instructions. After a query error, use a separate query without JSON extraction to check attempt state, report presence, and JSON validity. Verify examples against a migrated fixture catalog with missing runs, null reports, invalid JSON, unfamiliar versions, and large evidence arrays. Document the query scope, output limits, and blocking behavior in the ingestion guide.

## 2. Refresh tool

- [x] 2.1 Add a thin createTool refresh wrapper around fresh existing workflow executions. Use inputSchema for input shape checks and keep research, writes, and finalization in the existing workflow. Accept dryRun with default true and pass it and scope directly to the workflow with mode refresh. Verify selection validation, forwarding, result and run-ID preservation, mixed results, and no automatic retry with controlled workflow results. Reuse existing workflow tests for research, writes, and finalization failures.

  Review COR1 (alias ARC1) resolved: The wrapper validates and retains the safe persistence-failure summary. A real Mastra run.start() failure test verifies result and run-ID preservation without retry. Invalid or unknown error messages return no_result.

- [x] 2.2 Connect the tool abortSignal to the active run cancel method, remove listeners after completion, and check pre-aborted signals. Add one-selection-per-turn enforcement through trusted Mastra requestContext values initialized once at assistant execution entry. Reject client overrides of control values; do not add a custom context container or cancellation protocol. Verify the wrapper forwards cancellation to the active run, removes listeners, and stops later Events. Reuse existing ingestion cancellation and commit-preservation tests. Verify parallel and repeated tool calls share one request-scoped refreshConsumed flag without a separate turn ID. Verify invalid input does not consume the flag, a started selection consumes it even after failure, and a new execution gets a fresh flag. Verify the conversation guard rejects overlapping refreshes from separate executions in the same conversation and releases on success, failure, and cancellation.
- [x] 2.3 Document chat refresh limits, synchronous SQL without a hard timeout or active-query cancellation, report reads through SQL with the shared output limits, and interruption behavior in the ingestion guide. Run docs:check and compare examples with tool input schemas.

## 3. Studio conversation

- [x] 3.1 Pin compatible memory and LibSQL packages and pass a dedicated LibSQLStore directly to Memory. Keep Memory outside the existing workflow and observability composite store, and preserve workflow injection. Verify Studio history operations use Memory storage, history survives restart, and shutdown releases all storage providers without changing catalog files.
- [x] 3.2 Register the assistant with two createTool tools, input schemas, schema guidance, and the existing configured model. Use the supplied requestContext and abortSignal. Verify read-only requests, explicit apply intent, ambiguous targets, follow-up IDs, conversation separation, and untrusted report instructions with deterministic agent/tool fixtures. Use saved result fixtures to check ingestionRunId, preview/apply, partial research, missing evidence, persistence failure results, and truncated SQL interpretation. Do not recreate ingestion failure injection in chat tests.
- [x] 3.3 Configure the chat storage path for local and production Studio. Verify studio:build and an image smoke check can query the catalog directly inside Studio and retain chat history on the existing volume.
- [x] 3.4 Update development and project-structure documentation for the assistant, dependencies, storage, and commands. Run docs:check and retain inspection without model credentials.

## 4. Integration and contract completion

- [x] 4.1 Use the built-in Browser to select Events, preview a bounded refresh, apply with deterministic ingestion fixtures, and inspect a failed result in Studio. Verify follow-up analysis matches saved reports and document observed tab-close and cancel behavior.
- [x] 4.2 Run type-check, lint, dependency checks, existing ingestion and transport tests, new adapter and chat tests, studio:build, docs:check, and openspec:validate. Resolve failures introduced by the change.
- [x] 4.3 Sync the completed delta specs to the owning main specs after validation. Verify the main contracts match the implemented Studio flow and rerun openspec:validate.

## 5. Assistant tool logging

- [x] 5.1 Connect the existing logger to Studio and the catalog assistant. Log tool start, completion, cancellation, and safe failures with execution context and refresh run IDs. Reuse existing logging flags, levels, stderr, and Studio storage. Verify stored logs, level filtering, disabled logging, private payload exclusion, and continued tool execution after log failure. Update the owning spec and guide, then run focused tests and project checks.

## 6. Catalog filesystem skill

- [x] 6.1 Move the catalog schema and report SQL examples to catalog-sql/SKILL.md and reference files. Use native Agent.skills path loading and retain permanent authorization instructions. Verify the agent loads the skill before SQL use and keeps authorization rules in permanent instructions.
- [x] 6.2 Retain skill files in dev, built Studio, and container command assets. Verify skill discovery and reference reads through native tools.
- [x] 6.3 Shorten assistant documentation, align the owning contracts, and repeat focused tests and project checks.

## 7. Chat model options and history budget

- [x] 7.1 Use the selected chat provider's credentials. Apply configured OpenRouter reasoning and service tier only to OpenRouter calls, preserving explicit call options and separate ingestion settings. Verify real provider request bodies with offline HTTP responses, direct provider selection without an OpenRouter key, and inspection without credentials.
- [x] 7.2 Add the native history token budget. Verify large old messages leave the model prompt but remain stored, and recent context and current input remain available. Update the owning specs and development guide, then repeat focused tests, project checks, and the Studio build.
