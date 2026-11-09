# Proposal

## Why

When Editor finds a missing ticket price on a saved page, Tickets must find the passage again and submit its exact text to get an evidence ID. This second lookup takes time and can fail on repeated text or different Markdown. Editor can verify the revised price against the saved page during review.

## What Changes

- Send the owner's group and the return note as written. Editor puts the saved source and any new excerpt in that note.
- Remove saved-page search and new citation creation from specialist returns. A revision can omit evidence IDs. Any IDs it supplies must still refer to existing evidence.
- Require Editor to check new or changed facts in a revision against saved pages before approval. Keep existing checks for initial proposals, target identity, country, and registered points.

## Capabilities

### Modified Capabilities

#### `catalog/ingestion-workflow`

- **Before** Editor reviews each revision with its cited evidence.
- **After** A returned group can omit evidence IDs. Editor checks new or changed facts on the saved page before approval.

#### `catalog/source-access`

- **Before** Editor and returning specialists can search saved pages. Specialists can bind a new quote and retry failed matches.
- **After** Editor searches the saved pages and gives the specialist any new excerpt in the return note.

#### `catalog/location-resolution`

- **Before** Location can cite a new passage for a corrected venue and reuse the registered point.
- **After** Location can use Editor's excerpt to correct the venue. Editor checks that name on the saved page.

#### `catalog/ingestion-runs`

- **Before** Repair reports show the source passages with their references.
- **After** Repair reports keep the return note with its source excerpts and any existing evidence that the revision cites.

## Impact

The change affects specialist revision, Editor review, and repair reports. The catalog and report storage formats stay the same.
