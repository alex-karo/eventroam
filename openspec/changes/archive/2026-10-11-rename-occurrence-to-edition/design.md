# Design

## Context

Baseline: main `00eb481`. Catalog/SQLite use Occurrence; agent/public contracts already use Edition. This change renames the existing code and storage. [Scoped refresh](../2026-10-11-scoped-event-refresh/proposal.md) depends on it and owns all later research/report behavior changes.

## Goals / Non-Goals

Unify terminology while preserving identities, validation, publication, discovery, and public routes. Keep existing add/check/refresh behavior, agent schema, prompt version, report version 2 and ingestion_runs_report_ck unchanged. Archived documents and historical serialized payloads remain intact. Current consumers support only newly generated Edition reports; reading/scoring pre-rename reports is unsupported despite their version 2 marker.

## Contract changes

| Surface | Exact change |
| --- | --- |
| Code/types/files | `Occurrence` → `Edition`, `occurrence` → `edition`, `occurrences` → `editions` in active source, symbols, filenames/imports, fixtures/tests, and current docs. For example `PublicOccurrence` → `PublicEdition` and `occurrence-page.tsx` → `edition-page.tsx`. |
| Catalog DTOs | `occurrenceId/occurrenceKey/occurrenceYear` → `editionId/editionKey/editionYear`; existing `id`, key values, and years stay unchanged. |
| Catalog operations | `create/update/publish/withdrawOccurrence` → `create/update/publish/withdrawEdition`; link owner `type: "occurrence"` → `"edition"`. Other operation names and version/no-op rules stay unchanged. Active schemas reject old names, with no aliases. |
| SQLite | `occurrences` → `editions`; `occurrence_terms` → `edition_terms`; `occurrence_key/year` → `edition_key/year`; all referencing `occurrence_id` → `edition_id` in terms, links, aliases, and catalog changes. Rename related indexes/constraints; preserve foreign keys, ownership checks, unique keys, and immutable-audit triggers. |
| Agent output / provider wire | **No naming or shape change:** `{status,data,errors,unresolved}`; `data.editions[]` descriptors use `key` and optional typed `year`; errors/questions use optional `editionKey`. Facts keep `{value,reason}`, existing tickets/classification/link slots, strict validation and wire-null normalization. No identity or finding-status output. |
| Public JSON / routes | Existing `editions[]`, descriptor `id/key/year`, and actual URL paths stay unchanged. Only internal names and documentation placeholders change. |
| Existing ingestion metadata | Rename occurrence-prefixed context/tool/report/trace fields and owner discriminants to Edition where present. Preserve all other report fields and version 2; report v3 belongs to scoped refresh. |
| Historical storage | Keep audit JSON and receipt/run payloads, keys, hashes and results unchanged. Old report reading/scoring is unsupported; no report converters, compatibility adapters, or legacy operation aliases. |

## Decisions

### Rename existing code and migrate together

Update schema, operations, reads/writes, ingestion context/adapters, website imports, fixtures/tests, and current documentation together. Already-correct Edition fields retain their shape. Existing migrations remain immutable; add a forward migration with matching Drizzle journal/snapshot. Preserve all row values and relationships, including publication, versions, prices, classifications, aliases, links, and private run history.

Keep historical audit field names and serialized payloads opaque. Receipt hashes are not recalculated: a renamed payload under an old operationKey still fails the existing different-payload rule. New operations retain normal replay safety. Use temporary populated databases to prove preservation and migration rerun safety.

Current documentation and spec terminology are updated alongside implementation; the records delta owns catalog/migration guarantees; the source-workflow delta removes historical-report compatibility promises. Other specs receive terminology-only corrections with their behavior unchanged. Prompt changes are limited to Occurrence → Edition terminology, with unchanged research behavior and prompt version. Do not introduce the refresh resolver, country guard, new research instructions, or report-check removal here.

## Risks / Trade-offs

- Breaking catalog/SQL names → upgrade active callers and schema together; verify stable public and agent contracts.
- Historical payloads retain old names → preserve them as opaque history; remove legacy report-read/scoring regressions and keep receipt collision rules.
- Migration can damage links or audit protections → exercise populated legacy, fresh and already migrated databases, including FK and trigger checks.

## Migration Plan

1. Rename active code/contracts and add a forward SQLite migration with matching Drizzle metadata. Existing migrations remain immutable.
2. Verify preserved facts, relationships, versions/publication, immutable audits, receipts and run history in temporary databases; synchronize current specs/docs.
3. Before real migration, stop readers/writers, back up the catalog, migrate and start matching code. Downgrade by restoring matching code and the pre-migration DB backup.
4. Implement scoped-event-refresh separately after this change is applied and its owning specs synchronized.
