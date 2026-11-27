---
type: Known issue
title: Ingestion job logs can hide catalog failures
description: The queue completion log uses the workflow status, which can miss a failed ingestion outcome.
status: draft
tags: [ingestion, observability, operations]
---

# Ingestion job logs can hide catalog failures

On 2026-11-21, all 109 queued add attempts had the native workflow status `success`. Every `Ingestion job done` log had `failed=false`. The catalog recorded four failed attempts. Only two of those four had an `error` on the root span. The two validation failures were in the report output.

Studio sets the queue log's `failed` field from workflow execution. Use `ingestion_runs.status` and `report_json.outcome` to count ingestion failures. Join each job to its attempts with `job_id`. Inspect the saved report errors for the cause. [Studio job execution](../../src/mastra/ingestion.ts) · [Queue diagnostics](../ingestion-tools.md#background-execution) · [Trace inspection](../ingestion-tools.md#local-trace-inspection)

The saved chat tool results identify the commands that created both batches. The 109 root spans have no user, resource, or request ID. The audit found no Eventroam request records in the available ingress logs for this date. The available records are insufficient to identify the caller or IP address.
