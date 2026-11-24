---
type: Proposal
title: Ingestion workflow refactoring plan
description: Current ingestion workflow and two open choices for proposal repairs.
status: draft
tags: [ingestion, workflow]
---

# Ingestion workflow refactoring plan

The workflow now uses one rule to select specialists and one decision map for Editor review. The report builder reads the workflow data directly. Two choices remain open for the repair contract.

## Implemented changes

- After the eligibility check, the branches and the join use the same group owners. Classification, Tickets, and Links get their interpretation checks from these groups. A full refresh with a qualifying saved Edition and no selected Edition still assigns Event descriptions and links. [Group assignments](../../src/ingestion/groups.ts) · [Role checks](../../src/ingestion/roles/assignment.ts) · [Scope tests](../../src/ingestion/scoped-refresh.test.ts)
- The repair session returns revised General fields to the workflow. During Editor review, the first targets fix the Edition identity and the latest fields go into the next proposal. [Repair session](../../src/ingestion/repairs.ts) · [Proposal stages](../../src/ingestion/proposal-stages.ts)
- One assessment determines the research status and open questions for the version 7 report. It uses the last repair for each path. The report saves the full repair history in order. [Report builder](../../src/ingestion/report.ts) · [Report tests](../../src/ingestion/report.test.ts)
- `assemble-proposals` and `review-proposals` remain separate workflow steps. Each repair round supplies its own records. Targeted Editor prompts include earlier records for the selected paths. If a targeted review fails, the report keeps the first Editor response and marks only repairs from that round with the error. [Proposal stages](../../src/ingestion/proposal-stages.ts) · [Repair tests](../../src/ingestion/repairs.test.ts)

## Choices that change the repair contract

**Have owners return only the requested groups.** Today an owner sends a full role reply to revise one group. `mergeRevision` finds the requested fields, preserves other fields, and looks for the reason for an omission in `unresolved`. A smaller reply could give a value, evidence, and questions, or an explicit withdrawal with a reason, for each requested path. Apply these replies to the current role data and validate the combined result, including fixed Edition targets and both Location slots. Keep local errors per group so a valid peer can succeed. This removes handling of unrelated reply fields and preserves Editor corrections. It requires revision schemas, prompts, and fixture replies. Pilot it with Tickets. [Current merge](../../src/ingestion/repairs.ts) · [Role invocation](../../src/ingestion/roles/invoke.ts) · [Return tests](../../src/ingestion/repairs.unit.test.ts)

**Give Editor a single decision round.** Editor could approve or reject each submitted group. This removes Editor-initiated returns, targeted prompts, and the rebuild after an Editor return. Field validation can still request repairs before Editor starts, as in the Wacken fixture. In the Roskilde fixture, Editor spots an instalment in the ticket block. Today Tickets removes it and saves the supported full-pass price. With one decision round, rejection would omit that ticket update. Editor would also lose the option to request a missing proposal. Compare recovered fields, incorrect writes, and model calls on the same cases before accepting this trade-off. Use a separate OpenSpec change for either contract option. [Review contract](../ingestion-process.md#preserve-or-replace-values) · [Wacken and Roskilde fixtures](../../src/ingestion/repairs.test.ts)
