# Proposal

## Why

Separate source research from catalog editing to improve factual decisions and simplify write preparation. Keep the existing transactional writer and remove obsolete or duplicated logic where possible.

## What Changes

- **BREAKING**: research keeps named findings and clarifies null semantics without new evidence fields; classification becomes a complete term-ID finding; one tool-free editor produces explicit accept/set/clear/keep field actions. Rename the shared run time to `currentDate: string`.
- Replace direct research-to-write preparation with a small typed adapter. Preserve target/country guards, publication rules, versions and atomicity.
- Store the editor plan once in report v5, alongside research, errors and actual changes. Include editor usage in existing totals.
- Simplify editor identity: host fixes the Event from the assignment/research and resolves Edition creation or update by editionKey; creation reasons and matching-research guards remain required.
- Remove the source-link depth limit and its tracking/configuration/diagnostics; retain time, agent-step, search and size safeguards.
- Compare five captured-source cases before/after using existing evals. No extra research, correction loops, entity deletion or writer rewrite.

See [design and agent contracts](design.md) for decisions and [tasks](tasks.md) for implementation order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Research evidence, editorial actions, bounded execution and reporting.
- `catalog/classification`: Complete Edition findings preserving unchallenged saved terms.
- `catalog/records`: Free ticket variants may omit currency when amount is zero.

## Impact

Ingestion contracts/prompts, preparation, shared CLI/Studio workflow, reports and evals change. Reuse catalog operations and storage; no database migration or compatibility layer. Preserve current add/refresh and full/current behavior. Reconcile the separate `narrow-current-refresh` proposal if it lands first; do not implement it here.
