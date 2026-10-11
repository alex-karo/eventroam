# Proposal

## Why

The catalog calls editions Occurrences while research and public output already use Edition. A single name removes translation overhead and prepares the existing code for the separate scoped-refresh change.

## What Changes

- **BREAKING:** Rename active Occurrence code, DTOs, operation kinds, and owner discriminants to Edition; reject old names without aliases.
- **BREAKING:** Migrate SQLite tables/columns and related schema names to Edition, preserving records, relationships, audit history, and receipts.
- Preserve IDs/keys, domain rules, public JSON/URLs, agent output, and reason/unresolved semantics.
- Update current documentation and tests; retain historical JSON and archived documents unchanged. Historical report reading/scoring is unsupported; no aliases or converters are added.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/records`: Edition contract names and data-preserving storage migration.
- `catalog/source-workflow`: Active Edition report contracts without historical-report compatibility.

## Impact

Update catalog reads/writes, DB schema/migrations, ingestion adapters and existing metadata, fixtures/tests, and UI filenames/imports. Already-correct `editions`, model descriptor `key/year`, and error/question `editionKey` retain their shapes. Existing commands, research behavior, prompt version, report version 2, budgets, and DB report check remain unchanged. Prompt terminology may change to Edition; historical report reading/scoring is no longer supported.

This change has no dependency on [scoped-event-refresh](../../scoped-event-refresh/proposal.md); that change follows it and owns refresh behavior, report v3, and removal of the report check. Verify offline with temporary databases; real owner-database execution and deployment are outside the plan. Exact mappings: [design](design.md#contract-changes).
