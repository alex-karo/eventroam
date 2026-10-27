# Proposal

## Why

The owner can run ingestion in Studio but cannot use a conversation to select Events and explain the results. A Studio assistant will let the owner query the catalog, refresh a small selection, and ask follow-up questions about saved reports.

## What Changes

- Add one catalog assistant with two tools: query_catalog and refresh_events.
- Give the assistant a SQL tool with database-enforced read-only access and bounded output. Execute queries synchronously inside Studio through a separate read-only connection. Do not add a child process, a hard query timeout, or cancellation of an executing query.
- Use Mastra createTool with input schemas, requestContext, and abortSignal for the assistant tools. Keep refresh as a thin wrapper around the existing ingestion workflow for an explicit selection of Events. Keep preview and apply behavior through the existing dryRun flag, and keep current and full scopes.
- Read saved ingestion reports through SQL by run ID. Give the agent report field guidance and two main SQL examples: inspect a run and read evidence arrays. Use the same SQL output limits for catalog and report reads. Keep full reports in storage. Do not add a separate report reader, summary tool, or report pagination protocol.
- Reuse the existing logger for assistant tool calls in stderr and Studio. Use the existing logging flag and level. Record selected context and safe outcomes without query text or report bodies.
- Keep conversation history for follow-up references. Read current catalog facts from tools.
- Keep at most three Events per refresh call and one selection per assistant execution. Use one host-owned refreshConsumed flag, without a separate turn ID. Keep sequential execution and no automatic recovery after process failure.
- Exclude schedules, durable batch queues, new Event discovery, separate web research, Telegram, and a custom chat UI.

## Capabilities

### New Capabilities

- `catalog/studio-assistant`: Owner chat, bounded SQL access, selected refresh execution, and report analysis in Studio.

### Modified Capabilities

- `catalog/ingestion-workflow`:
  - **Before**: Studio starts a bounded operation for one Event with preview as the default.
  - **After**: The existing form keeps that contract. Studio chat can also start a bounded selection through the same workflow after an owner request.

## Impact

- Extend `src/mastra` with the assistant and its tools. Reuse `src/ingestion` execution, validation, and durable reports.
- Add a direct SQL adapter and schema guidance. Queries cannot mutate storage, but a costly query can block Studio until it returns. Output limits do not bound computation time.
- Give Memory its own compatible LibSQL storage adapter outside the catalog schema. Keep the existing Mastra DuckDB storage for observability. Do not add store composition.
- Update Studio build coverage, development instructions, and focused adapter and chat tests. Reuse existing ingestion tests for its internal behavior. The trusted-network and external ingress access model stays in place.
