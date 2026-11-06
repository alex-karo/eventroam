---
type: Research
title: Studio and CLI evals share a DuckDB writer lock
description: Studio and standalone CLI evals cannot write to the same DuckDB observability file at the same time.
status: draft
tags: [mastra, observability, storage]
---

# Studio and CLI evals share a DuckDB writer lock

The catalog CLI sends add and refresh to Studio. These runs use Studio's open DuckDB store.

With logging or tracing enabled, standalone evals open the same observability file from a separate process. Close Studio before recording evals and reopen it to inspect saved results. See the [eval guide](../ingestion-evals.md#usage-and-storage-failures).

Eval execution still uses local experiment callbacks. Moving it into Studio needs a separate change.
