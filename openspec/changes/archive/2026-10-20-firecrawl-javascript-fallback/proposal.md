# Proposal

## Why

The source reader marks sparse script-backed pages as partial, but only HTTP 403 starts Firecrawl. A festival page that returns a JavaScript app shell with HTTP 200 can therefore leave dates or tickets unread even when rendered content is available.

## What Changes

- Reuse the existing `needsJavascript` signal for sparse script-backed HTTP 200 HTML pages. This deliberately allows a short ordinary page with a script to trigger a render attempt.
- Try Firecrawl once when `FIRECRAWL_KEY` is configured and the shared deadline permits it. Keep the existing HTTP 403 fallback.
- Select rendered HTML only when it has at least 200 non-navigation text characters. Keep both rendered and direct content, within existing source limits, so direct JSON-LD remains available when space permits. Keep the original partial HTTP result if rendering fails or does not pass that check.
- Report pages that still need rendering as partial. Do not treat missing facts on those pages as verified absences.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: define when sparse script-backed HTTP 200 pages get bounded Firecrawl fallback and how a rendered result is selected.

## Impact

The source extractor, `readPage` orchestration, Firecrawl response format, adjacent source tests, the source workflow spec and the local ingestion guide. The source tool keeps its current public shape. No database or report migration is planned.
