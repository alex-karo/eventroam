---
type: Reference
title: Eventroam project structure
description: Current application directories, dependency boundaries, and planned extensions.
status: stable
tags: [architecture]
---

# Eventroam project structure

Status: Implemented core structure · Updated: 2026-10-26

Eventroam is one npm package. The public Next.js application reads the SQLite catalog; TypeScript commands run migrations and development fixtures outside Next.js. Catalog writes use a separate validated writer. An owner-initiated Mastra research agent collects findings; a tool-free editor chooses non-location actions. A bounded Location agent resolves place fields before the same writer.

```text
Commands → research → editor → initial geocoding → Location → typed adapter → catalog writer → SQLite ← Next.js public reads
```

## Current directories

```text
src/
├── app/                       # Next.js routes and page composition
│   ├── api/discovery/         # Public summary and Edition detail endpoints
│   └── events/[slug]/         # Event and Edition pages
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
│   └── server/                # Request adapters; site.ts holds scope and URL rules
├── ingestion/                 # Research/editor/Location agents, typed adapter, sources and limits
│   ├── research/
│   │   ├── agent/             # Agent implementation and adjacent tests
│   │   │   ├── index.ts       # Model execution, step policy, callbacks and cleanup
│   │   │   ├── usage.ts       # Provider usage projection and accumulation
│   │   │   ├── prompt.ts      # Fixed model instructions
│   │   │   ├── input.ts       # JSON input, saved context and source projections
│   │   │   └── wire.ts        # Provider schema and optional-null compatibility
│   │   ├── context.ts         # Private read context
│   │   ├── contracts.ts       # Strict research candidate contracts
│   │   └── money.ts           # Currency precision conversions
│   ├── location/              # Place contracts, input, preparation, agent and point checks
│   ├── editor/                # Typed plans, tool-free agent and operation conversion
│   ├── tools/                 # Read/search capabilities and Mastra adapters
│   │   ├── read-page/       # Tool, reader, extraction, fallback and contracts
│   │   ├── search-web/  # Tool, search provider and contracts
│   │   ├── session.ts         # Shared run budget, cache and read history
│   │   ├── network.ts         # Safe bounded HTTP transport
│   │   ├── contracts.ts       # Shared schemas and execution context
│   │   └── index.ts           # Tool composition
│   └── evals/                 # Captured website cases, Mastra runner and code scorers
├── mastra/                    # Studio workflow, production server, and observability registration
├── db/                        # Schema, connections, and SQL migrations
└── test/                      # Temporary databases and data builders

commands/                     # Catalog research CLI, migrations, development fixtures
public/                       # Local website assets, catalog preview, and licensed fonts
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
- **Collection:** `commands → ingestion → catalog/read (private context), catalog/write`. Source adapters and OpenRouter remain outside Next.js. The research agent has only read/search tools; the model interprets sources and selects identity; research validation checks findings and targets; the editor compares supplied evidence with saved state, then the adapter passes explicit actions to the writer for atomic apply. Private reports persist in `ingestion_runs`, with optional JSON file export; SQLite also stores catalog facts, public links, classifications, URL aliases, audit changes, and operation receipts.
- **Pure logic:** `catalog/domain`, `catalog/operations`, and `features/discovery/model` have no React, Next.js, or storage dependency.

ESLint enforces these import boundaries. The writer runs without Next.js. Avoid exports that mix browser-safe contracts with server query implementations.

## Ingestion ownership

Follow a refresh through `workflow.ts` → `research/agent/index.ts` → `editor/agent.ts` → `location/agent.ts` → `editor/prepare.ts` → catalog writer → `report.ts`. Use `attempt.ts` for terminal persistence and cleanup. The [ingestion guide](ingestion-process.md#workflow-steps) explains the eleven steps and their observable behavior.

- `workflow.ts` owns the shared CLI/Studio graph, native serializable state, step results and engine-run-to-attempt lookup. `attempt.ts` owns runtime resources, a memoized finalization promise and idempotent cleanup. Terminal hooks recover paths that bypass the final step without retrying final persistence.
- `research/context.ts` builds private catalog context and owns its inferred type. `research/agent/index.ts` owns model execution, iteration/deadline policy, retries and cleanup. Adjacent `prompt.ts`, `input.ts` and `wire.ts` own fixed instructions, input/saved-price projection and provider-schema/null adaptation. `runtime/model-errors.ts` classifies host/provider failures and selects safe diagnostics.
- `research/context.ts` loads the catalog snapshot and one frozen currentDate; model rules live in `research/agent/prompt.ts`. Scope comes from the invocation input. `research/guards.ts` checks simple scope bounds and countries directly from saved Editions, including the baseline reread inside atomic apply. No separate refresh context or field registry is maintained. Returned facts stay in the raw model response; actual mutations use the existing writer audit.
- `tools/index.ts` composes read/search capabilities. Each tool directory keeps its adapter, implementation, contracts and observations together. `tools/session.ts` owns shared budgets, caching and read history; `tools/network.ts` provides bounded safe HTTP. Initial reads and eval fixtures reuse the session. `tools/read-page/response.ts` projects source text for the tool and initial prompt.
- `editor/prepare.ts` checks findings/plan targets, converts typed actions and prices into operations and proposes eligible publication. The catalog writer validates the resulting committed records. `report.ts` combines three agent outputs, actual changes and budget counters. `runs.ts` persists durable start/final records outside catalog item transactions, so previews retain history.
- `evals/score.ts` aggregates mutation, research and tool-use scores, with a separate host-failure veto and execution diagnostics. `evals/research-score.ts` owns research outcome, fact and expected-safe-failure checks. Mutation scores measure only mutation assertions. `evals/run.ts` passes inline cases to Mastra `runExperiment`. Each task owns a temporary catalog and returns one score with its ingestion result and tool calls. Mastra collects task outputs and scorer results in input order. `evals/scorers.ts`, JSON reports and CLI diagnostics consume the score without rerunning checks. Experiment execution status is separate from case acceptance in `score.passed`.
- `runtime/logging/` uses Mastra PinoLogger methods and scoped context. Producers select plain fields and explicitly shorten model text. A small delivery bridge preserves child context and run/trace/span correlation in Studio.
- `runtime/tracing/run.ts` observes apply attempts through explicit host fields and a narrow SDK-content exclusion. `runtime/observability/` owns DuckDB storage, optional signals, diagnostics and cleanup. Its exporter forwards native metric events without a separate application projection; the span processor preserves the usage/cost fields needed for native extraction and the SDK propagates execution context. Only eligible traced runs persist metrics. Native agent/model/tool metrics own operation timing; application logs keep timestamped events without duplicate timers. Durable usage/report accounting and budget counters remain independent. Studio lends its initialized store to attempts; attempt cleanup leaves that shared store open.
- `src/mastra/index.ts` registers Studio's workflow. Studio opens an existing migrated catalog lazily and closes its owned connection. CLI callers retain injected dependencies and connection ownership. Workflow data contains inspectable research results, while credentials, prompts, provider transport payloads and live resources remain outside it.

## Discovery

Discovery loads complete public summaries for the active scope and applies the same filtering rules on direct server entry and in the browser. The map displays the coordinate-bearing subset of list results; moving the map does not fetch or filter inventory. Full details load on selection. See the [discovery contract](../openspec/specs/website/discovery/spec.md) and [catalog records](../openspec/specs/catalog/records/spec.md).

## Routes and scope

The Edition page owns the full festival view in one column. Its location map owns one saved point, a precision-based initial zoom, and map loading errors. It uses the same Mapbox token and style as discovery. The Event page contains only its name, optional summary, navigation, and public history. Both pages use the shared `EditionHistory` component. Shared catalog views own price units, historical labels, fact icons, external link names, and native link titles. See the [festival detail contract](../openspec/specs/website/festival-details/spec.md).

`site/discovery-context.ts` stores one visit snapshot in session storage. It contains the root filter URL, camera, list scroll, selected ID, and card expansion state. History state and detail URLs carry only its opaque token. `Discovery` saves and restores this context for browser Back and Back to results. It reloads selected details and removes an ineligible selection. The discovery map restores the camera before its first fit and uses the rendered card bounds to keep the selected point visible. Direct details without a matching token return to default discovery.

The application currently has a root page, Event and Edition pages, and two discovery API routes. The root renders the project presentation or Festivals discovery according to the allowed host. The apex has three sections: system introduction, festival example, and services with a direct LinkedIn contact link. Its [presentation spec](../openspec/specs/website/project-presentation/spec.md) defines this content. The apex uses a local preview image, local fonts, and a labeled source-to-record-to-catalog illustration. It does not query the catalog. Unknown hosts do not expose a default catalog. Detail requests resolve public identity and canonical hosts through `site/server` and `catalog/read`. The [scoped website specification](../openspec/specs/website/routing/spec.md) owns implemented routing behavior; [public site launch](../openspec/changes/public-site-launch/proposal.md) tracks approved metadata work.

About and privacy pages, dedicated error pages, robots and sitemap routes, and complete SEO metadata remain future work. Add their files when the behavior is implemented; do not publish placeholder routes.

## Database operations

Run `npm run db:migrate` for reviewed SQL migrations and `npm run db:fixtures` for repeatable fictional development data. Both enter through `commands/catalog-db.ts`. See the [development guide](development.md) for checks and local setup.

Release the web application, writer, and schema as one compatible version. For a schema change, stop web and writer processes, retain a compatible closed data copy if rollback is needed, apply the migration, and start the matching version. Keep SQLite transactions short and verify WAL file permissions for reader access. A read-only SQLite connection does not guarantee that a read-only volume mount works in every WAL lifecycle state. Follow the [SQLite decision](decisions/001-sqlite-and-drizzle.md) for consistent-copy rules and deferred backup work.

## Future additions

Add `src/components/ui/` for common React primitives, and `src/shared/` for small domain-independent utilities. Add more local event-detail components as their roles become concrete.

Open-view freshness and concrete release compatibility checks remain undecided. Collection uses the local TypeScript CLI, loopback Studio, or hosted Studio with external ingress authentication. Scheduling remains deferred. One Dockerfile provides separate web and Studio targets; the Studio image also carries the explicit migration command and SQL files. Both services share one named data volume in application Compose. See [application containers](development.md#application-containers) for commands and inputs. External infrastructure and the public rollout belong in the self-hosted project.

Location owns five place text fields and coordinates. `tools/geocode/` owns the bounded Geoapify adapter, forward tool, Event cache, six-call limit and point map. `location/initial.ts` deduplicates initial forward/reverse requests. `editor/prepare.ts` validates editor actions first, then combines Location actions before operation and publication preparation. `location/donor-guard.ts` rechecks inherited donor versions and points inside the existing writer transaction. No agent sends messages to another agent.
