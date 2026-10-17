# Tasks

## 1. Local capture writer

- [x] 1.1 Add the per-attempt, opt-in file writer described in the design. Verify focused tests cover disabled mode, ordered private files, exact JSON/Markdown content, directory and file failures, disabled subsequent capture, and a bounded non-fatal write diagnostic through a closed stderr stream.

## 2. Agent-visible capture points

- [x] 2.1 Capture the initial `inspectedSources` projection from the same value used in the research prompt. Verify a focused test compares the saved projection with the prompt, including truncation.
- [x] 2.2 Capture each final `readPage` and `searchWeb` return from the tool wrappers. Verify focused tests compare saved results with actual returns, including concurrent calls finishing out of order, cache reuse, remaining budget, and no raw provider content.
- [x] 2.3 Document the switch, output location, sensitive local content, and inspection flow in the development and ingestion guides. Verify `npm run docs:check` passes.
- [x] 2.4 Sync the completed behavior into the owning `catalog/source-workflow` main spec. Verify `npm run openspec:validate` passes.

## 3. Integration checks

- [x] 3.1 Run focused ingestion tests, type checking, and lint. Verify opt-in preview/apply workflow behavior and that existing reports, logs, traces, and catalog outcomes retain their content and failure boundaries.
