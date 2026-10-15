# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. Applying migrations 0000–0007 to an empty database yields 20 `CHECK` constraints and six triggers. Drizzle enum annotations already provide types without SQL enum enforcement. ADR 001 explicitly retains the remaining checks, so implementation must update that decision rather than silently contradict it.

`validateEditionRecord` already covers paired/ordered dates and bounded coordinates. Other removed checks are not fully represented by shared validators: positive versions and size, price-details array validation, exclusive owners, taxonomy self-parenting/cycles, and alias Edition/Event agreement need explicit coverage. Operation schemas enforce some values but do not cover fixture paths. `validateCatalogValues` is shared by development fixtures and normal test helpers and currently checks taxonomy facet agreement, but not complete ancestry. `startIngestionRun` and `finalizeIngestionRun` already validate input and accounting and guard finalization with run ID, mode, and running status; SQL still enforces the resulting row's lifecycle.

## Goals / Non-Goals

**Goals:** Preserve the existing rules with small extensions to existing write boundaries and shared fixture validation. Keep relational integrity and write atomicity independent of business vocabulary evolution. Make the boundary discoverable in repository instructions.

**Non-Goals:** No new public taxonomy-editing API, generic validation framework, complete storage-row schemas, persistence layer, runtime schema registry, new vocabulary/status values, report-version change, or application-level replacement for database uniqueness. Raw SQL is an explicit bypass of application validation.

## Decisions

### 1. Remove all value checks; retain relational and history protections

| Current database rule | Target owner |
| --- | --- |
| Three positive-version checks; positive size estimate | Existing writer version construction and operation input validation; shared size/fixture checks where missing |
| Date and coordinate pair/range checks | Shared Edition validator, reused by writer and fixtures |
| Price-details JSON array | Shared typed price-details validation before serialization |
| Exclusive ExternalLink and CatalogChange owner | Existing owner-based operation construction; validation for caller-supplied fixture owners |
| Taxonomy self-parent check and cycle-update trigger | Transaction-aware taxonomy validation |
| Alias Edition/Event ownership trigger | Transaction-aware alias validation |
| Ten ingestion checks: mode, status, input JSON/mode, lifecycle, three integer counters, two costs, completion boolean | Existing start/finalize input checks, fixed row construction, and conditional update |
| Primary/foreign keys, uniqueness, NOT NULL | SQLite |
| Four audit/alias update/delete immutability triggers | SQLite |

Retain defaults and query indexes. Unlike preserving a subset of simple checks, this gives future contributors a clear rule without deciding whether each new business predicate is simple enough for SQL. Keeping keys and immutable-history protections avoids reimplementing concurrent uniqueness and protects append-only records independently of application callers.

### 2. Enforce rules at existing operation boundaries

Reuse operation schemas, catalog validators, and `validateCatalogValues`. Add only missing checks for caller-controlled values and related state. Existing Edition validation continues to check merged domain facts. Versions initialized to 1 and incremented by the writer, and audit owners constructed from the operation subject, do not need another complete-row validator. Preserve these construction guarantees and existing normalization. Development fixtures may still bypass audit; validate supplied fixture values, including versions and owners where callers can override them. Reuse the same applicable validators in normal test helpers.

Load related records in the same transaction as a catalog write. Walk the proposed taxonomy parent chain with a visited set, rejecting self-reference and repeated ancestors without hanging on an already malformed graph. Reuse that check for supported term writes/loaders without adding an editing API. Alias validation must verify that a referenced Edition belongs to the supplied Event. The validated loader boundary must require an active transaction where relation reads are needed.

For ingestion, keep `startIngestionRun` and `finalizeIngestionRun` as the only supported persistence operations. Start validates its input and uses the validated mode for both the scalar column and serialized input; fixed SQL creates the running state with final fields absent. Finalize already validates report identity, accounting numbers, and completion, derives the status, and supplies all final fields together. Fill only demonstrated gaps. Retain the conditional `WHERE id=? AND status='running' AND mode=?` update and affected-row check as the atomic transition guard. Do not read back the running row, introduce a complete-row lifecycle schema, or add a transaction solely to duplicate guarantees provided by these operations. Research remains outside database transactions and caller-owned research transactions remain rejected.

Extend existing validator, writer, fixture, run-persistence, and migration test suites. Reuse existing coverage when it already proves a guarantee; add cases for missing behavior, rather than one new test for every removed SQL expression. Keep populated-upgrade and retained-integrity coverage complete.

### 3. Record the policy in AGENTS.md and ADR 001

Add a short repository-wide database section to `AGENTS.md` during implementation, linking ADR 001 and the storage-integrity spec. A separate opt-in skill would be easy to miss and duplicates a repository rule.

Proposed instruction text:

> Keep business validation and extensible vocabularies in application code. Do not add SQL CHECK constraints or business-validation triggers. SQLite owns keys, uniqueness, NOT NULL, and the existing audit/URL-alias immutability protections. Reuse operation validators and validate related state within the write transaction; fixture loaders and normal test helpers must use applicable shared validation. Prefer existing operation guarantees over duplicate storage-row schemas. Keep schema changes aligned with ADR 001 and the storage-integrity spec.

This is the target policy, not a claim that the current schema already conforms. Update ADR 001 and sync the new spec when implementation is complete. Keep existing implemented behavioral requirements intact.

## Risks / Trade-offs

- Direct SQL can store invalid domain values → document the bypass; tests deliberately distinguish raw database acceptance from supported application rejection.
- Removing a check without an application guarantee weakens supported writes → account for each removed rule using existing input validation, construction guarantees, or a small missing check; reuse or extend behavioral tests before changing the schema.
- Relation validation can race if performed outside a transaction → read and validate related state in the write transaction; keep atomic conditional ingestion updates.
- SQLite table rebuilds can remove triggers/indexes or damage references → review generated SQL and test populated upgrade, fresh initialization, and repeated migration, including all four retained triggers and foreign-key checks.
- Existing records can contain historical JSON contracts → copy stored values unchanged; do not revalidate or rewrite historical audit, receipt, or ingestion payloads during migration.

## Migration Plan

1. Add missing checks to existing validation boundaries, preserving guarantees already provided by operation construction before removing database rules.
2. Remove the declarations producing all 20 CHECK constraints from Drizzle and generate a forward migration/snapshot. Drop only the taxonomy-cycle and alias-ownership validation triggers; recreate the four retained immutability triggers if affected tables are rebuilt. Keep prior migrations unchanged.
3. Preserve all rows, identities, relationships, versions, defaults, indexes, keys, and serialized history byte-for-byte. Test both populated upgrade and fresh initialization through the supported migrator.
4. Update boundary tests to prove raw SQL no longer enforces removed rules while application calls still reject them. Verify retained relational and immutability protections, replay safety, and ingestion finalization behavior.
5. Update ADR 001, `AGENTS.md`, docs navigation, and the owning spec at completion. Run focused tests, type checking, OpenSpec validation, and documentation checks.

Apply the migration with the matching application version. There is no production deployment; recovery for a failed local upgrade uses a pre-migration backup and the matching prior checkout, rather than adding a reverse migration or compatibility layer.
