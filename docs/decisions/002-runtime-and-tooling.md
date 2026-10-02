# ADR 002: Runtime and tooling

Status: Selected implementation baseline; installation and build verification pending  
Date: 2026-10-01

## Context

Eventroam needs one English-language application with crawlable Event/Occurrence pages, a shared map/list catalog, and a local SQLite database. The owner requested the latest stable Node.js and a concrete tooling selection before scaffolding. [ADR 001](001-sqlite-and-drizzle.md) already selects SQLite and Drizzle; this decision implements the direction in the [development guide](../development.md).

The backend supplies all discovery summaries, with full details loaded when a visitor opens a result. Map movement does not request another geographic subset. Desktop displays map and list together; smaller screens offer an easy switch between them. The precise division of filter execution between browser and server is a discovery-contract decision, not a reason to add another service. [Discovery filters](../../specs/004-discovery-filters.md) owns the behavior.

## Decision

Use one Next.js application, one package, and one dependency lockfile. Use the Node runtime for database access, server-rendered public pages, and same-origin read endpoints. Keep pure domain rules and application services separate from framework and storage adapters. Scope subdomains share the deployment and database; they do not imply separate applications.

### Runtime and dependency baseline

Versions below were checked on 2026-10-01 against official documentation and publisher package metadata. They are the starting pins for scaffolding, not evidence that an application has already built successfully. Recheck releases and peer dependencies when scaffolding if these pins have aged.

