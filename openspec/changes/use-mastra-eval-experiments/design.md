# Design

## Change size

Small. The runner changes its Mastra entry point and eval summary contract. Existing scorers and acceptance rules stay in place. The installed core version supports inline experiment data and tasks without experiment storage.

This is internal developer tooling. Eval behavior is covered by tests and the development guide rather than product capability specs.

## Approach

Call `runExperiment` with one inline item per case repetition and `maxConcurrency: 3`. Mastra preserves input order; stable item IDs verify each returned result belongs to its input. The task owns a fresh seeded catalog, captured sources, optional editor handoff, ingestion failure recovery, and one `scoreCase` call. Keep its connection cleanup in `finally`.

Mastra owns execution and scorer collection. Remove the outer workflow, step schemas, workflow registration, and shared output map. Keep the inner ingestion workflow unchanged. Disable experiment and score persistence; JSON remains the eval export.

## Contracts

Replace `mastra` with native experiment summary metadata, excluding its raw `results`. Project returned items into the existing case report rows and add native `scorers`. Preserve case scores, diagnostics, provenance, input ordering, and ingestion report fields. Reject missing/failed task results or failed scorer execution rather than exporting a successful acceptance. Do not export raw framework exception messages or stacks.

Experiment execution success does not imply eval acceptance. Keep `score.passed` and the CLI exit decision unchanged. Do not add retries or another timeout; ingestion already owns the model deadline and budget.

## Risks and validation

- A completed task may fail assertions: exercise research-only and tool-use-only failures and verify nonzero CLI status despite successful experiment execution.
- Repetitions can finish out of order: check ordered rows and isolated tool calls, diagnostics, and native scorer results.
- Persistence recovery must retain available facts and run IDs: retain the existing offline real-ingestion failure tests.
- Framework failures must not disappear: check task and scorer failure handling without model calls.

Update the development and structure guides. Run eval tests, type checking, lint, dependency checks, formatting, docs checks, and OpenSpec validation.
