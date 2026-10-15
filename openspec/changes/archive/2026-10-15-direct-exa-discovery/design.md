# Design

## Context

OpenRouter discovery extracts citation URLs/titles and incurs search and model charges. Research findings pass through an editor; report v5 aggregates research, editor and discovery usage. See proposal.md for scope.

## Goals / Non-Goals

**Goals:** Fewer redundant searches, clearer names, useful highlights.

**Non-Goals:** Provider/mode, credential, accounting, report, database or research-scope changes.

## Decisions

### Rename together

Rename active tools and directories to `readPage`/`tools/read-page` and `searchWeb`/`tools/search-web`, including factories, contracts, dependencies, registration keys/IDs, tests, prompts and log/trace selectors. Update current docs/spec references; leave archived artifacts and stored observations unchanged. No aliases.

### Preserve the provider

Keep OpenRouter chat completions and `{ id: "web", engine: "exa", max_results }` without `mode`. Preserve configured model/reasoning/service tier, credentials, budgets, result/response limits, timeout and retries. Retain discovery model usage and report v5 aggregation/completeness; final-failure attempt accounting is outside scope.

### Return citation highlights

Map optional `url_citation.content` to `highlights: string[]`: one trimmed excerpt, at most 2,000 characters; absent/non-string/blank content gives `[]`. Do not split `[...]` or use synthesized model text. Preserve HTTP(S) URL deduplication, annotation order, 300-character titles and empty-result behavior. Exclude excerpts from technical log/trace payloads.

[OpenRouter documentation](https://openrouter.ai/docs/guides/features/plugins/web-search), checked 2026-10-15, confirms optional citation content carries Exa highlights. Destination inspection remains required before using facts or confirming identity.

### Keep conditions in the tool description

> Find sources only when no official source is known, it is inaccessible or wrong, or known sources conflict materially with the original event identity/dates or each other. Use known links and prior results first. Missing announcements or fields alone do not justify search. Highlights are leads; verify facts with readPage.

Research prompt:

> Follow relevant known links first. Use searchWeb only under its stated conditions.

Initial add discovery is conditional on no known official source. Policy is model instructions, not a host gate. Preserve partial findings/unresolved identity after failed recovery and editor ownership of write decisions. Missing announcements after accessible official checks alone do not make research unfinished.

## Risks / Trade-offs

Redundant calls and misleading highlights remain possible: use focused evals and require page inspection. Renaming spans observability and editor integration: retain their regression coverage.

## Migration Plan

Move active callers, fixtures and docs together; extend candidate contracts. No configuration/data migration. Rollback restores prior names, contract and instructions.
