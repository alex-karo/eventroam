---
type: Reference
title: Eventroam project structure
description: Current application directories, dependency boundaries, and planned extensions.
status: stable
tags: [architecture]
---

# Eventroam project structure

Eventroam is one npm package. The public Next.js application reads the SQLite catalog; TypeScript commands run migrations and development fixtures outside Next.js. Catalog writes use a separate validated writer. An owner-initiated Mastra research agent collects findings; a tool-free editor chooses non-location actions. A bounded Location agent resolves place fields before the same writer.

```text
Commands → research → editor → initial geocoding → Location → typed adapter → catalog writer → SQLite ← Next.js public reads
```

## Current directories

```text
src/
├── app/                       # Next.js routes and page composition
│   ├── api/discovery/         # Public summary and Edition detail endpoints
│   ├── events/[slug]/         # Event and Edition pages
│   ├── robots.ts             # Request-time crawler rules for each host
│   └── sitemap.ts            # Request-time public canonical URLs
├── features/
│   ├── discovery/             # Discovery UI, filtering model, hooks, and map
│   │   ├── components/        # Filters, results, one selected card
│   │   ├── hooks/             # URL state and selected detail requests
│   │   ├── map/               # Mapbox adapter
│   │   └── model/             # Pure filtering and ordering
│   ├── event-details/         # Event history, Edition page, single-point map
│   └── project-presentation/  # Apex system introduction, example, and services
├── components/
│   ├── catalog/               # Facts, icons, ticket views, links, shared history
│   └── site/                  # Shared site header
├── catalog/
│   ├── domain/                # Pure business rules
│   ├── operations/            # Validated mutation contracts
│   ├── read/                  # Public queries and browser-safe DTO contracts
│   └── write/                 # Transactions, publication, audit
├── site/
│   ├── discovery-context.ts   # Tab-local visit snapshots and context tokens
│   └── server/                # Public request adapters and metadata builders
├── ingestion/                 # Research, Editor, Location, sources, evals and runtime
│   ├── research/              # Research context, contracts and agent
│   ├── editor/                # Field decisions and operation preparation
│   ├── location/              # Place decisions and point validation
│   ├── tools/                 # Source reading, search and geocoding
│   ├── evals/                 # Fixed cases, evaluators and experiment runner
│   └── runtime/               # Model setup, workflow storage and observability
├── mastra/                    # Studio registration and production server
│   └── catalog-assistant/     # Chat agent, tools, memory and catalog-sql skill
├── db/                        # Schema, connections, and SQL migrations
└── test/                      # Temporary databases and data builders

commands/                     # Catalog research CLI, migrations, development fixtures
public/                       # Local website assets, catalog preview, and licensed fonts
openspec/specs/               # Implemented behavior, grouped by catalog/, website/ and operations/
openspec/changes/             # Approved future work; delta specs use matching domain paths
docs/                         # Decisions and development guidance
data/                         # Ignored local database and runtime data
```

Create additional folders when code needs them. Unit and integration tests live beside their implementation. Keep feature-specific components in their feature until they have a concrete shared role. Shared components receive props and do not load data.

## Boundaries

- **Routes and presentation:** `app → features → components`. Routes resolve request parameters and site context, load public data, and compose features. Shared components do not import features.
- **Public reads:** `app/site server → catalog/read → db`. Queries enforce publication rules and load composite responses in short read transactions. Web requests open existing SQLite databases read-only. Browser code imports public contracts and pure rules, never database queries or row types.
- **Catalog writes:** `commands → catalog/write → db`. The writer validates operations and applies versions, publication changes, audit records, and operation receipts in transactions. Collection uses grouped operations with rollback-based dry-run, versions, and atomic item commits.
- **Collection:** `commands → ingestion → catalog/read (private context), catalog/write`. Source adapters and OpenRouter remain outside Next.js. The research agent has only read/search tools; the model interprets sources and selects identity; research validation checks findings and targets; the editor compares supplied evidence with saved state, then the adapter passes explicit actions to the writer for atomic apply. Private reports persist in `ingestion_runs`, with optional JSON file export; SQLite also stores catalog facts, public links, classifications, URL aliases, audit changes, and operation receipts.
- **Pure logic:** `catalog/domain`, `catalog/operations`, and `features/discovery/model` have no React, Next.js, or storage dependency.

