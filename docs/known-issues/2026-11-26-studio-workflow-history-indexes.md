---
type: Research
title: Studio can stall while it reads workflow history
description: Two SQLite indexes reduce workflow history query time on a production copy. Verify the result after deployment.
status: draft
tags: [mastra, performance, storage]
---

# Studio can stall while it reads workflow history

Opening `catalog-ingestion` on production took 37 to 39 seconds for several small API responses. In a follow-up, `run-counts` took 5.05 seconds with an empty cache and 3 ms with a cache hit. A parallel `packages` request also took about 5 seconds. The same request took 6 ms on its own.

## Cause

Studio uses the local libSQL file at `CATALOG_WORKFLOW_DATABASE_PATH` for workflow history. The file adapter executes SQLite queries synchronously. With `@mastra/libsql` 1.27.0, `run-counts` scans `mastra_workflow_snapshot` to find `running` and `suspended` runs by JSON status. While the scan runs, the server delays other requests. Recent runs also sorts the matching history by `createdAt` before it returns a page.

Mastra tracks work to limit run listing and count runs without loading their full state. [Mastra issue #29433](https://github.com/mastra-ai/mastra/issues/29433)

## Indexes and results

The release migration adds indexes on `json_extract(snapshot, '$.status')` and `(workflow_name, createdAt DESC)`. It applies them to the workflow database while Studio is stopped. [Release migration](../infrastructure.md#application-containers) · [Index definitions](../../src/ingestion/runtime/migrate-workflow-storage.ts)

On November 26, 2026, the local test used a production copy with 1,427 runs and a 1.14 GB workflow database. The complete release migration took 1.41 s on the first run and 0.58 s on the second run.

| Mastra endpoint | Before | After |
| --- | ---: | ---: |
| `run-counts` with an empty cache | 367.3 ms | 1.05 ms |
| Recent runs for `catalog-ingestion`, first 20 runs | 283.1 ms | 3.25 ms |

Each value is the median of nine local calls to Mastra. The responses matched byte for byte and SQLite used both new indexes.

## Production check

After deployment, open `catalog-ingestion` and check `run-counts` with an empty cache and the first page of Recent runs. Check whether other requests slow down when they run at the same time. At the next Mastra upgrade, use `EXPLAIN QUERY PLAN` to check that the adapter still uses both indexes.
