---
type: Research
title: Mastra eval storage snapshot failure
description: Archived after a Mastra update and 100 scored attempts without storage failures; a separate concurrency check was not run.
status: stable
tags: [evals, storage, mastra]
---

# Mastra eval storage snapshot failure

Observed on 2026-10-27 with `@mastra/core 1.74.0`, `@mastra/libsql 1.25.0`, and `@libsql/client 0.18.0`. Full test runs could fail in Mastra storage while isolated reruns passed. The editor-only integration test logged score writes that failed after five attempts, followed by a failure in `ExperimentsLibSQL.updateExperiment`. The error has primary code `SQLITE_BUSY`, extended code `SQLITE_BUSY_SNAPSHOT`, and numeric code 517. Scores could be missing even before the experiment update failed. See the [validation record](../../../openspec/changes/archive/2026-10-27-redesign-ingestion-evals/tasks.md).

[SQLite defines this error](https://sqlite.org/isolation.html) as a write attempted from an old read snapshot after another connection commits. Waiting alone does not refresh that snapshot. This explains the error type; the connection or transaction that retains the snapshot in our run is not yet known.

[Mastra PR #26261](https://github.com/mastra-ai/mastra/pull/26261), merged on 2026-10-10, reopens local connections after a busy error and restores their PRAGMAs. The published `@mastra/libsql 1.27.0` contains this change; the installed `1.25.0` at the time did not. It was a candidate fix, not a confirmed fix for this failure. [PR #26143](https://github.com/mastra-ai/mastra/pull/26143) adds retries for Memory writes, a separate storage domain. No matching issue for this Experiments failure was found during the 2026-10-27 search.

## Archive decision, 2026-11-02

Archived at the owner's request. The [current dependencies](../../../package.json) use `@mastra/core 1.79.0` and `@mastra/libsql 1.27.0`. The [final repeated measurement](../../proposals/source-evidence-quality-log.md#final-repeated-measurement) returned all 100 scored outputs with no task or storage failures, including 14 Editor regression attempts. The earlier eval integration tests have been removed.

The error did not recur in that measurement. This does not prove that the upstream change fixed the original failure: a separate concurrency check was not run, and the original connection or transaction cause remains unknown. Keep native storage errors and warnings; no custom recovery is added by this archive decision.
