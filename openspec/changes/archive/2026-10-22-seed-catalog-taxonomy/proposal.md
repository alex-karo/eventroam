# Proposal

## Why

A catalog containing only imported genres cannot classify an Edition as an outdoor music festival, even when sources support it. The migration path must supply the curated vocabulary so ingestion can choose the existing terms required by publication.

## What Changes

- Add a data migration for 71 starter terms: two event types, three formats, nine topics, 56 genres, and `culture/burning-like`.
- Include the 36 additional genres accepted by the owner, with explicit discovery parents and assignment guidance.
- Reuse terms by `(facet, slug)` and preserve existing IDs, labels, parents, and Edition assignments. Resolve new children's parents using the IDs actually stored in the catalog.
- Keep vocabulary initialization in the existing migration command. Align development fixtures and controlled test/eval vocabulary setup with migrated reference data.
- Use the selected terms and evidence guidance in the vocabulary document. Update its implementation status and database setup instructions when implemented.
- Retain current publication gates and Edition-specific evidence rules. Do not add a command or ingestion preflight diagnostics. Do not run ingestion or assign terms to saved Editions.

## Capabilities

No specification changes. This change supplies reference data through existing database tooling. The existing classification, ancestry, and publication contracts remain unchanged; `skip_specs: true` applies.

## Impact

The change affects the database migration history, development fixtures, test/eval database setup, and taxonomy/setup documentation. It adds reference rows, not schema constraints or a new taxonomy service. Public filtering continues to use stored genre ancestry. Filling the dictionary alone does not publish existing drafts.
