# Eventroam documentation

This is a hand-maintained guide to the project's Markdown knowledge. `stable` describes an accepted decision, a verified current behavior, or a reliable historical record; it does not mean every target feature is implemented. `draft` marks material still being selected or reviewed. The application and [build progress](service-build-progress.md) show what currently runs. Research records observations at their stated dates; current specs and decisions govern behavior.

## Maintaining the docs

Every substantive file under `specs/` and `docs/` has OKF-style `type`, `title`, `description`, and `status` frontmatter; `tags` are optional. Index files and `AGENTS.md` are navigation and instructions, not concepts. This in-place layout is not a single conformant OKF bundle. Keep unapproved choices in draft proposals, and distinguish accepted target behavior from implemented behavior in prose. Do not add `generated`, `verified`, or `stale_after` without evidence. Update this index when adding or removing a document, and run `npm run docs:check` after editing docs.

## Product and domain specs

- [Product foundation](../specs/000-product-foundation.md) — release scope, outcomes, and acceptance; draft overall, with selected direction called out in the text.
- [Domain model](../specs/001-domain-model.md) — identity, publication, writes, and target evidence rules; draft overall.
- [Festival taxonomy](../specs/002-festival-taxonomy.md) — proposed starter vocabulary awaiting launch-data validation.
- [Festival information](../specs/003-festival-information.md) — draft brief for edition facts and practical details.
- [Discovery filters](../specs/004-discovery-filters.md) — selected controls and fixture-backed map/list behavior.
- [Website structure and URLs](../specs/005-website-structure-and-urls.md) — scope direction and current routes.

## Draft proposals

- [Remaining release decisions](../specs/proposals/release-open-decisions.md) — unresolved launch-data, ingestion, and storage choices.
- [Website routing and indexing defaults](../specs/proposals/website-routing-and-indexing.md) — unselected cross-scope and public-launch policies.

## Development and operations

- [Development guide](development.md) — commands, workflow, and working practices.
- [Project structure](project-structure.md) — directories and dependency boundaries.
- [Service build checklist](service-build-checklist.md) — build tasks and remaining gates.
- [Service build progress](service-build-progress.md) — fixture-backed implementation and verification record.
- [Mapbox deployment gate](mapbox-deployment-gate.md) — checks required before public map deployment.

## Decisions

- [ADR 001: SQLite and Drizzle](decisions/001-sqlite-and-drizzle.md) — accepted database choice.
- [ADR 002: Runtime and tooling](decisions/002-runtime-and-tooling.md) — accepted runtime baseline; production packaging remains open.

## Research

- [Competitor scan](research/2026-09-14-competitor-scan.md) — dated rival observations; later specs supersede recommendations.
- [Source-model review](research/2026-09-17-source-model-review.md) — dated source observations; inheritance recommendation superseded.
- [Filters and classification research](research/2026-09-19-filters-and-classification.md) — dated rival findings; filter and inheritance proposals superseded.
- [Conference market research](research/2026-10-01-conference-market.md) — background for a possible future scope.
