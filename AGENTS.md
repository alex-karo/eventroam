# Eventroam

Eventroam is an English-language catalog for events of any type worldwide, built around a public map, list, and crawlable event pages. It starts with open-air music festivals and burning-like events.

## Current status

The repository contains specifications and research, but no application scaffold, database, migrations, or established commands. First-release filters, complete discovery summaries with details on selection, desktop combined map/list and mobile switching, and scope subdomains are selected. Website/URL defaults and a runtime/tooling baseline are documented; agent execution contracts are deferred to the next iteration. The eventmap project is a read-only reference; its dump has not yet been inspected or imported.

## References

- [Product foundation](specs/000-product-foundation.md): first-release scope, outcomes, and open decisions.
- [Domain model](specs/001-domain-model.md): records, evidence, publication, and ingestion invariants.
- [Festival taxonomy](specs/002-festival-taxonomy.md): starter vocabulary and assignment rules.
- [Festival information](specs/003-festival-information.md): collected facts, prices, capacity, and practical details.
- [Discovery filters](specs/004-discovery-filters.md): selected controls, map/list interaction, and summary loading.
- [Website structure and URLs](specs/005-website-structure-and-urls.md): scope domains and proposed routing/indexing rules.
- [Development guide](docs/development.md): technical direction, implementation workflow, quality, and operations.
- [ADR 001](docs/decisions/001-sqlite-and-drizzle.md): SQLite and Drizzle decision.
- [ADR 002](docs/decisions/002-runtime-and-tooling.md): runtime, frameworks, tooling, and version policy.
- [Research](docs/research/): background findings.
