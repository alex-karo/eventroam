---
type: Known issue
title: Add can publish a different festival from the same promoter
description: General selected a London festival when the request and its official page identified DnB Allstars Mallorca.
status: draft
tags: [catalog, ingestion, research]
---

# Add can publish a different festival from the same promoter

On 2026-11-21, a production add request identified DnB Allstars Mallorca in Calvià on 1–4 May 2026. The workflow read the official page for that Edition. General then selected the promoter's DnB Allstars Festival in London from its archive. The sources identify two separate programmes.

The attempt published the London 2025 Edition as the only Edition of the new Event. The Mallorca Edition was absent from the catalog snapshot. The report's `eventNameMismatch` field was null. That field compares the observed name with the name of a matched saved Event. This add created a new Event. [General target validation](../../src/ingestion/roles/general/validate-targets.ts)

The attempt ID is `dd86d8ba-78f2-4b42-84a1-91c71765130a`. For diagnosis, compare the request, collected pages, and General's selected targets in the saved workflow. [Saved workflow history](../ingestion-tools.md#workflow-history)
