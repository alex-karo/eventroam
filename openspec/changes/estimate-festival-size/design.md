# Design

## Context

The optional capacity integer flows through SQLite, catalog/research contracts, reports, and public views. The prompt currently defines it as planned maximum. See proposal.md for the intended semantics.

## Goals / Non-Goals

Give size one meaning across these layers. Retain the scalar, filter bands, URLs, and publication gates; add no separate attendance metrics or evidence UI.

## Decisions

- Rename active fields to `sizeEstimate` / `size_estimate` and the discovery helper to `sizeBand`, without aliases: changing copy alone leaves misleading contracts.
- Keep positive integers and null. Display “Estimated size: <number> people”; omit unknown size.
- Let the model explain participant-scale estimates, including relevant historical attendance. Occupancy alone and repeat admissions do not establish participant numbers. Retain the real source property `maximumAttendeeCapacity` as context.
- Use report version 4; reject historical versions without conversion. Preserve stored reports, audit JSON, and receipts.
- Sync compact deltas and replace obsolete size/version wording in main specs without changing unrelated requirements or scenarios.

## Risks / Trade-offs

- Stored estimates may reflect capacity limits → Preserve development values and recheck through refresh.
- Sources may count visits → Require an explained participant interpretation.

## Migration Plan

Add a data-preserving migration and snapshot; leave prior migrations intact. Ship the schema, contracts, reports, and UI together. Verify fresh, populated, and repeated migrations. Apply through the existing database command; local rollback restores the pre-migration database with matching code.
