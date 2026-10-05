---
type: Guide
title: Ingestion process
description: A short guide to local festival research and catalog updates.
status: stable
tags: [catalog, ingestion]
---

# Ingestion process

Ingestion finds or refreshes festival facts in the catalog. An owner starts each run locally; there is no scheduled refresh.

## Process at a glance

1. [Start a run](#start-a-run) — choose a festival or existing Event.
2. [Load catalog context](#load-catalog-context) — get current facts and saved links.
3. [Research and propose facts](#research-and-propose-facts) — read pages and suggest edition-specific changes.
   - [Find and read sources](#find-and-read-sources)
   - [Choose facts and editions](#choose-facts-and-editions)
   - [Preserve or replace values](#preserve-or-replace-values)
4. [Validate the proposal](#validate-the-proposal) — check structure and data rules.
5. [Preview or apply](#preview-or-apply) — inspect a dry run or save a fresh run.
6. [Save changes](#save-changes) — write each Event atomically and handle publication.
7. [Review the report](#review-the-report) — see changes, sources, and unresolved questions.

## Start a run

```sh
npm run catalog -- add --name "Festival name"
npm run catalog -- refresh --event EVENT_ID
npm run catalog -- check --event EVENT_ID --event ANOTHER_EVENT_ID
```

`add` researches a festival by name. `refresh` researches one existing Event. `check` uses the same research process for one or more Events. An Event is the continuing festival; each separate edition is an Occurrence. The database must already exist and be migrated. See the [development guide](development.md#local-catalog-research) for setup and options.

## Load catalog context

`refresh` and `check` load current facts and saved links for each selected Event. `add` loads catalog context to check whether the festival already exists.

## Research and propose facts

### Find and read sources

For an existing Event, the run first reads a saved official-site link, or another saved link if needed. For `add`, the model discovers a source by festival name. The agent follows relevant links to answer open questions, searches when those links are not enough, and stops once it has useful facts.

### Choose facts and editions

The model decides which Event and edition each fact belongs to, then returns one proposal with the facts it found. It can suggest dates, venues, prices, and links, but it cannot write to the catalog. It is instructed not to guess dates, prices, or an unannounced next edition; unknown facts can stay out of the proposal.

### Preserve or replace values

Fields the model omits keep their saved values: if it says nothing about a venue, the saved venue stays. A supplied price block replaces all prices for that edition; omitted prices stay as they are.

## Validate the proposal

The system checks the proposal's shape and target IDs. The writer checks data rules, versions, and publication requirements. It can reject an invalid date, but it cannot tell whether a valid date is factually correct.

## Preview or apply

By default, the writer previews changes and rolls them back. The preview is not a saved proposal: `--apply` starts a new research run before saving, so its result may differ. Review the apply report too.

## Save changes

Changes for one Event are saved together or rolled back together. If one proposed value fails validation, no other proposed change for that Event is saved. A normal update keeps a published record published. Complete eligible drafts can publish; incomplete ones stay drafts.

## Review the report

The command reports changes, inspected URLs and retrieval outcomes, and unresolved questions or failures. Successful changes enter private audit history with old and new values; unchanged facts add no entry. Use `--report PATH` to save a private JSON report that also retains the final `modelResponse` before normalization.

The [source workflow specification](../openspec/specs/catalog/source-workflow/spec.md) defines the detailed behavior.
