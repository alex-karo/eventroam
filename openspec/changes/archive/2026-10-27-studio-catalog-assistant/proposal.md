# Proposal

## Why

The owner can run ingestion in Studio but cannot use a conversation to select Events and explain the results. A Studio assistant will let the owner query the catalog, refresh a small selection, and ask follow-up questions about saved reports.

## What Changes

- Add one catalog assistant with two catalog tools: query_catalog and refresh_events. Load catalog and report guidance from a filesystem skill when needed.
- Give the assistant a SQL tool with database-enforced read-only access and bounded output. Execute queries synchronously inside Studio through a separate read-only connection. Do not add a child process, a hard query timeout, or cancellation of an executing query.
- Validate tool input and keep refresh within the existing ingestion workflow. Keep preview and explicit apply, with current and full scopes.
- Read saved ingestion reports through SQL by run ID, with the same output limits as catalog reads. Check available evidence before explaining results. Keep full reports in storage; add no separate report reader or pagination protocol.
- Reuse the existing logger for assistant tool calls in stderr and Studio. Use the existing logging flag and level. Record selected context and safe outcomes without query text or report bodies.
- Keep conversation history for follow-up references. Read current catalog facts from tools.
- Allow Studio to select the chat provider without an unrelated OpenRouter key. Apply configured reasoning and service tier to OpenRouter chat calls. Keep ingestion model settings separate. Bound remembered history by tokens as well as message count.
- Keep at most three Events per refresh call and one selection per assistant execution. Keep sequential execution and no automatic recovery after process failure.
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
- Store conversation history separately from the catalog and existing observability data.
- Update Studio build coverage, development instructions, and focused adapter and chat tests. Reuse existing ingestion tests for its internal behavior. The trusted-network and external ingress access model stays in place.
