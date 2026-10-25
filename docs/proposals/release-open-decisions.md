---
type: Proposal
title: Remaining release decisions
description: Unresolved launch-data, ingestion, storage, and website choices for the first release.
status: draft
tags: [release, ingestion]
---

# Remaining release decisions

Resolve these before implementing dependent behavior: validation of discovery defaults and the [starter vocabulary](festival-taxonomy-vocabulary.md) against launch data; idempotent vocabulary loading; and the [proposed website/URL defaults](website-routing-and-indexing.md). The [ingestion guide](../ingestion-process.md) and [project structure](../project-structure.md) describe the implemented owner-initiated collection approach. Legacy import and its tooling remain outside that workflow.

The [ingestion workflow](../../openspec/specs/catalog/ingestion-workflow/spec.md) uses owner-initiated CLI or Studio execution with OpenRouter. [Source access](../../openspec/specs/catalog/source-access/spec.md) reports Facebook/Instagram content retrieval as unsupported. CatalogChange history records applied field changes; inspected source outcomes remain in [private durable run reports](../../openspec/specs/catalog/ingestion-runs/spec.md) without required full-page snapshots. Unattended scheduling, social-content retrieval, and any later snapshot storage/retention policy remain deferred.

OpenSpec holds implemented behavior and approved future changes. The [historical product foundation](../archive/legacy-specs/000-product-foundation.md) and [historical domain model](../archive/legacy-specs/001-domain-model.md) preserve the source text used during migration; this proposal does not override OpenSpec.
