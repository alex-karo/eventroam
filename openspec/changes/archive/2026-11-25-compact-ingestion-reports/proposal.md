# Proposal

## Why

Private ingestion reports repeat model text and source findings that the workflow already saves. Product metrics also make the workflow step definitions longer.

## What Changes

- Reduce the saved report to the information needed to inspect an ingestion run.
- Move Research, Reader, and catalog write measurements into the code that does the work.

## Requirements

- New reports keep `object` for General, Classification, Editor, and Location replies. They omit `text` for successful replies and keep available text for reply errors.
- New reports omit `workload`. Each `sourceSummaries` entry keeps the source URL and Reader overview.
- Operators can inspect earlier saved reports and continue to receive the same stage events in PostHog.

## Acceptance criteria

- A saved report has no `workload` and no `text` on any of the four successful reply fields. Reply failures retain available text and the structured reply.
- A successful repair keeps available text from a failed reply that the report still stores. Catalog SQL can read reports from both versions.
- A report with Research blockers or specialist findings keeps the Reader overview as the source summary. Research blockers remain in `unresolved`.
- Source metrics count each processed page once. Editor metrics still include work started before a failure. Writer metrics still reflect receipts for previews and writes.

## Impact

The change affects the private ingestion report, its Studio and catalog SQL guides, and the placement of PostHog capture calls.
