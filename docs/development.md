---
type: Guide
title: Development guide
description: Implementation workflow, application commands, and local development practices.
status: stable
tags: [development]
---

# Development guide

This guide holds implementation and working practices. Implemented behavior belongs in [OpenSpec](../openspec/specs/), approved future work in [active changes](../openspec/changes/), unresolved choices in [draft proposals](proposals/), and lasting technology choices in [ADRs](decisions/001-sqlite-and-drizzle.md).

## Technical direction

- Build the smallest working vertical slice first. Use one Next.js/React application with strict TypeScript, server-rendered public pages, and a client-side interactive map. Follow the [project structure](project-structure.md): routes and composition in `src/app`, discovery UI and pure filtering in `src/features/discovery`, shared UI in `src/components`, public reads and contracts in `src/catalog/read`, validated operations in `src/catalog/operations`, writes in `src/catalog/write`, and request adapters in `src/site/server`. Keep the catalog writer independent of Next.js. Add a protected UI only when needed.
- Follow [ADR 002](decisions/002-runtime-and-tooling.md) for the selected runtime/tooling baseline: Node.js, npm, Next.js/React, Zod, Tailwind, Mapbox GL JS, Vitest, and Playwright, with compatible compiler/lint versions. Keep pinned versions and native SQLite packaging verified when dependencies change.
- Use SQLite, Drizzle, explicit reviewed migrations, and one persistent local Docker volume as described in [ADR 001](decisions/001-sqlite-and-drizzle.md). Run owner-initiated database operations from `commands/`; collection workflows will live in `ingestion/` when implemented. Add a separate API, queue, search, scraper, or AI service only when a concrete requirement justifies it.
- Prefer this sequence: schema and domain rules; read-only dump inspection and idempotent draft import; a small source-verified dataset; indexable list and detail pages; map using the same query and filters; validated agent writes and history; complete manual refresh and discovery. Keep each step part of a working product.

## Public web

- The map enhances linked list/detail discovery. Public pages need stable URLs, server-rendered content, titles and descriptions, canonical and social metadata, sitemap entries, and relevant schema.org data. Exclude drafts, duplicate filtered views, and thin placeholders from indexing.
- Put useful shareable filter state in URLs. Treat mobile usability, keyboard access, reduced motion, and map/list parity as baseline. Keep map-provider code behind a small adapter.
- Follow the [discovery contract](../openspec/specs/website/discovery/spec.md): return the complete public discovery summary set, load full details on selection, show map/list together on desktop, and provide easy switching on narrow screens. No viewport query or “Search this area” control. The fixture-backed application filters in the browser with shared server-rendering rules.
- Use scope subdomains with one application and shared catalog. The [scoped website spec](../openspec/specs/website/routing/spec.md) records current routes; the [draft routing proposal](proposals/website-routing-and-indexing.md) covers unselected cross-scope and indexing policies.
- Agent execution, operation transport, and exact command/error contracts are deferred to the next planning iteration; existing domain write invariants still apply. Web routes use public catalog reads. The browser uses public contracts and pure filtering rules, and does not import database or writer modules.

## Change workflow

### Application commands

Use Node.js 26.10.0 and its bundled npm 11.19.1 (see `.node-version` and `package.json`). From the repository root, run `npm ci` for a clean install, then `npm run dev` for the local App Router server. The default SQLite location is `./data/eventroam.sqlite`; copy `.env.example` to `.env.local` only when a different `DATABASE_PATH` is needed. The data directory and local environment files are ignored by Git.

Run `npm run type-check`, `npm run lint`, `npm run format:check`, and `npm test` for local checks. `npm run build` creates the production build, and `npm start` serves it. The SQLite smoke test uses a temporary real database file and verifies Drizzle queries, foreign keys, WAL, and the bounded busy timeout. Run `npm run test:e2e` for the four Festivals filter journeys in desktop Chromium and mobile Chromium. Its launcher creates a fresh temporary SQLite database, runs migrations, loads only fictional development fixtures, and removes the database afterward. The server uses port 3137 and disables Mapbox loading, so the suite checks shared map/list counts and mobile view switching but not live map tiles or marker interaction. Pass Playwright options after `--`, for example `npm run test:e2e -- --project=mobile`. Compose commands will be documented when that workflow is implemented.

