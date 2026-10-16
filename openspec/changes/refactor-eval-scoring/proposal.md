# Proposal

## Why

Eval scoring mixes assertions, expected failures, and Mastra presentation. The CLI can show two perfect mutation scores for a failing case without explaining the research or tool-use failure.

## What Changes

- Separate mutation matching, research checks, and expected-failure checks from score aggregation.
- Compute each case score once and share it with Mastra, the JSON report, and CLI diagnostics.
- Explain failed checks, including the conditions of an expected research failure.
- Preserve assertion semantics, numeric scores, pass/fail decisions, fixture selection, and provider behavior.

## Capabilities

### Modified Capabilities

- `catalog/source-workflow`: Eval diagnostics explain failed dimensions consistently across report consumers.

## Impact

Changes are limited to eval scoring, its runner adapter, CLI presentation, offline tests, and documentation. No new dependencies, model calls, schema migration, or fixture-language changes are needed.
