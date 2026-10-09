---
type: Reference
title: Eventroam project structure
description: Current application directories, dependency boundaries, and planned extensions.
status: stable
tags: [architecture]
---

# Eventroam project structure

Status: Implemented core structure · Updated: 2026-10-08

Eventroam is one npm package. The public Next.js application reads the SQLite catalog; TypeScript commands run migrations and development fixtures outside Next.js. Catalog writes use a separate validated writer. A local Mastra research agent proposes catalog changes through a compact operation adapter and the same writer.

```text
Commands → research workflow → catalog writer → SQLite ← Next.js public reads
```

## Current directories

```text
src/
├── app/                       # Next.js routes and page composition
│   ├── api/discovery/         # Public summary and Occurrence detail endpoints
│   └── events/[slug]/         # Event and Occurrence pages
├── features/
│   ├── discovery/             # Discovery UI, filtering model, hooks, and map
│   │   ├── components/        # Filters, results, selected preview
│   │   ├── hooks/             # URL state
│   │   ├── map/               # Mapbox adapter
│   │   └── model/             # Pure filtering and ordering
│   └── event-details/         # Event and Occurrence presentation
├── components/
│   ├── catalog/               # Shared dates, location, status, and price views
│   └── site/                  # Shared site header
├── catalog/
│   ├── domain/                # Pure business rules
│   ├── operations/            # Validated mutation contracts
│   ├── read/                  # Public queries and browser-safe DTO contracts
│   └── write/                 # Transactions, publication, audit
├── site/
│   └── server/                # Request adapters; site.ts holds scope and URL rules
├── ingestion/                 # Research agent, operation adapter, sources, runtime limits
│   └── evals/                 # Captured website cases, Mastra runner and code scorers
├── db/                        # Schema, connections, and SQL migrations
└── test/                      # Temporary databases and data builders

commands/                     # Catalog research CLI, migrations, development fixtures
openspec/specs/               # Implemented behavior, grouped by catalog/ and website/
openspec/changes/             # Approved future work; delta specs use matching domain paths
docs/                         # Decisions and development guidance
data/                         # Ignored local database and runtime data
```

Create additional folders when code needs them. Unit and integration tests live beside their implementation. Keep feature-specific components in their feature until they have a concrete shared role. Shared components receive props and do not load data.

## Boundaries

- **Routes and presentation:** `app → features → components`. Routes resolve request parameters and site context, load public data, and compose features. Shared components do not import features.
- **Public reads:** `app/site server → catalog/read → db`. Queries enforce publication rules and load composite responses in short read transactions. Web requests open existing SQLite databases read-only. Browser code imports public contracts and pure rules, never database queries or row types.
- **Catalog writes:** `commands → catalog/write → db`. The writer validates operations and applies versions, publication changes, audit records, and operation receipts in transactions. Collection uses grouped operations with rollback-based dry-run, versions, and atomic item commits.
- **Collection:** `commands → ingestion → catalog/read (private context), catalog/write`. Source adapters and OpenRouter remain outside Next.js. The research agent has read/search tools only; the model interprets sources and selects identity; the adapter checks the candidate schema and requested targets, then passes model-selected facts to the writer for atomic apply. Private reports persist in `ingestion_runs`, with optional JSON file export; SQLite also stores catalog facts, public links, classifications, URL aliases, audit changes, and operation receipts.
- **Pure logic:** `catalog/domain`, `catalog/operations`, and `features/discovery/model` have no React, Next.js, or storage dependency.

ESLint enforces these import boundaries. The writer runs without Next.js. Avoid exports that mix browser-safe contracts with server query implementations.

Within ingestion, `workflow.ts` coordinates context loading, research, candidate preparation, catalog writes, and reporting. `research/context.ts` loads the private catalog context; `research/agent.ts` owns the prompt, model execution, provider diagnostics, and model usage. `sources/session.ts` owns per-run read/search history, caching, and navigation depth, sharing the same budget with the agent. `research/contracts.ts` defines the strict result envelope and explained typed facts; `research/prepare.ts` enforces create-only add, grouped-field conversion, complete ticket replacement, and owner/kind link-slot replacement. It keeps explanation mappings separate from write payloads. `report.ts` joins explanations to actual writer changes and assembles research status, catalog outcome, errors/questions, source summaries, retrieval history, and combined usage. Reasons, source summaries, and name-mismatch metadata remain private and do not extend database audit storage. `runs.ts` owns allowlisted invocation storage and guarded start/final writes, outside catalog item transactions, so preview rollback preserves history. Interrupted/finalization-failed attempts remain running with unknown completion; reruns create new rows. The private run table has nullable Event association and scalar usage/cost/duration projections; migrate before research. `runtime/run-trace.ts` observes the per-Event apply lifecycle; `runtime/trace-projections.ts` builds bounded labels and diagnostics, and `runtime/tracing.ts` owns mandatory export sanitization and separate trace storage. Dry-run and injected generators bypass tracing. Shared workflow types live in `contracts.ts` and remain re-exported from the entry point.

Discovery loads complete public summaries for the active scope and applies the same filtering rules on direct server entry and in the browser. The map displays the coordinate-bearing subset of list results; moving the map does not fetch or filter inventory. Full details load on selection. See the [discovery contract](../openspec/specs/website/discovery/spec.md) and [catalog records](../openspec/specs/catalog/records/spec.md).

## Routes and scope

The application currently has a root page, Event and Occurrence pages, and two discovery API routes. The root renders an apex directory or Festivals discovery according to the allowed host. Unknown hosts do not expose a default catalog. Detail requests resolve public identity and canonical hosts through `site/server` and `catalog/read`. The [scoped website specification](../openspec/specs/website/routing/spec.md) owns implemented routing behavior; [public site launch](../openspec/changes/public-site-launch/proposal.md) tracks approved metadata work.

About and privacy pages, dedicated error pages, robots and sitemap routes, and complete SEO metadata remain future work. Add their files when the behavior is implemented; do not publish placeholder routes.

## Database operations

Run `npm run db:migrate` for reviewed SQL migrations and `npm run db:fixtures` for repeatable fictional development data. Both enter through `commands/catalog-db.ts`. See the [development guide](development.md) for checks and local setup.

Release the web application, writer, and schema as one compatible version. For a schema change, stop web and writer processes, back up the database, apply the migration, and start the matching version. Keep SQLite transactions short and verify WAL file permissions for reader access. A read-only SQLite connection does not guarantee that a read-only volume mount works in every WAL lifecycle state. Follow the [SQLite decision](decisions/001-sqlite-and-drizzle.md) for backup and restoration requirements.

## Future additions

Add `src/components/ui/` for common React primitives, and `src/shared/` for small domain-independent utilities. Add more local event-detail components as their roles become concrete.

Open-view freshness and concrete release compatibility checks remain undecided. Collection uses the local TypeScript CLI; server execution and scheduling remain deferred. Production packaging and Docker Compose commands also remain to be implemented. The deployment direction is a single release image containing the Next.js server, separately runnable commands, SQL migrations, and their runtime dependencies; the implementation must verify that each is packaged.
