---
type: Known issue
title: Reader output limit stops an add run
description: Reader reached its output limit on a festival page and collection made more calls after the fatal error.
status: draft
tags: [cost, ingestion, research]
---

# Reader output limit stops an add run

On 2026-11-21, the Festival de Los Sentidos add retrieved the La Roda website home page. Reader reached its output limit of 12,000 tokens and ended with finish reason `length`. The attempt reported `model_failed` and saved zero catalog changes. The attempt ID is `069ae2a1-61b5-4a9f-9106-29ffd2beb935`.

After the fatal error, Research started two more `searchWeb` calls and nine more `inspectPage` calls. The recorded OpenRouter cost after the error was $0.02845 of the $0.03824 recorded for the attempt.

On 2026-11-24, change #128 added a guard that blocks new search provider requests after a fatal collection error. A workflow test checks this guard. The current Reader output limit is 12,000 tokens by default. [Research tool](../../src/ingestion/roles/research/agent.ts) · [Workflow test](../../src/ingestion/workflow.test.ts) · [Reader limits](../../src/ingestion/evidence/collection.ts)