ESLint enforces these import boundaries. The writer runs without Next.js. Avoid exports that mix browser-safe contracts with server query implementations.

## Ingestion ownership

Follow a refresh through `workflow.ts` → `research/agent/index.ts` → `editor/agent.ts` → `location/agent.ts` → `editor/prepare.ts` → catalog writer → `report.ts`. Use `attempt.ts` for terminal persistence and cleanup. The [ingestion guide](ingestion-process.md#workflow-steps) explains the eleven steps and their observable behavior.

Paths below are relative to `src/ingestion/` unless stated otherwise. Read code for internal algorithms and current limits.

| Area | Owner |
| --- | --- |
| Workflow and terminal cleanup | `workflow.ts`, `attempt.ts` |
| Saved context, research instructions and output | `research/context.ts`, `research/agent/`, `research/contracts.ts` |
| Scope and country checks | `research/guards.ts` |
| Source tools, shared budgets and network access | `tools/` |
| Editor decisions and writer-operation preparation | `editor/` |
| Place fields, coordinate selection and donor checks | `location/`, `tools/geocode/` |
| Private reports and durable attempts | `report.ts`, `runs.ts` |
| Evals and experiment results | `evals/`; see [Ingestion evals](ingestion-evals.md) |
| Workflow storage, logging and tracing | `runtime/`; see [Ingestion tools](ingestion-tools.md) |
| Studio workflow registration | `src/mastra/index.ts` |
| Studio chat, SQL and refresh tools, memory and schema guidance | `src/mastra/catalog-assistant/` |

The writer owns catalog validation and atomic changes. CLI callers own injected connections. Studio owns its catalog connection and storage providers. Saved workflow state excludes live resources and credentials. See the [ingestion process](ingestion-process.md) for behavior and [Infrastructure](infrastructure.md) for storage operations.

## Discovery

Discovery loads complete public summaries for the active scope and applies the same filtering rules on direct server entry and in the browser. The map displays the coordinate-bearing subset of list results; moving the map does not fetch or filter inventory. Full details load on selection. See the [discovery contract](../openspec/specs/website/discovery/spec.md) and [catalog records](../openspec/specs/catalog/records/spec.md).

## Routes and scope

- `app/` composes the apex presentation, Festivals discovery, Event and Edition pages, and crawler routes.
- `site/server/` resolves request sites and public identity. `site.ts` owns configured origins and paths. Unknown hosts do not expose a default catalog.
- `site/discovery-context.ts` and the discovery feature preserve a visit across detail navigation.
- `components/catalog/` owns shared fact, ticket, link and history views.
- `site/server/metadata.ts` and `structured-data.ts` build metadata and optional Event JSON-LD. `app/robots.ts` and `app/sitemap.ts` serve current crawler output.

Behavior belongs in the [routing](../openspec/specs/website/routing/spec.md), [festival detail](../openspec/specs/website/festival-details/spec.md), [project presentation](../openspec/specs/website/project-presentation/spec.md), and [discoverability](../openspec/specs/website/discoverability/spec.md) specs. Use [Testing](testing.md) for built-site HTTP checks.

## Database operations

`commands/catalog-db.ts` runs reviewed migrations and fictional development fixtures. Release the application, writer, and schema as one compatible version. See [Infrastructure](infrastructure.md) for stopped-user migrations, WAL-safe copies, file permissions, transfers, and rollback limits. The [SQLite decision](decisions/001-sqlite-and-drizzle.md) owns the storage rationale.

## Future additions

Add common UI primitives or domain-independent utilities only when code needs them. About, privacy, and dedicated error pages remain future work. Do not publish placeholder routes. Scheduling remains deferred. Read [remaining release decisions](proposals/release-open-decisions.md) for unresolved choices.
