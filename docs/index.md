# Eventroam documentation

This is a hand-maintained guide to the documents under `docs/`. Draft proposals hold unresolved choices. The application and [current OpenSpec specs](../openspec/specs/) show what currently runs. `stable` describes an accepted decision, verified current behavior, or reliable historical record; `draft` marks material still being selected or reviewed. Dated research and legacy specs are background evidence.

For a short introduction to the product, architecture, technology, and local setup, start with the [project README](../README.md).

## Maintaining the docs

Every substantive file under `docs/` has OKF-style `type`, `title`, `description`, and `status` frontmatter; `tags` are optional. Index files and `AGENTS.md` are navigation and instructions, not concepts. Keep unapproved choices in draft proposals. Do not add `generated`, `verified`, or `stale_after` without evidence. Update this index when adding or removing a document. Run `npm run docs:check` after editing docs.

## Website design

- [Signal design](../DESIGN.md) — selected visual direction for the public website; shared visual rules for the catalog and project presentation.

## Draft proposals

- [Remaining release decisions](proposals/release-open-decisions.md) — unresolved launch-data, ingestion, and storage choices.
- [Website routing and indexing defaults](proposals/website-routing-and-indexing.md) — unselected cross-scope and public-launch policies.
- [Festival taxonomy vocabulary proposal](proposals/festival-taxonomy-vocabulary.md) — starter terms loaded by catalog migrations and assignment guidance.

## Historical specifications

- [Product foundation](archive/legacy-specs/000-product-foundation.md) — original first-release scope and acceptance text.
- [Domain model](archive/legacy-specs/001-domain-model.md) — original record, publication, and evidence model.
- [Festival information](archive/legacy-specs/003-festival-information.md) — original collection brief.
- [Discovery filters](archive/legacy-specs/004-discovery-filters.md) — original filter and map/list contract.
- [Website structure and URLs](archive/legacy-specs/005-website-structure-and-urls.md) — original host and routing contract.

## Development and operations

- [Development guide](development.md) — commands, workflow, and working practices.
- [Ingestion process](ingestion-process.md) — plain-language steps for local festival research and catalog updates.
- [Project structure](project-structure.md) — directories and dependency boundaries.
- [Mapbox deployment gate](mapbox-deployment-gate.md) — checks required before public map deployment.

## Decisions

- [ADR 001: SQLite and Drizzle](decisions/001-sqlite-and-drizzle.md) — accepted database choice.
- [ADR 002: Runtime and tooling](decisions/002-runtime-and-tooling.md) — accepted runtime and application container baseline.

## Research

- [Facebook and Instagram text access](research/2026-10-05-facebook-instagram-text-access.md) — dated retrieval checks and per-item costs for public posts.
- [Competitor scan](research/2026-09-14-competitor-scan.md) — dated rival observations; later specs supersede recommendations.
- [Source-model review](research/2026-09-17-source-model-review.md) — dated source observations; inheritance recommendation superseded.
- [Filters and classification research](research/2026-09-19-filters-and-classification.md) — dated rival findings; filter and inheritance proposals superseded.
- [Conference market research](research/2026-10-01-conference-market.md) — background for a possible future scope.
