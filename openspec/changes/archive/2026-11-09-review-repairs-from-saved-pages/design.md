# Design

## TL;DR

- Editor sends the disputed group back to its owner with a note. When Editor finds new information, it puts the source and exact excerpt in the note.
- The specialist uses the note and its original input to revise the group. The revision can use existing evidence IDs or give none. It has no tools.
- Ingestion checks the revision and keeps it within the assigned group. Editor checks new or changed facts on the saved page before it approves the revision.

## Contracts

The proposed change uses the existing [specialist reply](../../../../src/ingestion/roles/contracts.ts) and [repair record](../../../../src/ingestion/repairs.ts). This is a fragment of a proposed reply for a returned group.

```ts
{
  action: "set",
  value: replacement,
  reason: "The saved ticket page lists this price for this Edition.",
  evidenceIds: [],
}
```

Only a group that has returned can give no IDs where the initial reply requires support. Validation still checks every supplied reference. The same rule applies to a group returned by validation before the first review. A Location revision still needs a valid registered point if it selects one.

## Key decisions

Keep the Reader evidence for the run fixed. Remove the specialist's saved-page tools and the code that adds passages from repairs. Record the note as written and keep any existing evidence cited in the revision. This preserves the reason and the available source text in the report. The report has no new evidence ID for an excerpt in a note.

Use the current saved-page search for Editor. The search checks that the saved body belongs to the source from this run. Editor compares each returned group with its proposal before the first return. It checks whether the saved page supports the new facts for the selected target, including year and conditions. The same check applies when a later revision repeats a new fact.

## Risks and validation

A validation return can describe an invalid value before Editor has found a new passage. The specialist can correct the value with evidence it already has or omit an optional group. Editor can then find a missed passage and return the omission if it can be filled.

Use captured saved pages to check the first review after validation and a targeted review after an editorial return. Cover a revised fact without an evidence ID, a fact that the saved page cannot confirm, and a Location return that reuses a registered point. Check that earlier decisions on other groups remain in effect.
