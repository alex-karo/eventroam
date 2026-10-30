# Eventroam documentation

This is a hand-maintained guide to the documents under `docs/`. Draft proposals hold unresolved choices. The application and [current OpenSpec specs](../openspec/specs/) show what currently runs. `stable` describes an accepted decision, verified current behavior, or reliable historical record; `draft` marks material still being selected or reviewed. Dated research and legacy specs are background evidence.

For a short introduction to the product, architecture, technology, and local setup, start with the [project README](../README.md).

## Maintaining the docs

Every substantive file under `docs/` has OKF-style `type`, `title`, `description`, and `status` frontmatter; `tags` are optional. Index files and `AGENTS.md` are navigation and instructions, not concepts. Keep unapproved choices in draft proposals. Do not add `generated`, `verified`, or `stale_after` without evidence. Update this index when adding or removing a document. Run `pnpm run docs:check` after editing docs.

## Website design

- [Signal design](design.md) — selected visual direction for the public website; shared visual rules for the catalog and project presentation.

## Draft proposals

- [Remaining release decisions](proposals/release-open-decisions.md) — unresolved launch-data, ingestion, and storage choices.
- [Website routing and indexing defaults](proposals/website-routing-and-indexing.md) — remaining future-page and cross-scope proposals; current SEO is defined in [website discoverability](../openspec/specs/website/discoverability/spec.md).
- [Festival taxonomy vocabulary proposal](proposals/festival-taxonomy-vocabulary.md) — starter terms loaded by catalog migrations and assignment guidance.

## Historical specifications

- [Product foundation](archive/legacy-specs/000-product-foundation.md) — original first-release scope and acceptance text.
- [Domain model](archive/legacy-specs/001-domain-model.md) — original record, publication, and evidence model.
- [Festival information](archive/legacy-specs/003-festival-information.md) — original collection brief.
- [Discovery filters](archive/legacy-specs/004-discovery-filters.md) — original filter and map/list contract.
- [Website structure and URLs](archive/legacy-specs/005-website-structure-and-urls.md) — original host and routing contract.

## Development and operations

- [Analytics](analytics.md) — PostHog setup, tracked events, GitHub campaign links, and owner opt-out.
- [Development guide](development.md) — local setup, common commands, and task routes.
- [Testing](testing.md) — application checks, browser tests, and temporary test data.
- [Change workflow](change-workflow.md) — planning, implementation, and review.
- [Ingestion tools](ingestion-tools.md) — CLI, Studio, saved runs, and diagnostics.
- [Source reader](source-reader.md) — page extraction, map evidence, fallback, and checks for `readPage`.
- [Infrastructure](infrastructure.md) — application containers, deployment inputs, and database maintenance and transfers.
- [Ingestion process](ingestion-process.md) — plain-language steps for festival research and catalog updates, including [Location resolution](../openspec/specs/catalog/location-resolution/spec.md).
- [Ingestion evals](ingestion-evals.md) — commands, Studio experiments, case design, scoring, fixtures, and model comparison.
- [Project structure](project-structure.md) — directories and dependency boundaries.

## Decisions

- [ADR 001: SQLite and Drizzle](decisions/001-sqlite-and-drizzle.md) — accepted database choice.
- [ADR 002: Runtime and tooling](decisions/002-runtime-and-tooling.md) — accepted runtime and application container baseline.

## Known issues

- [Studio and CLI share a DuckDB writer lock](known-issues/2026-10-27-studio-cli-duckdb-conflict.md) — current workaround and a possible move to native Mastra server execution.
- [Roskilde ticket link preference](known-issues/2026-10-27-roskilde-edition-ticket-link.md) — the eval requires the ticket overview; agent instructions still need this rule.
- [Invalid Edition key rejects Wacken research](known-issues/2026-10-27-wacken-invalid-edition-key.md) — malformed model output rejects a full research result.
- [Mastra eval storage snapshot failure](known-issues/2026-10-27-mastra-sqlite-busy-snapshot.md) — intermittent storage errors, related upstream fixes, and pending checks.

## Research

- [Geocoding service research](research/2026-10-24-geocoding-services.md) — dated provider and community findings; selection and location tests remain open.
- [Facebook and Instagram text access](research/2026-10-05-facebook-instagram-text-access.md) — dated retrieval checks and per-item costs for public posts.
- [Competitor scan](research/2026-09-14-competitor-scan.md) — dated rival observations; later specs supersede recommendations.
- [Source-model review](research/2026-09-17-source-model-review.md) — dated source observations; inheritance recommendation superseded.
- [Filters and classification research](research/2026-09-19-filters-and-classification.md) — dated rival findings; filter and inheritance proposals superseded.
- [Conference market research](research/2026-10-01-conference-market.md) — background for a possible future scope.