| Area | Selection | Reason and source |
| --- | --- | --- |
| Runtime | **Node.js 26.10.0** | Latest non-prerelease **Current** release observed. The same official page lists 24.21.0 as latest LTS; the owner requested latest stable, so select Current. [Node download](https://nodejs.org/en/download/current) |
| Package manager | **npm 11.19.1**, bundled with Node.js 26.10.0 | Use the package manager supplied by the selected Node release for this single-package application. Commit its lockfile and use clean installs in local, CI, and Docker workflows. [Node release archive](https://nodejs.org/en/download/archive/v26.10.0), [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/) |
| Web framework | **Next.js 16.3.8**, App Router, built-in Turbopack | Covers server rendering, routing, metadata, and read endpoints in the existing single-app direction. Node requirement is >=20.9. [Installation](https://nextjs.org/docs/app/getting-started/installation), [package metadata](https://registry.npmjs.org/next/16.3.8) |
| UI runtime | **React and React DOM 19.3.0** | Matching stable versions satisfy Next's declared React peer range. App Router manages its framework-integrated React implementation; do not independently opt into React canary packages. [React metadata](https://registry.npmjs.org/react/19.3.0), [React DOM metadata](https://registry.npmjs.org/react-dom/19.3.0) |
| Language | **TypeScript 6.0.3**, strict mode | A compatible stable compiler for the selected lint toolchain. TypeScript 7.0.2 is newer, but the current TypeScript ESLint parser declares <6.1 support. [Compiler metadata](https://registry.npmjs.org/typescript/6.0.3), [parser metadata](https://registry.npmjs.org/@typescript-eslint/parser/8.71.0) |
| Database access | **Drizzle ORM 0.45.3**, **Drizzle Kit 0.31.11**, **better-sqlite3 13.0.3** | Explicit SQL migrations and an embedded driver preserve ADR 001. These are stable package releases; current Drizzle examples sometimes use `@rc`, which is not this selection. [ORM metadata](https://registry.npmjs.org/drizzle-orm/0.45.3), [Kit metadata](https://registry.npmjs.org/drizzle-kit/0.31.11), [driver metadata](https://registry.npmjs.org/better-sqlite3/13.0.3) |
| Runtime validation | **Zod 4.6.5** | Shared schemas for query parameters, configuration, and external input at application boundaries. Database constraints still enforce persisted invariants. [Zod documentation](https://zod.dev/), [version metadata](https://registry.npmjs.org/zod/4.6.5) |
| Styling and controls | **Tailwind CSS / @tailwindcss/postcss 4.3.3**; selected **Radix Primitives** as needed | CSS variables define design tokens; native HTML handles simple controls. Use Radix Dialog/Popover for focus-managed overlays rather than implementing their keyboard behavior from scratch. Avoid a large pre-styled component suite. [Tailwind setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [Radix introduction](https://www.radix-ui.com/primitives/docs/overview/introduction) |
| Map renderer and provider | **Mapbox GL JS 3.30.0** with Mapbox-hosted map data | Client-side vector map with GeoJSON layers and clustering, behind a small application adapter. Mapbox requires a public access token and displays attribution. [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/), [token management](https://docs.mapbox.com/accounts/guides/tokens/) |
| Unit/integration tests | **Vitest 5.0.3** | TypeScript domain and storage tests on Node; test the real SQLite driver with temporary databases. Its declared Node range includes >=26. [Vitest metadata](https://registry.npmjs.org/vitest/5.0.3) |
| Browser tests | **Playwright Test 1.63.0** | Cover critical responsive, keyboard, navigation, and server-rendered journeys against the running application. [Playwright documentation](https://playwright.dev/docs/intro), [version metadata](https://registry.npmjs.org/@playwright/test/1.63.0) |
| Lint and format | **ESLint 9.39.5**, **eslint-config-next 16.3.8**, **Prettier 3.9.9**, **eslint-config-prettier 10.1.8** | Next/React/accessibility rules plus a separate formatter. Use ESLint 9 because the current React, import, and accessibility plugins do not declare ESLint 10 support. [Next lint guide](https://nextjs.org/docs/app/api-reference/config/eslint), [React plugin peers](https://registry.npmjs.org/eslint-plugin-react/7.37.5), [import plugin peers](https://registry.npmjs.org/eslint-plugin-import/2.32.0), [accessibility plugin peers](https://registry.npmjs.org/eslint-plugin-jsx-a11y/6.10.2) |

Use Node 26 and React 19 matching type declarations. Select compatible support packages such as `@types/better-sqlite3` when scaffolding. Install only Radix primitives actually used, keeping their shared dependencies aligned. Prefer native fetch, URL, and Intl APIs; do not add an HTTP client, global state manager, or date library without a specific need. Programme dates remain calendar dates, never implicitly converted to local or UTC midnight instants.

### Rendering and data flow

- Server-render useful list content, stable detail links, and full public detail pages. Direct entry to a detail URL must work without a prior map click or browser JavaScript.
- Hydrate filter controls and lazy-load the map in a client boundary. Desktop uses both views; mobile switching preserves applied filter state and selection. If WebGL is unavailable, the list remains usable.
- Use a dedicated public Mapbox token with the minimum map-reading scopes and URL restrictions for launched hosts; configure local development separately. Keep attribution visible. Mapbox GL JS bills by map load when a map instance is initialized, so avoid remounting it during routine filter and view changes. [Token management](https://docs.mapbox.com/accounts/guides/tokens/), [pricing model](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/)
- Keep the discovery response compact: identifiers, canonical links, names, dates/status qualifications, locations/precision, and the typed fields needed for selected filters and list summaries. Exclude full descriptions, attendance details, internal evidence, and audit history. Do not paginate or truncate the map dataset invisibly.
- Load detail payloads on explicit selection/navigation; avoid eagerly prefetching every result's full page. Use normal links so sharing, opening a new tab, and server rendering remain available.
- Keep browser read endpoints and server-rendered pages on the same application services. Validate applied URL state and domain scope. Cache keys must include scope; no cached result may leak across subdomains. Begin with request-time catalog reads and add explicit caching only with a publication-invalidation strategy.
- Use React state for unfinished panel edits and selection, and URLs for applied shareable state. Map camera movement is presentation state, not a catalog query predicate. No viewport fetch, bounding-box filter, or “Search this area” control is required.

### SQLite and deployment

Use `better-sqlite3` through Drizzle in server-only modules. The selected driver's published Node requirement is >=22, covering Node 26 at the metadata level. This is a native dependency: a clean install and real query in the target Linux image, and in the supported local environment, must pass before the pin is considered verified. Do not copy a macOS native dependency into Linux or mix build/runtime architectures. If a target lacks a working prebuilt binary, investigate its supported source-build path before changing the driver; do not silently downgrade Node to LTS.

Use a Debian-based official Node image at the selected exact Node version, pinned by digest once a supported image is verified. Build a multi-stage Docker image with Next standalone output and verify that native modules and static assets are included. Run one application instance on the persistent local volume under Docker Compose. Keep migration execution explicit and separate from concurrent application startup. Preserve WAL, foreign keys, bounded busy waits, atomic audit writes, and backup/restore requirements from ADR 001.

Synchronous SQLite calls are acceptable for short local queries and writes at this stage. Measure complete-summary payload size, query duration, and mobile rendering with the launch dataset. Do not solve an unmeasured concern by introducing a queue, separate API, search service, multiple application replicas, or a silent result cap.

### Repository layout and quality checks

The initial scaffold used `src/domain` and `src/application`; the adopted layout is specified in the [project structure](../project-structure.md). Keep routes in `src/app`, feature UI and pure discovery logic in `src/features`, reusable components in `src/components`, catalog rules and operations in `src/catalog`, request adapters in `src/site/server`, and schema and connections in `src/db`. Put reviewed migrations in `src/db/migrations`; colocate focused tests and add browser journeys in `tests/e2e` when implemented. These are directory responsibilities, not separate packages.

Vitest covers normalization, filter/date boundaries, publication rules, and real persistence transactions. Browser tests cover the desktop combined view, mobile switch, URL restoration, on-demand details, direct SSR entry, missing coordinates, and scope isolation. Test async Server Component behavior through the running app: Next's [Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) explicitly directs those cases toward end-to-end testing. Use deterministic fixtures and avoid live source sites or map-vendor calls in routine tests.

At scaffolding, establish canonical scripts for development, type checking, ESLint, formatting checks, focused tests, production build, and browser tests. Check lint separately from the production build. Add actual install/migration/Compose commands to the development guide after they exist and have run successfully; this ADR does not establish executable repository commands.

### Pinning and upgrades

Pin Node in the repository runtime file, package-manager metadata, CI, and Docker configuration. Declare `npm@11.19.1` in `packageManager`, verify the installed npm version from the pinned Node release, save direct dependencies at exact versions, commit `package-lock.json`, and use `npm ci` in CI and container builds. Pin the production image digest and update it deliberately for runtime/base-image fixes.

Review stable release updates as maintenance changes. The Node policy remains latest non-prerelease stable, including the Current line; upgrading is a reviewed change with a clean install, native SQLite check, type/lint checks, relevant tests, and production build. Never float `latest` in a production image or install prerelease packages to satisfy a tutorial. Update Next/React and Drizzle/Kit as compatible sets; record a reason when a dependency remains on an older compatible stable version, as TypeScript and ESLint do here.

## Deferred decisions

- Agent execution, operation transport, command contracts, and AI/scraping tooling wait for the next iteration, per the owner. Do not introduce an agent SDK or command framework now.
- The exact Mapbox style, token values, budget limits, and any ingestion geocoder remain open. The v1 locality/country filter can use catalog fields without a geocoding service. Configure the selected style, tokens, attribution, and usage monitoring before public deployment.
- Production hosting vendor, ingress/TLS tooling, backup destination/schedule, and monitoring service remain deployment decisions. Supporting several scope hostnames does not require a multi-service deployment.
- Exact payload schemas belong in the discovery implementation contract. The confirmed requirement is all summaries with details on selection and no map-area fetching; the discovery spec proposes browser filtering of the complete scope summary set with shared server-rendering rules.

## Verification limits

This is a documentation decision only: no application, dependency installation, lockfile, database, or Docker image was created. Official documentation and package engine/peer declarations support the baseline; they do not replace an integration build. In particular, verify native SQLite packaging, Next's production output, and the complete resolved lint dependency graph during scaffolding.
