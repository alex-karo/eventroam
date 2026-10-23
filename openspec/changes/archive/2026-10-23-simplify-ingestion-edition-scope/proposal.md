# Proposal

## Why

Ingestion can reject useful findings because classification contains a parent term or research returns duplicate Edition candidates.
The owner selected a smaller research scope, automatic classification normalization, and clearer rules for format and search.

## What Changes

- **BREAKING:** `add` and `refresh/full` cover the Event, its latest completed Edition, and its current or nearest announced future Edition.
- **BREAKING:** `refresh/current` covers only the current or nearest announced future Edition.
- **BREAKING:** Research and editor output use `previousEdition` and `currentOrNextEdition` instead of an Edition array.
- Keep other saved Editions as context for matching, country checks, and classification reuse.
- Store multiple programme dates of one Edition as one range, from its first date to its last date.
- Remove a selected taxonomy ancestor when the final classification also contains its descendant. Keep the writer validation.
- Define `format` through general features of the site and main programme.
- Permit a targeted search for essential missing facts about an Edition supported by inspected evidence. An empty next-Edition slot does not justify search.

Ticket behavior, public deployment, and automatic scheduling are outside this change.
New checks of specific festivals and live ingestion runs are deferred.
Verification uses general contract scenarios and existing model evals with fixed sources and saved tool results.

## Capabilities

### Modified Capabilities

- `catalog/ingestion-workflow`: Use the two Edition roles for add.
- `catalog/refresh-scope`: Define selection, scope, context, and the frozen reference date.
- `catalog/ingestion-updates`: Use fixed Edition slots and constrain editor targets.
- `catalog/source-access`: Permit bounded search for essential missing Edition facts.
- `catalog/ingestion-runs`: Report slot counts and use report version 6.
- `catalog/records`: Keep multiple dates of one Edition under one identity and one date range.
- `catalog/classification`: Normalize redundant ancestors and define general physical-format features.

## Impact

The change affects research and editor schemas, provider adapters, instructions, preparation, reports, Studio projections, and eval consumers.
It also affects the ingestion guide and taxonomy guidance.
The existing transaction writer, publication gates, database schema, and dependencies remain sufficient.
Stored historical reports remain unchanged. Active consumers use the new contract without compatibility adapters.
