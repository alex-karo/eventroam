# Eventroam project structure

Status: Implemented core structure · Updated: 2026-10-02

Eventroam is one npm package. The public Next.js application reads the SQLite catalog; TypeScript commands run migrations and development fixtures outside Next.js. Catalog writes use a separate validated writer. Collection workflows and their interface to that writer have not been implemented.

```text
Commands → catalog writer → SQLite ← Next.js public reads
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
├── db/                        # Schema, connections, and SQL migrations
└── test/                      # Temporary databases and data builders

commands/                     # Database migration and development fixtures
specs/                        # Product and domain contracts
docs/                         # Decisions and development guidance
data/                         # Ignored local database and runtime data
```

Create additional folders when code needs them. Unit and integration tests live beside their implementation. Keep feature-specific components in their feature until they have a concrete shared role. Shared components receive props and do not load data.

## Boundaries

- **Routes and presentation:** `app → features → components`. Routes resolve request parameters and site context, load public data, and compose features. Shared components do not import features.
- **Public reads:** `app/site server → catalog/read → db`. Queries enforce publication rules and load composite responses in short read transactions. Web requests open existing SQLite databases read-only. Browser code imports public contracts and pure rules, never database queries or row types.
- **Catalog writes:** `commands → catalog/write → db`. The writer validates operations and applies versions, publication changes, audit records, and operation receipts in transactions. Collection code must use this writer when it is added.
- **Pure logic:** `catalog/domain`, `catalog/operations`, and `features/discovery/model` have no React, Next.js, or storage dependency.

ESLint enforces these import boundaries. The writer runs without Next.js. Avoid exports that mix browser-safe contracts with server query implementations.

Discovery loads complete public summaries for the active scope and applies the same filtering rules on direct server entry and in the browser. The map displays the coordinate-bearing subset of list results; moving the map does not fetch or filter inventory. Full details load on selection. See the [discovery contract](../specs/004-discovery-filters.md) and [domain model](../specs/001-domain-model.md).

## Routes and scope

The application currently has a root page, Event and Occurrence pages, and two discovery API routes. The root renders an apex directory or Festivals discovery according to the allowed host. Unknown hosts do not expose a default catalog. Detail requests resolve public identity and canonical hosts through `site/server` and `catalog/read`. The [website structure and URL specification](../specs/005-website-structure-and-urls.md) owns the full routing and indexing rules.

About and privacy pages, dedicated error pages, robots and sitemap routes, and complete SEO metadata remain future work. Add their files when the behavior is implemented; do not publish placeholder routes.

## Database operations

Run `npm run db:migrate` for reviewed SQL migrations and `npm run db:fixtures` for repeatable fictional development data. Both enter through `commands/catalog-db.ts`. See the [development guide](development.md) for checks and local setup.

Release the web application, writer, and schema as one compatible version. For a schema change, stop web and writer processes, back up the database, apply the migration, and start the matching version. Keep SQLite transactions short and verify WAL file permissions for reader access. A read-only SQLite connection does not guarantee that a read-only volume mount works in every WAL lifecycle state. Follow the [SQLite decision](decisions/001-sqlite-and-drizzle.md) for backup and restoration requirements.

## Future additions

Add `ingestion/` when collection workflows exist, `tests/e2e/` when browser journeys are implemented, `src/components/ui/` for common React primitives, and `src/shared/` for small domain-independent utilities. Add more local event-detail components as their roles become concrete.

The collection language, operation transport or CLI protocol, open-view freshness, and concrete schema compatibility checks remain undecided. Production packaging and Docker Compose commands also remain to be implemented. The deployment direction is a single release image containing the Next.js server, separately runnable commands, SQL migrations, and their runtime dependencies; the implementation must verify that each is packaged.
