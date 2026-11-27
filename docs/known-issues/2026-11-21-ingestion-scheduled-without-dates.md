---
type: Known issue
title: Missing dates in scheduled Editions stop ingestion
description: Two plans set a scheduled status without a complete date range and failed before the write.
status: draft
tags: [catalog, dates, ingestion]
---

# Missing dates in scheduled Editions stop ingestion

On 2026-11-21, General found conflicting dates for two past 2026 Editions. It left the dates empty and selected `scheduled`. Editor passed both plans. Final validation rejected each plan as `invalid_plan` at `previousEdition.fields.dates`. Both reports show zero planned operations and zero receipts.

| Request | Attempt ID |
| --- | --- |
| Icónica Santalucía Sevilla Fest | `1ba857ef-dd87-401f-b193-9394c4303e4c` |
| Festival Osa Do Mar | `7055b7b9-fff0-4359-b040-7109e31269e2` |

The schedule rule requires both a start date and an end date for `scheduled`. The final guard checks the combined dates and status, including saved values that the plan keeps. The repository tests cover rejection before write. [Proposal validation](../ingestion-process.md#validate-the-proposal) · [Catalog plan tests](../../src/ingestion/catalog-plan.test.ts)
