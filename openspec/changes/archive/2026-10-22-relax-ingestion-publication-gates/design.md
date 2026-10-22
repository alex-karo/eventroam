# Design

## Change size

Small. Two shared publication checks change in `src/catalog/domain/validation.ts`. Ingestion and the catalog writer already use them. No schema, dependency, public payload, or rendering changes are needed.

## Approach

Use the existing publication path for the [requested relaxation](proposal.md). Ingestion prepares Edition facts and assignments, checks eligibility, and emits publication operations. The writer validates those operations again within the existing transaction.

In `validateEditionRecord`, require only `countryCode` for the publication location check. In `validateFestivalScope`, replace the slug allowlists with facet-presence checks. Existing assignment validation already limits format and event type to one term and rejects invalid assignments. Keep that ownership rather than duplicating it in ingestion.

The existing year/date checks and Event publication logic already allow publication through a historical Edition. Undated Editions stay drafts. Keep the Festivals home scope and current rendering. Do not infer a current venue or coordinates from a previous Edition.

Only `catalog/publication` needs a delta. Its location eligibility wording and structural-gate scenario must agree with the relaxed gate; its display rules remain intact. Classification vocabulary and evidence rules stay as defined in `catalog/classification`. The inspected research/editor prompts do not impose the old publication allowlists, so they need no new instructions.

## Risks and validation

Update the existing domain, writer, and ingestion preparation tests to accept country-only locations and valid classification values outside the old allowlists. Check that missing required facets, dates, or country still block publication. Include a historical-only ingestion case to preserve the agreed date behavior. Keep existing invalid-term and assignment-cardinality coverage.

Align the ingestion guide and owning main publication spec when implementation is complete. Run the focused tests, type checking, documentation checks, and strict OpenSpec validation.
