# Proposal

## Why

In the November 9 Dominator run, one Reader quotation had no topics. Ingestion rejected all eight quotations and failed the attempt. Editor also fails an attempt when its decision list has a repairable error. Role checks must state which errors can go back to the agent, which stop the run, and which the application handles locally.

## What Changes

- Give each ingestion role a named validator. Keep role rules and repair instructions separate from retry and group delivery.
- Drop a Reader quotation that has no topics. Keep the other usable quotations and record a source limitation.
- Give Reader and Editor one correction call for a completed answer that fails its schema or response rules. Use the same assignment and include the failed rules.
- Return an unknown Classification term or reuse Edition as an error in the assigned classification group before Editor runs.

## Capabilities

### Modified Capabilities

- `catalog/ingestion-workflow`
  - **Before**. Validation can return a field error to a group owner before Editor. Code stops on unknown Classification terms and reuse Editions. An invalid Editor reply stops the attempt.
  - **After**. Classification receives those group errors. Editor can correct its own invalid reply once.
- `catalog/source-access`
  - **Before**. Partial extraction keeps saved text and valid source support. Code rejects the whole Reader reply when a quotation has no topics.
  - **After**. The source keeps other valid quotations. Reader can correct an invalid whole-page reply once.

## Impact

The ingestion workflow, Reader evaluation, and private diagnostics use the role checks. The catalog schema and write operations keep their current contracts.
