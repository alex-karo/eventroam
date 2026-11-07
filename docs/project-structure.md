---
type: Reference
title: Eventroam project structure
description: Current application directories and dependency boundaries.
status: stable
tags: [architecture]
---

# Eventroam project structure

Eventroam is one package. The public Next.js application reads the SQLite catalog. Catalog updates use a separate writer. See the [README](../README.md#architecture) for the application overview and the [ingestion process](ingestion-process.md#workflow-steps) for the research and review stages.

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
│   ├── research/              # Saved context and shared field contracts
│   ├── evidence/              # Private sources, Reader and frozen evidence
│   ├── roles/                 # Assignments, prompts and role calls
│   ├── proposals.ts           # Proposal assembly and Editor decisions
│   ├── catalog-plan.ts        # Operation preparation
│   ├── location/              # Place decisions and point validation
│   ├── tools/                 # Source reading, search and geocoding
│   ├── evals/                 # Fixed cases, evaluators and experiment runner
│   ├── jobs/                  # Durable queue operations
│   └── runtime/               # Model setup, workflow storage and observability
├── mastra/                    # Studio registration and production server
│   ├── catalog-assistant/     # Catalog chat, job control, memory and SQL skill
│   └── catalog-researcher/    # Discovery and add submission
├── db/                        # Schema, connections, and SQL migrations
└── test/                      # Temporary databases and data builders

commands/                     # Catalog research CLI, migrations, development fixtures
public/                       # Local website assets, catalog preview, and licensed fonts
openspec/specs/               # Implemented behavior, grouped by catalog/, website/ and operations/
openspec/changes/             # Approved future work; delta specs use matching domain paths
docs/                         # Project documentation
data/                         # Ignored local database and runtime data
```

Create additional folders when code needs them. Unit and integration tests live beside their implementation. Keep feature-specific components in their feature until they have a concrete shared role. Shared components receive props and do not load data.

## Boundaries

- **Routes and presentation:** `app → features → components`. Routes resolve request parameters and site context, load public data, and compose features. Shared components do not import features.
- **Public reads:** `app/site server → catalog/read → db`. Queries enforce publication rules and load composite responses in short read transactions. Web requests open existing SQLite databases read-only. Browser code imports public contracts and pure rules, never database queries or row types.
- **Catalog writes:** `commands → catalog/write → db`. The writer validates operations and applies versions, publication changes, audit records, and operation receipts in transactions. Collection uses grouped operations with rollback-based dry-run, versions, and atomic item commits.
- **Collection:** `catalog CLI → Studio API → ingestion → catalog/read (private context), catalog/write`. Source adapters and model calls stay outside Next.js. Ingestion prepares operations and sends them to the catalog writer. See the [ingestion workflow](../openspec/specs/catalog/ingestion-workflow/spec.md) for the evidence and review rules.
- **Pure logic:** `catalog/domain`, `catalog/operations`, and `features/discovery/model` have no React, Next.js, or storage dependency.

ESLint enforces these import boundaries. The writer runs without Next.js. Avoid exports that mix browser-safe contracts with server query implementations.

## Ingestion ownership

Edition validation uses three inputs as data moves through the pipeline.

| Input | Owner and decision |
| --- | --- |
| Proposed term IDs | [Proposal preparation](../src/ingestion/proposals.ts) checks evidence and reuse. [Classification rules](../src/catalog/domain/classification.ts) validate the selection and remove redundant ancestors before Editor review. |
| Saved Edition with proposed changes | The [catalog planner](../src/ingestion/catalog-plan.ts) uses the [festival publication policy](../src/catalog/domain/festival-edition-publication.ts) to decide whether to add a publish operation. [Edition rules](../src/catalog/domain/edition-rules.ts) apply common record checks and the selected policy. |
| Stored Edition or proposed replacement terms | The [writer](../src/catalog/write/apply-operation.ts) checks the affected rules inside the transaction. A direct assignment with a redundant ancestor fails. |

Paths below are relative to `src/ingestion/` unless stated otherwise. Read code for internal algorithms and current limits.

| Area                                                           | Owner                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| Workflow and terminal cleanup                                  | `workflow.ts`, `attempt.ts`                           |
| Stage results and write outcomes                               | `stage.ts`, `pipeline.ts`                            |
| Saved context and shared field contracts                       | `research/context.ts`, `research/contracts.ts`        |
| Assignments and agent calls                                    | `roles/`                                              |
| Saved sources, Reader and frozen corpus                        | `evidence/`                                           |
| Scope and country checks                                       | `research/guards.ts`                                  |
| Source tools, shared budgets and network access                | `tools/`                                              |
| Proposal assembly and Editor decisions                         | `proposals.ts`                                        |
| Writer-operation preparation                                   | `catalog-plan.ts`                                     |
| Place fields, coordinate selection and earlier-point checks    | `location/`, `tools/geocode/`                         |
| Background job submission, cancellation and execution          | `jobs/`; `src/mastra/jobs.ts` owns server execution   |
| Private reports and durable attempts                           | `report.ts`, `runs.ts`                                |
| Evals and experiment results                                   | `evals/`; see [Ingestion evals](ingestion-evals.md)   |
| Workflow storage, logging and tracing                          | `runtime/`; see [Ingestion tools](ingestion-tools.md) |
| Studio workflow registration                                   | `src/mastra/index.ts`                                 |
| Studio chat, SQL and job tools, memory and schema guidance | `src/mastra/catalog-assistant/`                       |

Each preparation function returns `continue`, `skip`, or `reject`. Only `continue` carries input for the next stage: `PreparedProposals` → `AcceptedProposals` → `ReadyCatalogPlan`. Research and Editor results have no writer operations. Workflow state retains each stage result for inspection. The workflow uses those results to choose its next action and sets an explicit outcome. Reports project that outcome, stage diagnostics, and writer receipts; error codes do not control the report outcome.

`CatalogAttempt` owns failure finalization, active-work settlement, terminal persistence, and resource cleanup. Cancellation and workflow-history errors use this same owner. Terminal persistence and cleanup each run once. Shared Studio resources remain with Studio.

Studio owns the catalog connection and storage providers for direct runs and manages its queue connection. See [Background execution](ingestion-tools.md#background-execution) for job state, attempt links, and restart behavior. See [Infrastructure](infrastructure.md) for storage operations.

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

`commands/catalog-db.ts` runs reviewed migrations and fictional development fixtures. Release the application, writer, and schema as one compatible version. See [Infrastructure](infrastructure.md) for migration and transfer procedures. See [storage integrity](../openspec/specs/operations/storage-integrity/spec.md) for validation and database rules.

## Future additions

Add common UI primitives or utilities only when code needs them. Do not publish placeholder routes. Read [remaining release decisions](proposals/release-open-decisions.md) for unresolved choices.
