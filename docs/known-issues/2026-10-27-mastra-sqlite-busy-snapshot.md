---
type: Research
title: Mastra eval storage snapshot failure
description: Known SQLITE_BUSY_SNAPSHOT failure, related Mastra fixes, and pending checks.
status: draft
tags: [evals, storage, mastra]
---

# Mastra eval storage snapshot failure

Observed on 2026-10-27 with `@mastra/core 1.74.0`, `@mastra/libsql 1.25.0`, and `@libsql/client 0.18.0`. Full test runs can fail in Mastra storage while isolated reruns pass. The editor-only integration test logged score writes that failed after five attempts, followed by a failure in `ExperimentsLibSQL.updateExperiment`. The error has primary code `SQLITE_BUSY`, extended code `SQLITE_BUSY_SNAPSHOT`, and numeric code 517. Scores can be missing even before the experiment update fails. See the [validation record](../../openspec/changes/redesign-ingestion-evals/tasks.md).

[SQLite defines this error](https://sqlite.org/isolation.html) as a write attempted from an old read snapshot after another connection commits. Waiting alone does not refresh that snapshot. This explains the error type; the connection or transaction that retains the snapshot in our run is not yet known.

[Mastra PR #26261](https://github.com/mastra-ai/mastra/pull/26261), merged on 2026-10-10, reopens local connections after a busy error and restores their PRAGMAs. The published `@mastra/libsql 1.27.0` contains this change; our installed `1.25.0` does not. It is a candidate fix, not a confirmed fix for this failure. [PR #26143](https://github.com/mastra-ai/mastra/pull/26143) adds retries for Memory writes, a separate storage domain. No matching issue for this Experiments failure was found during the 2026-10-27 search.

Status: unresolved; no code or dependency change. The eval integration tests have since been removed. Next check: try a compatible Mastra update in an isolated environment, run the editor regression group through the CLI, and inspect saved results and scores. Keep the existing policy for exceptional storage failures; add no custom recovery as part of this note.
