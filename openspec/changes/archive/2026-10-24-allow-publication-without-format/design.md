# Design

## Change size

Small. One shared validation rule controls publication through ingestion and catalog writes. No schema, dependency, or stored-data change is needed.

## Approach

Remove the format-presence check from `validateFestivalScope`. Keep all other publication checks and single-format assignment validation. An Edition with unknown format can then publish through the existing operations. See [the proposal](proposal.md) and [publication delta](specs/catalog/publication/spec.md).

Keep the existing format evidence definition. State in the shared research/editor instructions that unknown format permits publication. A missing format alone no longer qualifies as a missing publication-required fact for search. Update the current ingestion guide and vocabulary notes. Do not publish existing drafts as part of this change.

## Risks and validation

The main risk is weakening unrelated gates. Update the existing domain tests to require event type and topic or culture with and without format. Update the ingestion/writer integration cases to publish without format and confirm that no format is added. Existing assignment tests must still reject conflicting formats. Run the relevant tests, type check, lint, documentation checks, and OpenSpec validation.

## Plan review

Self-check for this small direct change: the shared validator covers both write paths. The change preserves evidence rules, classification ownership, and explicit publication operations. No unresolved decisions remain.
