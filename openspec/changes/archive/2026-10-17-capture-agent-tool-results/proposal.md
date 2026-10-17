# Proposal

## Why

The final ingestion report and content-free traces do not show the page text or search results that the research agent received. An owner needs a local, opt-in record of those inputs to diagnose incorrect findings and retrieval behavior.

## What Changes

- Add `CATALOG_CAPTURE_TOOL_OUTPUTS=true` for local CLI and Studio ingestion attempts.
- Save each agent-visible `readPage` and `searchWeb` response under `data/catalog-debug/<runId>/`, including repeated cached responses in call order.
- Save the initial source projection supplied through `inspectedSources`, which is not a tool call.
- Keep capture files separate from run reports, catalog storage, logs, and traces. A capture failure is visible to the owner but does not change the ingestion outcome.

## Capabilities

### Modified Capabilities

- `catalog/source-workflow`: Add an opt-in local capture of the exact source and discovery content passed to the research agent.

## Impact

The change affects ingestion attempt setup, source tool wrappers, initial research input, local filesystem output, focused tests, and the ingestion and development guides. It adds no database schema or external service.
