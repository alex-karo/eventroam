---
type: Known issue
title: Source and tool errors during ingestion
description: Production add attempts recorded source read failures, rejected tool calls, and a recovered Location error.
status: stable
tags: [ingestion, observability, research]
---

# Source and tool errors during ingestion

On 2026-11-21, the 109 production add reports recorded 1,283 source reads. Of these, 84 failed and 44 were unsupported.

| Result | Recorded reasons |
| --- | --- |
| Failed | HTTP 404 (35), request failure (13), HTTP 429 (10), timeout (7), Firecrawl HTTP 500 (5), HTTP 403 (3), HTTP 406 (3), HTTP 401 (2), oversized response (2), HTTP 500 (1), HTTP 502 (1), HTTP 503 (1), redirect limit (1). |
| Unsupported | Social content (36), unsupported media type (8). |

Logs also recorded two Firecrawl fallback errors, `firecrawl_page_http_302` during Festival de Los Sentidos and `firecrawl_http_400` during Osa do Mar. [Source reader guide](../source-reader.md)

| Tool or stage | Observed error | Result |
| --- | --- | --- |
| Editor source search | The tool rejected 14 of 701 `mastra_workspace_grep` calls across 10 attempts. Editor used file lists, wildcard patterns, and the current directory as paths. The tool requires one exact saved source filename. | Nine of the 10 attempts published. |
| Research web search | Two Festial! calls reached the search tool after the budget was exhausted. Both produced `Research searches limit exhausted`. | Festial! published. Attempt `442a7211-e560-44e3-9721-cfc2ba12f678`. |
| Location validation | The first Love To Rock proposal selected a precision that conflicted with the point type for its previous Edition. The report recorded a validation repair. | The repair passed and Love To Rock published. Attempt `d5631a78-cd2a-44c8-b8fc-97e6afc90c42`. |

For diagnosis, compare tool spans and report repair history with the final catalog outcome. Inspect direct source failures in the saved report. [Saved source evidence](../ingestion-tools.md#saved-source-evidence) · [Source file checks](../../src/ingestion/evidence/saved-pages.ts) · [Report interpretation](../ingestion-process.md#review-the-report)