Vitest installs database cleanup for every test. Call `testDatabase()` when a test needs SQLite; it creates and migrates a fresh temporary database on first use. Use `const fx = testFixtures()` from `src/test/fixtures.ts` for typed test data. `fx.build.*` creates objects without writing to SQLite; `fx.event`, `fx.occurrence`, `fx.term`, `fx.source`, `fx.eventLink`, `fx.occurrenceLink`, and relationship helpers insert records. `fx.publishedEvent({ event: { slug: "example" }, occurrences: [{ startsOn: "2028-07-01" }] })` creates a complete public scenario with terms and URL aliases. Omitted fields get defaults, explicit `null` is preserved, and an `undefined` override is ignored. Describe scenario data inside each test and specify values that the test checks or that affect its logic. Use direct SQL for constraint and query-count tests. Tests do not load development fixtures.

Run `npm run db:migrate` to apply the reviewed Drizzle SQL migrations to `DATABASE_PATH`. Run `npm run db:fixtures` to migrate and add repeatable fictional development records; both scripts enter through `commands/catalog-db.ts`, and fixture records live in `commands/development-fixtures.ts`. Fixtures are a separate data operation and are not part of the schema migration. The fixture command keeps existing fixture identities on repeat runs. Development fixtures insert catalog records directly and do not create sources, operation receipts, or audit history. Test fixture helpers can insert sources but do not create operation receipts or audit history. The initial migration was simplified before deployment; recreate any existing local development database to remove its old evidence and ingestion-run tables. `applyCatalogOperation` in `src/catalog/write` remains available for validated catalog writes with stable operation keys, expected versions, actor attribution, and audit history. Source evidence is deferred until the catalog database update workflow is built; current writes and publication do not require or store it. No agent transport or scheduled runner is configured yet.

- Use OpenSpec's standard workflow for behavior changes: write a proposal with the user's goal and delta specs with testable scenarios before implementation; add design and tasks when the change is ready to build. In Codex, invoke `$openspec-explore` or `$openspec-propose`, then `$openspec-apply-change`, `$openspec-update-change` when plans change, and `$openspec-archive-change` only after implementation and verification. `$openspec-sync-specs` is available when an active delta must reach the main specs before archive. Group capabilities under `catalog/`, `website/`, or `operations/` and give each delta the same capability path as its main spec. Keep main specs aligned with implemented behavior. Use the project-local CLI through `npm exec -- openspec` and run `npm run openspec:validate` to check artifacts. Reload the Codex task after initial setup so the generated skills appear. Record lasting cross-cutting decisions in short ADRs.
- Before editing, read the relevant spec, nearby tests, and configuration; inspect the working tree and preserve unrelated changes. Make the smallest complete change that keeps data, UI, and ingestion aligned.
- Validate external input at runtime; avoid `any`. Review generated migrations. Keep secrets out of source control and document only safe variable names in `.env.example`. Log stable run/source IDs without credentials or unnecessary personal data.
- Use focused unit tests for normalization, matching, and transitions; persistence and route integration tests; and a few critical end-to-end tests. Add a regression test for a bug when practical. Normal parser tests use small, attributable saved fixtures, not live third-party pages.
- Before handoff, run narrow relevant tests and standard checks when practical. Verify changed Docker configuration. Report changes, checks, and remaining uncertainty. Document new ingestion and Compose commands here when they exist.

## Operations

- `docker compose up --build` is the production-like startup target. Use health checks, clean shutdown, explicit repeatable migrations, named volumes for required persistent data, and pinned production image/runtime versions.
- Back up live SQLite with a consistent SQLite backup operation and test restoration; copying only the live main file in WAL mode is insufficient.
- Respect source terms, robots guidance, rate limits, and privacy. Prefer supported feeds or APIs where practical.

## Reference project

`/Users/karo/projects/eventmap` is a read-only product reference, not a codebase to migrate wholesale. Useful concepts include shared map/list data, recurring identities, uncertain date/location fields, and public detail routes. Avoid its dated dependencies, split frontend/admin apps, array-order assumptions for upcoming editions, seed data in migrations, and committed database files. The selected complete-summary delivery needs measured payload/rendering performance and server-rendered list parity; do not copy an unbounded full-detail payload design. Do not modify the reference project unless the user asks.
