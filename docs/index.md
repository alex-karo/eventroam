# Eventroam documentation

This is a hand-maintained guide to the project's Markdown knowledge. Main OpenSpec specs describe implemented behavior. Active OpenSpec changes describe approved work; completed changes may remain active pending archive. Draft proposals hold unresolved choices. The application and [build progress](service-build-progress.md) show what currently runs. `stable` describes an accepted decision, verified current behavior, or reliable historical record; `draft` marks material still being selected or reviewed. Dated research and legacy specs are background evidence.

For a short introduction to the product, architecture, technology, and local setup, start with the [project README](../README.md).

## Maintaining the docs

Every substantive file under `docs/` has OKF-style `type`, `title`, `description`, and `status` frontmatter; `tags` are optional. OpenSpec owns behavioral specifications and follows its own format. Index files and `AGENTS.md` are navigation and instructions, not concepts. Keep unapproved choices in draft proposals; do not promote them to main OpenSpec specs or active changes. Do not add `generated`, `verified`, or `stale_after` without evidence. Update this index when adding or removing a document. Run `npm run docs:check` after editing docs and `npm run openspec:validate` after editing OpenSpec artifacts.

## Implemented behavior: OpenSpec

Catalog:

- [Catalog records](../openspec/specs/catalog/records/spec.md) — Event/Occurrence identity, validated facts, typed prices, and versioned writes.
- [Publication and details](../openspec/specs/catalog/publication/spec.md) — publication gates, visibility, and public edition presentation.
- [Occurrence classification](../openspec/specs/catalog/classification/spec.md) — fixed facets, per-edition assignments, and public labels.
- [Source-backed catalog workflow](../openspec/specs/catalog/source-workflow/spec.md) — owner-initiated collection, model-led refresh, and attributable run outcomes.

Website:

- [Discovery](../openspec/specs/website/discovery/spec.md) — filters, URL state, and the shared map/list result set.
- [Scoped website](../openspec/specs/website/routing/spec.md) — configured hosts, stable detail routes, and scope-root state.

## Approved future changes

- [Public site launch](../openspec/changes/public-site-launch/proposal.md) — record metadata and crawler discoverability.
- [Production readiness](../openspec/changes/production-readiness/proposal.md) — compatible release, recovery, launched hosts, and Mapbox gate.

## Archived changes

- [Durable ingestion run records](../openspec/changes/archive/2026-10-09-add-ingestion-run-records/proposal.md) — implemented per-festival start/final history, private reports, and known usage/costs, including dry runs.

- [Minimal research tracing](../openspec/changes/archive/2026-10-09-minimal-research-tracing/proposal.md) — optional local research-agent traces and Studio inspection, with accepted persistence/logger risks.
- [Simpler research output](../openspec/changes/archive/2026-10-09-simplify-research-output/proposal.md) — explicit research outcomes, explained facts, replaceable link slots, and ticket-category availability.
- [Source-backed catalog workflow](../openspec/changes/archive/2026-10-05-source-backed-catalog-workflow/proposal.md) — completed local collection change; its [design](../openspec/changes/archive/2026-10-05-source-backed-catalog-workflow/design.md) records the implementation approach.

## Draft proposals and migration record

- [Remaining release decisions](proposals/release-open-decisions.md) — unresolved launch-data, ingestion, and storage choices.
- [Website routing and indexing defaults](proposals/website-routing-and-indexing.md) — unselected cross-scope and public-launch policies.
- [Festival taxonomy vocabulary proposal](proposals/festival-taxonomy-vocabulary.md) — starter terms awaiting launch-data validation.
- [Specification migration map](specification-migration.md) — where each legacy section moved.

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
- [Service build checklist](service-build-checklist.md) — build tasks and remaining gates.
- [Service build progress](service-build-progress.md) — fixture-backed implementation and verification record.
- [Mapbox deployment gate](mapbox-deployment-gate.md) — checks required before public map deployment.

## Decisions

- [ADR 001: SQLite and Drizzle](decisions/001-sqlite-and-drizzle.md) — accepted database choice.
- [ADR 002: Runtime and tooling](decisions/002-runtime-and-tooling.md) — accepted runtime baseline; production packaging remains open.

## Research

- [Facebook and Instagram text access](research/2026-10-05-facebook-instagram-text-access.md) — dated retrieval checks and per-item costs for public posts.
- [Competitor scan](research/2026-09-14-competitor-scan.md) — dated rival observations; later specs supersede recommendations.
- [Source-model review](research/2026-09-17-source-model-review.md) — dated source observations; inheritance recommendation superseded.
- [Filters and classification research](research/2026-09-19-filters-and-classification.md) — dated rival findings; filter and inheritance proposals superseded.
- [Conference market research](research/2026-10-01-conference-market.md) — background for a possible future scope.
