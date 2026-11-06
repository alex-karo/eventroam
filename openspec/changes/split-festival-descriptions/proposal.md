# Proposal

## Why

The catalog uses one Event summary for both the festival page and its search and social previews. A reader needs enough detail to understand the festival. A preview needs one or two sentences that identify it.

## What Changes

- **BREAKING** Replace the Event `summary` field with two independently optional fields.
- Ingestion writes both texts from the latest known festival format and any announced changes.
- Ingestion requires evidence of at least one completed, ongoing or announced Edition. Without it, the run ends without catalog changes and records the reason.
- The website uses the available text for either purpose. If both fields are empty, it builds a neutral sentence from public catalog data.

## Capabilities

### Modified Capabilities

- `catalog/records`
  - **Before**: An Event owns one summary.
  - **After**: It owns optional `description` and `shortDescription` fields.
- `catalog/ingestion-workflow`
  - **Before**: Add requests a short factual summary.
  - **After**: Add checks both descriptions. Ingestion needs a selected Edition or a saved Edition with `scheduled` or `announced` status.
- `catalog/refresh-scope`
  - **Before**: Full refresh checks the summary.
  - **After**: Full refresh checks both fields. Current refresh handles Edition facts only. Known completed history without a current or next Edition allows a normal end without updates.
- `catalog/publication`
  - **Before**: Public reads expose the summary for detail pages.
  - **After**: Public reads supply the descriptions for page text and metadata.
- `website/festival-details`
  - **Before**: Detail pages show the Event summary.
  - **After**: They prefer the detailed text, then the short text, then an automatic description. Historical pages show the current festival text in About the festival.
- `website/discoverability`
  - **Before**: Event metadata describes the festival and its history. The site uses the summary when present.
  - **After**: Event search and social metadata prefer the short description of the current festival.
- `operations/ingestion-evaluation`
  - **Before**: Main eval shows description proposals, Editor decisions, and writes.
  - **After**: Main eval reports the match probability for each assessed text. A result below 80% fails the case as a missing required fact.
  - A direct Classification eval checks Edition categories and both text proposals from fixed evidence.

## Impact

The change affects stored Event records, catalog operations, ingestion role inputs and completion rules, public reads and website metadata. Rules for category reuse between Editions remain unchanged.
