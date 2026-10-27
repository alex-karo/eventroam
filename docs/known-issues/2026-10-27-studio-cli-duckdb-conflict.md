---
type: Research
title: Studio and CLI share a DuckDB writer lock
description: Local observability prevents Studio and CLI from using the same DuckDB file at the same time.
status: draft
tags: [mastra, observability, storage]
---

# Studio and CLI share a DuckDB writer lock

Studio and the catalog CLI open the same DuckDB observability file in separate processes. They cannot write to this file at the same time. This affects CLI research and eval runs that use the shared store.

Current workaround: close Studio before the CLI run, then reopen it to inspect the saved traces, logs, and metrics. See the [development guide](../ingestion-tools.md#local-trace-inspection).

Proposed solution: run catalog ingestion through the running Mastra server with the native Mastra Client or [`mastra api workflow run start`](https://github.com/mastra-ai/mastra/blob/main/docs/src/content/en/docs/workflows/overview.mdx). The server would own execution and the DuckDB store; the CLI would be a client. This requires a running server. Eval execution needs a separate review because it currently uses local experiment callbacks.

If independent CLI execution must remain, a shared server backend is another option. Mastra supports metrics with [`PostgresStoreVNext`](https://mastra.ai/docs/observability/overview), but this adds a database service.

Status: unresolved. No execution or storage change is made by this note.
