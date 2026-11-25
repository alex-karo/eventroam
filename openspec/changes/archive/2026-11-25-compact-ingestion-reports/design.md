# Design

## TL;DR

The report builder writes a smaller version 8 report. It uses the status of each stored reply to keep error text. Stage code measures Research, Reader, and catalog writes. The Editor review code keeps its existing observer so it can measure partial work.

## Contracts

Proposed reply shape in [the report contract](../../../../src/ingestion/contracts.ts):

```ts
type ReportModelResponse = { object: unknown; text?: string | null } | null;
```

An absent reply stays `null`. A successful reply omits `text`. If a repair changes a failed role status to success, the report keeps available text from the failed reply it still stores. The Editor field keeps the initial review reply.

New writes use version 8. Catalog SQL queries use the shared fields of versions 7 and 8. Earlier reports stay readable in their original form.

## Architecture

- Research collects and freezes evidence, validates the summary, and measures the outcome together.
- Collection keeps page cache and deduplication in `inspectPage`. A separate function processes and measures each canonical page.
- The catalog write stage keeps metrics and outcomes with the transaction and its receipts. The workflow registers and orders the steps.
- The report builder copies only the Reader overview into each source summary. Workflow steps keep their own replies and findings for inspection.
