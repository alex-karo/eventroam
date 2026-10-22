# Proposal

## Why

The source reader turns line breaks inside HTML table cells into physical Markdown line breaks. On the Open Flair ticket page, this separates a ticket name from its price row and joins quantity choices into a meaningless number string.

## What Changes

- Keep each supported HTML table row on one Markdown line while retaining readable cell content and safe links.
- Represent table selection controls with labeled, separated choices instead of joining their option text.
- Add regression coverage for the observed ticket table and a schedule table with cell line breaks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Source reads preserve the relationship between values in HTML table rows when converting to Markdown.

## Impact

The change affects `src/ingestion/tools/read-page/extract.ts` and its tests. It does not change catalog records, ingestion decisions, or the source reader API.
