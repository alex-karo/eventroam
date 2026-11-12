---
type: Proposal
title: Remaining release decisions
description: Unresolved launch-data, ingestion, storage, and website choices for the first release.
status: draft
tags: [release, ingestion]
---

# Remaining release decisions

Validate discovery defaults and the [starter vocabulary](festival-taxonomy-vocabulary.md) against launch data before dependent work. Vocabulary loading is already part of `db:migrate`.

The remaining [website/URL proposals](website-routing-and-indexing.md) describe future choices. See [routes and scope](../project-structure.md#routes-and-scope) for the current website implementation.

The [ingestion guide](../ingestion-process.md) and [project structure](../project-structure.md) describe owner-initiated collection. Legacy import and its tooling remain outside that workflow.

The [ingestion process](../ingestion-process.md) uses owner-initiated CLI or Studio execution with OpenRouter. The [source reader guide](../source-reader.md) reports Facebook/Instagram content retrieval as unsupported. CatalogChange history records applied field changes; inspected source outcomes remain in [report contracts](../../src/ingestion/report.ts) without required full-page snapshots. Unattended scheduling, social-content retrieval, and any later snapshot storage/retention policy remain deferred.

Active OpenSpec proposals describe change requirements; archived artifacts record history. This proposal does not override accepted changes or current code.
