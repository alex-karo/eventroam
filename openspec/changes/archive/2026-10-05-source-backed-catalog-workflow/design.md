# Design

## Context

The owner starts local festival research through the catalog CLI. The model reads sources and proposes catalog facts; the catalog writer keeps structural rules, transactions, versions, receipts, and audit history. See the [proposal](proposal.md) and [source-workflow spec](specs/catalog/source-workflow/spec.md).

## Goals / Non-Goals

**Goals:** one model answer per run, direct catalog writes, bounded research, stable record identity, atomic dry-run and apply, attributable reports.

**Non-Goals:** host verification of source meaning, citations, source authority, contradictions, or supersession; automatic feedback rounds; temporary catalog copies; server execution, scheduling, review queues, or automatic recovery.

## Decisions

### 1. The model decides facts; the host writes them

```text
Command → load catalog context → research agent → schema/target adapter → catalog writer → SQLite
```

One Mastra agent has `readSource` and `discoverSources` tools, without write access. It chooses sources, Event identity, editions, facts, prices, classifications, and links, then returns one structured candidate. The host does not ask it to revise a candidate after validation. Semantic quality is measured by fixed-source model evals and live review of reports.

The adapter validates the response schema, limits changes to the requested Event, preserves omitted fields, and maps proposals to writer operations. It does not inspect citation text, classify authority, enforce supersession, or trial-apply independent groups. An invalid catalog operation fails and rolls back the whole item transaction. The writer retains date/location constraints, taxonomy scope, versions, no-op detection, unique links, operation receipts, and audit changes.

The CLI retains `add`, `refresh`, and `check`, with Event IDs as the only existing-record targets. It does not accept `--owner` or `--occurrence`; audit entries retain the fixed `catalog-research` actor. Dry-run remains the default. It executes the same writer transaction on the catalog connection and deliberately rolls it back after collecting receipts and changes. Apply commits that transaction. The command opens a writable connection in both modes. An ordinary apply after a dry-run researches again and may produce a different candidate. Withdrawn records require explicit `--republish`.

### 2. Bounded source reading

`readSource` returns attempted/final URLs, retrieval time, method, status, bounded Markdown, links, and completeness. It reads sources through bounded HTTP only; sparse script-driven HTML is partial with `javascript_required`. Facebook and Instagram content retrieval remains unsupported while saved links remain usable. `discoverSources` uses the OpenRouter Exa plugin and returns candidate URLs; the agent reads destinations when needed.

The agent receives all saved links with owner/edition context. For targeted refresh/check, the host initially reads the first official-site link, or the first saved link. Add begins with a festival name and discovers a source. The prompt asks for a small reading plan, normally at most four distinct page attempts, and for edition-specific interpretation of dates, locations, prices, and ticket status. Page text is untrusted data. HTTP requests retain public-address, redirect, response-size, and budget limits.

The default model is `openai/gpt-6-luna` through OpenRouter. `OPENROUTER_MODEL` and `OPENROUTER_REASONING_EFFORT` can override it; omission selects medium reasoning. `OPENROUTER_SERVICE_TIER=flex` opts both research and discovery requests into Flex capacity; omission keeps standard routing. The output allowance defaults to 16,000 tokens per call. Model, search, page, time, input, and output limits still apply. Provider-reported token and cost details are recorded when available.

### 3. Candidate and price contracts

A candidate has an optional existing `eventId`, Event name and optional summary; editions have keys, years, and statuses. It may propose occurrence claims, complete edition price blocks, links, and unresolved observations. No source reference, excerpt, organizer proof, ticket referrer, or supersession object is required. The model is asked to distinguish programme from adjacent camping/sales windows, a whole-edition ticket status from one offer, capacity from attendance, and historical from announced editions.

An omitted claim leaves the stored value unchanged. `termIds` adds assignments; `removeTermIds` removes them. A supplied price block replaces the whole variant list and typed primary price. Variant amounts use major units; typed primary prices use integer minor units for full-programme admission. A failed or incomplete price extraction should lead the model to omit the block. The host validates the price structure but does not choose a price or verify its source. Existing public pages continue to display only the typed primary price.

The adapter proposes publication when the resulting record has structural dates, country, a venue/locality/area, and in-scope taxonomy. The writer applies the final publication gates. Missing required facts leave drafts.

### 4. Reports and evals

Reports include record outcomes, old/new values, inspected URL/status/time, model and prompt versions, limits, token/cost usage, observations, and write errors. They retain the final model text and unnormalized object as `modelResponse`, separately from host-generated operations, including validation/write failures. Missing output is null. They do not copy full pages, prompts, credentials, transport metadata, or sessions. Audit entries retain actor, an initiating owner when supplied, operation key, and old/new values atomically.

Five fixed-source eval cases test required and forbidden catalog mutations. Citation-coverage assertions have been removed because the candidate no longer carries citations. Eval correctness is an observed property of the model, not an apply gate. Live validation remains opt-in on copied catalogs, with manual fact review and a separate empty catalog for add.

## DB schema changes

`occurrences.price_details` is a JSON array defaulting to `[]`. `ticket_availability` supports `unknown`, `available`, `sold_out`, and `closed`. Existing IDs, versions, foreign keys, indexes, and immutable audit triggers remain intact.

## Risks / Trade-offs

A plausible but wrong model fact can be published when it passes structural checks. A wrong Event or edition association within an allowed target can also be written. Fixed-source evals and owner review of local reports reveal these mistakes after or before apply, but the host does not verify source meaning. Network safeguards remain necessary because the model chooses URLs.

## Migration Plan

Before live experiments, make a consistent SQLite backup and verify integrity. Use a separate full working copy for refresh/check and an empty migrated catalog for add. Apply corrections through audited operations or restore the verified backup if needed. No temporary database copy is created for each research round or dry-run.
