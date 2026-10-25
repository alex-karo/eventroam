---
type: Decision
title: "ADR 001: SQLite and Drizzle"
description: Accepted storage and migration decision for the catalog service.
status: stable
tags: [database, architecture]
---

# ADR 001: SQLite and Drizzle

Status: Accepted  
Date: 2026-10-01

Implementation update (2026-10-15): All value and business-relationship validation now belongs to application code. SQLite retains keys, uniqueness, NOT NULL, and four audit/URL-alias immutability triggers. See [storage integrity](../../openspec/specs/operations/storage-integrity/spec.md).

Implementation update (2026-10-07): Business validation now lives in shared catalog domain validators; SQLite retains structural constraints and immutable history.

Implementation update (2026-10-05): The catalog workflow keeps immutable audit changes without per-change evidence. That source-storage simplification was later superseded by private ingestion-run history in the catalog database.

## Context

Eventroam's first release is one deployable application with a relational catalog, immutable field-change history, and manually initiated ingestion. Public reads may be concurrent, but catalog writes are owner initiated and can be kept short. The application is not scaffolded yet, so the database can be selected without a data migration. PostgreSQL would add a server to operate before a requirement calls for one.

## Decision

- Use **SQLite** as the primary database for the first release, stored in a persistent local Docker volume shared by the application and its manually invoked jobs on one host. Do not put the live database on a network filesystem or run application replicas on different hosts against the same file.
- Keep **Drizzle ORM** for TypeScript schema definitions and typed queries. Use **Drizzle Kit** to generate explicit, version-controlled SQLite migrations; review them before applying them. Run migrations as a separate, repeatable step.
- Store canonical catalog fields in typed relational columns. Keep primary/foreign keys, uniqueness, `NOT NULL`, defaults, query indexes, and the four triggers protecting audit and URL-alias immutability in SQLite. Enable and verify foreign-key enforcement on every connection. Store bounded, validated audit payloads as structured JSON only where their shape varies; do not replace canonical tables with JSON documents.
- Keep all value and business-relationship rules in application code: extensible vocabularies, dates, coordinates, positive size/versions, price-detail shapes, status/field relationships, publication prerequisites, exclusive ownership, alias Edition/Event agreement, and taxonomy ancestry/facet/cardinality rules. Do not add SQL CHECK constraints or business-validation triggers in future schema changes. Reuse existing operation validators and controlled construction of internal versions, owners, and ingestion lifecycle fields; avoid duplicate storage-row schemas. Validate merged domain facts and related state in the catalog write transaction. Development fixtures and normal test helpers must use applicable shared validation; fixtures may still bypass audit. Ingestion retains validated start/finalize operations and its atomic conditional update without validation-only read-back or transactions. Drizzle enum annotations provide TypeScript types, not database enforcement.
- Enable SQLite write-ahead logging for concurrent public reads during writes. Keep write transactions short: fetch and interpret external sources before opening a transaction, then apply catalog changes and their CatalogChange records atomically. Configure a bounded wait for writer contention and report exhausted contention as a retryable failure.
- Store latitude and longitude as ordinary columns. Index the queries required by the chosen map and list filters, including coordinate bounds where needed; this ADR does not select the filter set. Revisit the database choice if real spatial-query needs or multi-host operation emerge.
- Backups and recovery drills are deferred to the next deployment iteration. When implemented, use SQLite's online backup mechanism (or `VACUUM INTO`), keep backups outside the live volume, and test restoration. Consistent-copy rules apply now: stop all users and close/checkpoint the database before replacement. Do not copy only the main database file while it is live in WAL mode.

## Consequences

- Docker Compose needs the application and a named database volume, not a separate database service. The same database and migration path can run locally and in production-like deployment.
- WAL allows readers alongside a writer, but SQLite still permits only one writer at a time. Large imports should commit in bounded batches without exposing partially published records; each catalog mutation and its audit entry remain one transaction.
- The live database belongs to one host. Scaling to multiple hosts or using network-attached storage requires a new database decision and migration plan.
- Direct SQL can bypass application business validation; use the validated writer for catalog mutations and validated loaders for seed data. New vocabulary values require application changes rather than SQLite table rebuilds. Direct SQL also bypasses value ranges, JSON shape, lifecycle and relationship validation; only relational constraints and the retained immutability triggers remain database enforced. SQLite's looser type system makes the supported application write boundaries important. Backups, recovery, disk capacity, and database health remain operational responsibilities.

## Alternatives considered

- **PostgreSQL:** remains a strong option for multi-host access, heavier concurrent writing, and advanced spatial queries, but its separate server adds operational work that the first-release workload does not require.
- **Document and hosted databases:** do not improve the current relational and self-hosted requirements enough to justify their additional model or operational choices.

## Deferred decisions

This ADR does not select the SQLite Node driver or exact runtime version; [ADR 002](002-runtime-and-tooling.md) and `package.json` now record the implemented driver/runtime baseline. Backup schedule and destination, production host, and a future spatial extension remain deferred.
