# Tasks

## 1. Explicit ingestion execution

- [x] 1.1 Replace inline orchestration with six named Mastra steps while preserving the durable host boundary; verify type-check and existing workflow/run regressions.
- [x] 1.2 Add real-engine regressions for phase order, safe graph data, no replay after failures and concurrent run isolation; verify the focused test suite.
- [x] 1.3 Document step responsibilities and execution boundaries in ingestion/process and project structure guides, link this change in the index, and verify docs:check.

## 2. Integration verification

- [x] 2.1 Run repository tests, type-check, lint, format checks on changed code, docs:check and openspec:validate; resolve regressions and record results.

Verification: 406 tests across 36 files passed, including 56 focused workflow/run tests. Type-check, repository lint, formatting of changed TypeScript, docs:check, openspec:validate and git diff --check passed. Tests used Node 26.10.0/npm 11.19.1 with fixture providers; no live research calls were made.
