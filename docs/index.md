# Eventroam documentation

This is a hand-maintained guide to the documents under `docs/`. Draft proposals hold unresolved choices. Code, tests, and current guides show what currently runs. [Active changes](../openspec/changes/) hold proposals, designs, and tasks; archives record past work. `stable` describes an accepted decision, verified current behavior, or reliable historical record; `draft` marks material still being selected or reviewed. Dated research is background evidence.

For a short introduction to the product, architecture, technology, and local setup, start with the [project README](../README.md).

## Maintaining the docs

See [Update documentation](change-workflow.md#update-documentation) for when to update a document and where to put new information.

Every substantive file under `docs/` has OKF-style `type`, `title`, `description`, and `status` frontmatter; `tags` are optional. Index files and `AGENTS.md` are navigation and instructions, not concepts. Keep unapproved choices in draft proposals. Do not add `generated`, `verified`, or `stale_after` without evidence. Update this index when adding or removing a document. Run `pnpm run docs:check` after editing docs.

## Website design

- [Signal design](design.md) — selected visual direction for the public website; shared visual rules for the catalog and project presentation.

## Draft proposals

- [Remaining release decisions](proposals/release-open-decisions.md) — unresolved launch-data, ingestion, and storage choices.
- [Website routing and indexing defaults](proposals/website-routing-and-indexing.md) — remaining future-page and cross-scope proposals; current SEO is implemented in [metadata code](../src/site/server/metadata.ts).
- [Festival taxonomy vocabulary proposal](proposals/festival-taxonomy-vocabulary.md) — starter terms loaded by catalog migrations and assignment guidance.

## Development and operations

- [Analytics](analytics.md) — PostHog setup, tracked events, GitHub campaign links, and owner opt-out.
- [Development guide](development.md) — local setup, common commands, and task routes.
- [Testing](testing.md) — application checks, browser tests, and temporary test data.
- [Change workflow](change-workflow.md) — planning, implementation, and review.
- [Ingestion tools](ingestion-tools.md) — CLI, Studio, saved runs, and diagnostics.
- [Source reader](source-reader.md) — page extraction, map evidence, fallback, and checks for `readPage`.
- [Infrastructure](infrastructure.md) — application containers, deployment inputs, and database maintenance and transfers.
- [Ingestion process](ingestion-process.md) — plain-language steps for festival research and catalog updates, including [location rules](ingestion-process.md#resolve-location).
- [Ingestion evals](ingestion-evals.md) — commands, Studio experiments, case design, scoring, fixtures, and model comparison.
- [Project structure](project-structure.md) — directories and dependency boundaries.

## Historical decisions

These records explain past technology choices. Use the code, tests, and current guides for today's setup and behavior.

- [ADR 001: SQLite and Drizzle](decisions/001-sqlite-and-drizzle.md) — original database choice.
- [ADR 002: Runtime and tooling](decisions/002-runtime-and-tooling.md) — original runtime and container baseline.

## Known issues

- [Studio and CLI evals share a DuckDB writer lock](known-issues/2026-10-27-studio-cli-duckdb-conflict.md) — affects standalone evals with logging or tracing enabled.
- [Invalid Edition key rejects Wacken research](known-issues/2026-10-27-wacken-invalid-edition-key.md) — malformed model output rejects a full research result.

## Archived issues

- [Roskilde ticket link preference](archive/known-issues/2026-10-27-roskilde-edition-ticket-link.md) — Links now prefers the overview; both repeated checks selected it.
- [Mastra eval storage snapshot failure](archive/known-issues/2026-10-27-mastra-sqlite-busy-snapshot.md) — archived after a dependency update and 100 scored attempts without storage failures; no separate concurrency check was run.

## Research

- [Geocoding service research](research/2026-10-24-geocoding-services.md) — dated provider and community findings; selection and location tests remain open.
- [Facebook and Instagram text access](research/2026-10-05-facebook-instagram-text-access.md) — dated retrieval checks and per-item costs for public posts.
- [Competitor scan](research/2026-09-14-competitor-scan.md) — dated rival observations; later product decisions supersede recommendations.
- [Source-model review](research/2026-09-17-source-model-review.md) — dated source observations; inheritance recommendation superseded.
- [Filters and classification research](research/2026-09-19-filters-and-classification.md) — dated rival findings; filter and inheritance proposals superseded.
- [Conference market research](research/2026-10-01-conference-market.md) — background for a possible future scope.
