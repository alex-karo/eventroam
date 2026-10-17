# Proposal

## Why

The eval runner wraps each case in a one-step workflow and keeps a second result map for reporting. Mastra experiments can execute a task and return each result with its scorer output directly.

## What Changes

- Replace the outer eval workflow with an experiment task using inline fixtures.
- Remove the shared output map and keep one score per case repetition.
- Preserve assertions, diagnostics, acceptance, selection, source replay, and ingestion failure recovery.
- **BREAKING**: Replace the eval report's `mastra` aggregate block with `experiment` execution metadata and per-case `scorers`. No compatibility projection is retained.

## Capabilities

No product capability requirements change. This is internal eval tooling; its behavior is covered by tests and the development guide, with implementation decisions recorded in design.md.

## Impact

Eval runner, offline integration tests, and development documentation. No dependency, catalog storage, ingestion report, or fixture schema change. Model behavior and the inner ingestion workflow stay the same.
