# Eventroam project structure proposal

Status: Proposed · Date: 2026-10-02

One repository, a public Next.js application, and a separate update process sharing local SQLite on the same server. Updates run outside Next.js. The collection language is undecided; Node.js is likely.

Propose one npm package for the web and a TypeScript catalog writer. Node.js collection can call the writer directly; another language can submit JSON operations through a local CLI. This preserves one implementation of validation, publication, versions, idempotency, and audit. The TypeScript writer remains a proposed choice.

```text
Collection → catalog writer → SQLite ← Next.js public reads
```

## Project structure

```text
src/
├── app/                       # Routes and page composition; detailed below
├── features/
│   ├── discovery/
│   │   ├── discovery.tsx
│   │   ├── model/             # Pure filtering, ordering, URL serialization
│   │   ├── components/        # Filters, results, selected preview
│   │   ├── hooks/             # Browser state and requests
│   │   └── map/               # Mapbox adapter
│   └── event-details/
│       ├── event-page.tsx
│       ├── occurrence-page.tsx
│       └── components/        # Edition history and detail sections
├── components/
│   ├── ui/                    # Button, Input, Dialog, Badge
│   ├── catalog/               # Dates, location, status, ticket price
│   └── site/                  # Header, footer, scope navigation
├── catalog/
│   ├── domain/                # Pure types and business rules
│   ├── operations/            # Mutation input and result schemas
│   ├── read/                  # Public queries and browser-safe DTO contracts
│   └── write/                 # Transactions, publication, audit, run records
├── site/                      # Scopes, canonical URLs, metadata
│   └── server/                # Next.js request adapters
├── db/                        # Schema, reader/writer connections, migrations
├── shared/                    # Small non-React, domain-independent utilities
└── test/                      # Temporary databases and data builders

commands/                     # Apply operation, migrate, development fixtures
ingestion/                    # Collection workflows and adapters; language TBD
tests/e2e/                    # Browser journeys
specs/                        # Product and domain contracts
docs/                         # Decisions and development guidance
data/                         # Ignored local database and runtime data
```

Create folders as code appears. Unit and integration tests stay beside their implementation. Keep feature-specific components local; promote them when they have a concrete shared role. Shared components receive props and do not load data. `components/ui` is the sole home for common React primitives.

## Next.js routes

```text
src/app/
├── layout.tsx                     # HTML and shared shell
├── globals.css
├── icon.svg
├── page.tsx                       # Apex directory or scope discovery
├── not-found.tsx
├── error.tsx
├── global-error.tsx
├── about/page.tsx
├── privacy/page.tsx
├── events/
│   ├── not-found.tsx
│   └── [slug]/
│       ├── page.tsx               # Event
│       └── [key]/page.tsx         # Occurrence
├── api/discovery/
│   ├── route.ts                   # GET all public scope summaries
│   └── [id]/route.ts              # GET public Occurrence details
├── robots.ts
└── sitemap.ts
```

Pages resolve request parameters and site context, call public reads, handle redirects or missing records, and compose features. Endpoints return the same public data as JSON. Server pages call read functions directly.

An allowed host selects the apex or scope; unknown hosts do not expose a default catalog. Route groups are unnecessary for this arrangement and do not dispatch by hostname. About/privacy live on the apex; redirecting their scope-host equivalents is proposed. Detail routes resolve public identity before redirecting to its canonical host. Metadata and sitemaps use configured origins and the same visibility rules. [Routing specification](../specs/005-website-structure-and-urls.md)

## Boundaries and data flow

- **Domain and discovery model:** pure TypeScript, shared by server and browser where needed; no React, storage, or network dependencies.
- **Presentation:** `app → features → components`; common components do not import features. Browser imports from the catalog are limited to public contracts and pure rules. Keep database row types internal.
- **Reads:** `app/site server → catalog/read → db`. Enforce publication at the query boundary and load composite responses in short read transactions. Web connections are read-only.
- **Writes:** `commands/ingestion → catalog/write → db`. Fetch sources before the transaction. Apply accepted changes, versions, evidence, audit, and operation receipts atomically. Collection never bypasses the writer with catalog SQL. Internal draft/history access stays behind its operational interface.
- **Enforcement:** lint import boundaries prevent web imports of writer/ingestion and browser imports of storage. Writer code runs without Next.js. Avoid exports that mix public contracts with server implementations.

Discovery receives complete public summaries for the active scope and uses identical filtering rules in SSR and the browser. The map displays the coordinate-bearing subset of list results; movement does not fetch or filter inventory. Details load on selection. [Discovery contract](../specs/004-discovery-filters.md)

Existing rules for operation replay, stale versions, source conflicts, missing values, dry runs, and multi-subject changes remain authoritative. [Domain model](../specs/001-domain-model.md)

## Operation and migration

Release web, writer, and schema as one compatible version, with independent process startup and explicit migrations. Web downtime is acceptable during a schema change: stop the web and writer, back up the database, apply the migration, then start the matching version of both processes. Keep SQLite transactions short, handle bounded writer contention, and verify WAL file permissions for reader access. Read-only connections do not imply that a read-only volume mount will work in every WAL lifecycle state. Follow the existing backup and restoration requirements. [Database decision](decisions/001-sqlite-and-drizzle.md), [SQLite WAL](https://www.sqlite.org/wal.html)

For Docker deployment, propose one immutable image per release with the Next.js server, separately built Node.js commands, SQL migrations, and their runtime dependencies. Compose runs that image as a persistent web service and as one-off operational jobs against the same local database volume. Package commands and migrations explicitly; do not assume the Next.js server bundle includes them. Only restart the web with the new image after its migration succeeds. The exact Dockerfile, Compose commands, and collection-process packaging belong to implementation.

Initially read current committed data on new web requests and generate host-specific sitemaps dynamically. Avoid persistent catalog caches until an invalidation policy exists. Refreshing an already-open discovery view is a separate decision.

Migrate incrementally: split `application/catalog.ts` into operations, domain, and writer; move public queries into `catalog/read`; move discovery into its feature; extract shared components; thin route files; enforce boundaries. Retire old `application/`, `domain/`, and command locations after callers move. Preserve behavior and existing tests, and validate reader/writer concurrency and public visibility during implementation.

Still to decide: collection language and TypeScript writer confirmation; CLI protocol and errors; open-view freshness; concrete schema compatibility checks. This document proposes structure; implementation remains separate.
