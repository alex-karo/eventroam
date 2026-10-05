---
type: Proposal
title: Remaining release decisions
description: Unresolved launch-data, ingestion, storage, and website choices for the first release.
status: draft
tags: [release, ingestion]
---

# Remaining release decisions

Resolve these before implementing dependent behavior: validation of discovery defaults and the [starter vocabulary](festival-taxonomy-vocabulary.md) against launch data; idempotent vocabulary loading; and the [proposed website/URL defaults](website-routing-and-indexing.md). The [archived source-workflow design](../../openspec/changes/archive/2026-10-05-source-backed-catalog-workflow/design.md) records the implemented local collection approach. Legacy import and its tooling remain outside that workflow.

The [source-backed catalog workflow](../../openspec/specs/catalog/source-workflow/spec.md) uses owner-initiated local execution with OpenRouter and reports Facebook/Instagram content retrieval as unsupported. CatalogChange history records applied field changes; inspected source outcomes remain in private local reports without required full-page snapshots. Server execution, unattended scheduling, social-content retrieval, and any later snapshot storage/retention policy remain deferred.

OpenSpec holds implemented behavior and approved future changes. The [historical product foundation](../archive/legacy-specs/000-product-foundation.md) and [historical domain model](../archive/legacy-specs/001-domain-model.md) preserve the source text used during migration; this proposal does not override OpenSpec.
