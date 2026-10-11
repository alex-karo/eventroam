# Proposal

## Why

Research has missed history and readable ticket information, and confused festival websites. Refresh needs explicit assignments, website recovery, and atomic country guards.

## What Changes

- **BREAKING:** Keep one batch `refresh --event ID [--event ID ...] --scope full|current` (default full); remove `check`.
- Full rechecks all saved Editions; current rechecks one ongoing or nearest future Edition. Both check Event facts/announcements and may add one missing selected Edition.
- Recheck filled and empty facts for errors/updates. Recover and inspect the correct festival website; failed recovery or country conflicts veto the whole refresh.
- Preserve the existing agent output and reason/unresolved semantics. Give the model structured scope/context and selection duties; keep simple host scope bounds and the existing writer audit. Remove the resolver tool/callback/state and mandatory resolution checks. Use prompt `scoped-refresh-v2` and private report v3 without selection/resolution/verification fields or fact counters.
- Remove the entire DB report check with a history-preserving migration; application consumers validate versions.
- Remove the application input-character limit and its configuration/report field; default to 15 model steps with a reserved final response.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Scoped refresh, website recovery, country guards, and private reports.

## Impact

**Depends on:** [rename-occurrence-to-edition](../archive/2026-10-11-rename-occurrence-to-edition/proposal.md), implemented and synchronized in the worktree. Edition code/SQL naming and its migration belong to that change.

Update CLI/Studio, research context/tools, workflow state, reports/evals, and current operating docs. Reuse the shared Mastra workflow, budgets, durable lifecycle, and atomic writer. Existing agent/public shapes, IDs/keys and URLs remain unchanged; historical reports retain their original payloads. Paid ingestion, owner-database execution, and deployment are outside the plan. Exact refresh contracts: [design](design.md#contract-changes).
