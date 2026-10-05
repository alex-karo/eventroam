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

Implementation update (2026-10-05): The catalog workflow keeps immutable audit changes without per-change evidence. Ingestion run reports stay outside the catalog database.

## Context

Eventroam's first release is one deployable application with a relational catalog, immutable field-change history, and manually initiated ingestion. Public reads may be concurrent, but catalog writes are owner initiated and can be kept short. The application is not scaffolded yet, so the database can be selected without a data migration. PostgreSQL would add a server to operate before a requirement calls for one.

## Decision

- Use **SQLite** as the primary database for the first release, stored in a persistent local Docker volume shared by the application and its manually invoked jobs on one host. Do not put the live database on a network filesystem or run application replicas on different hosts against the same file.
- Keep **Drizzle ORM** for TypeScript schema definitions and typed queries. Use **Drizzle Kit** to generate explicit, version-controlled SQLite migrations; review them before applying them. Run migrations as a separate, repeatable step.
- Store canonical catalog fields in typed relational columns with foreign keys, uniqueness rules, and database checks where supported. Enable and verify foreign-key enforcement on every connection. Store bounded, validated audit payloads as structured JSON only where their shape varies; do not replace canonical tables with JSON documents.
- Enable SQLite write-ahead logging for concurrent public reads during writes. Keep write transactions short: fetch and interpret external sources before opening a transaction, then apply catalog changes and their CatalogChange records atomically. Configure a bounded wait for writer contention and report exhausted contention as a retryable failure.
- Store latitude and longitude as ordinary columns. Index the queries required by the chosen map and list filters, including coordinate bounds where needed; this ADR does not select the filter set. Revisit the database choice if real spatial-query needs or multi-host operation emerge.
- Back up the live database with SQLite's online backup mechanism (or `VACUUM INTO`), store backups separately from the live volume, and test restoration before production use. Do not copy only the main database file while it is live in WAL mode.

## Consequences

- Docker Compose needs the application and a named database volume, not a separate database service. The same database and migration path can run locally and in production-like deployment.
- WAL allows readers alongside a writer, but SQLite still permits only one writer at a time. Large imports should commit in bounded batches without exposing partially published records; each catalog mutation and its audit entry remain one transaction.
- The live database belongs to one host. Scaling to multiple hosts or using network-attached storage requires a new database decision and migration plan.
- SQLite's looser type system makes runtime validation and explicit constraints important. Backups, recovery, disk capacity, and database health remain operational responsibilities.

## Alternatives considered

- **PostgreSQL:** remains a strong option for multi-host access, heavier concurrent writing, and advanced spatial queries, but its separate server adds operational work that the first-release workload does not require.
- **Document and hosted databases:** do not improve the current relational and self-hosted requirements enough to justify their additional model or operational choices.

## Deferred decisions

This ADR does not select the SQLite Node driver, exact SQLite/runtime version, backup schedule or destination, production host, or a future spatial extension. Those choices belong in implementation and operations specs when the application is scaffolded.
