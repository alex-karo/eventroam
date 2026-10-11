# Proposal

## Why

Visitors use festival size to understand the approximate scale of a gathering. The current capacity field and research instruction instead describe a planned maximum, which can differ substantially from the number of people taking part.

## What Changes

- Define the estimate as approximate festival size in people for an Edition, informed by supported attendance or participant estimates rather than a venue's maximum occupancy.
- **BREAKING**: Rename active `capacityEstimate` contracts to `sizeEstimate` and SQLite `capacity_estimate` to `size_estimate`, without compatibility aliases.
- **BREAKING**: Advance current ingestion/eval reports to version 4 for the renamed fact/operation field; reject historical report versions without conversion.
- Replace public capacity wording with `Estimated size` and explain the Size filter in terms of approximate participant numbers.
- Update ingestion instructions to allow explained approximate estimates, including relevant historical attendance when applicable, without inventing unsupported numbers.
- Preserve existing size bands and unknown-value behavior. Preserve stored numeric estimates during the schema rename as approximate development data; rechecking them uses the new semantics.
- Leave independent attendance metrics, capacity limits, ranges, and public source citations outside this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/records`: Store and validate Edition size estimates under a clear current contract.
- `catalog/source-workflow`: Research approximate participant scale with explained evidence and uncertainty.
- `catalog/publication`: Present estimated size in public Edition details.
- `website/discovery`: Filter and describe approximate festival size using the existing size bands.

## Impact

Affected areas include the Drizzle schema and a new migration, catalog operations/read contracts, research contracts/wire/context/preparation, fixtures, discovery matching, list/preview/detail presentation, adjacent tests, ingestion eval fixtures, and current documentation. Existing migrations and immutable serialized history retain their original field names. No new dependencies or hosted services are required.
