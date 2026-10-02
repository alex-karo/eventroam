# Eventroam

Eventroam is an English-language catalog for events of any type worldwide, built around a public map, list, and crawlable event pages. It starts with open-air music festivals and burning-like events.

## Current status

The repository now has a single Next.js application with SQLite/Drizzle schema and migrations, validated catalog writes and audit history, public Event/Occurrence pages, complete discovery summaries, filters, and a responsive Mapbox map/list. These are implemented against fictional development fixtures. The npm scripts cover development, migration, fixtures, type checking, linting, formatting, tests, and builds; see the development guide for commands. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and production deployment remain deferred. Scope subdomains and URL behavior are specified, with the current implementation focused on the Festivals scope. The eventmap project remains a read-only reference; its data has not been imported.

## References

- [Product foundation](specs/000-product-foundation.md): first-release scope, outcomes, and open decisions.
- [Domain model](specs/001-domain-model.md): records, evidence, publication, and ingestion invariants.
- [Festival taxonomy](specs/002-festival-taxonomy.md): starter vocabulary and assignment rules.
- [Festival information](specs/003-festival-information.md): collected facts, prices, capacity, and practical details.
- [Discovery filters](specs/004-discovery-filters.md): selected controls, map/list interaction, and summary loading.
- [Website structure and URLs](specs/005-website-structure-and-urls.md): scope domains and proposed routing/indexing rules.
- [Development guide](docs/development.md): technical direction, implementation workflow, quality, and operations.
- [Service build checklist](docs/service-build-checklist.md) and [progress](docs/service-build-progress.md): implemented fixture-backed slices and remaining work.
- [ADR 001](docs/decisions/001-sqlite-and-drizzle.md): SQLite and Drizzle decision.
- [ADR 002](docs/decisions/002-runtime-and-tooling.md): runtime, frameworks, tooling, and version policy.
- [Research](docs/research/): background findings.
