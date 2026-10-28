# Proposal

## Why

`readPage` reports page limits through overlapping status and completeness fields. It also caches Markdown after extraction has cut it, so later projections cannot use the full extracted text.

## What Changes

- **BREAKING**: Replace the model response with `url`, `status`, `markdown`, `truncated`, optional `reasonCode`, and `remaining`.
- Use `status: ok | unsupported | failed`. Merge blocked reads into `failed`. Remove the page-level `partial` status.
- Remove `completeness` and the separate extracted `links` list. Keep links in Markdown.
- Cache full extracted Markdown within the existing response byte limit. Cut text only when preparing model input, including initial inspected sources.
- Replace visible page-region labels with HTML comments for Navigation, Main content, Page header, Page footer, and Aside.
- Keep request URLs, retrieval times, methods, and HTTP status in internal metadata and reports where used. Keep the current budget fields and research completion statuses.

## Capabilities

### Modified Capabilities

- `catalog/source-access`:
  - **Before**: Source results identify retrieval metadata and mark incomplete checks as partial. The implementation also cuts extracted Markdown before caching it.
  - **After**: Model responses use the agreed small contract. Concrete reasons describe read limits. The run caches full extracted Markdown and cuts only model projections. Page regions use HTML comments.

## Impact

The change affects source extraction, retrieval contracts, source sessions, model projections, workflow metadata, reports, logs, traces, and captured tool outputs. Tests and eval fixtures must use the new source contract without legacy aliases. Documentation must describe the new fields and truncation stage.

No new dependencies are needed. Pagination, offsets, persistent caching, new source formats, retrieval fallback rules, and research completion policy are out of scope.
