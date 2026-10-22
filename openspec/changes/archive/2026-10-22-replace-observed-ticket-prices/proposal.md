# Proposal

## Why

A refresh can read a new Regular full-programme price while another saved category's checkout is blocked. Current instructions preserve the entire old price block, leaving the known Regular price stale.

## What Changes

- When research finds at least one supported ticket price for the selected Edition, it proposes one replacement block containing the offers found in the current check. Unverified saved categories are not copied into it.
- The editor accepts that block as a complete replacement when the evidence belongs to the selected Edition and the base price is supported. A blocked check remains unresolved without blocking the supported price update.
- With no supported price, research omits the ticket finding and the saved block stays unchanged. Handling a closure-only notice without prices remains a separate policy decision.

## Capabilities

### Modified Capabilities

- `catalog/source-workflow`: Replace prices from observed offers without requiring verification or preservation of every saved category.

## Impact

Update research/editor instructions, the partial-ticket eval, the ingestion guide, and the owning source-workflow specification. Keep the current ticket schema, atomic writer, and structural money validation.
