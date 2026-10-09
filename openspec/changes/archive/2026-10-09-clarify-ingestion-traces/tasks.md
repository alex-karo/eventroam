# Tasks

## 1. Identity and sanitization

- [x] 1.1 Add bounded identity/label helpers for context and committed mutations with separate editionKey/year; test modes, canonical names, year corrections/nulls, stable IDs, overflow and labels without apply or found roles.
- [x] 1.2 Set hideInput/hideOutput=false; require the allowlist processor to clear raw payloads and rebuild bounded root/source projections. Test every lifecycle event, unknown fields/types, SDK/config credential exclusion, UTF-8 byte/list/total limits with Unicode-safe truncation, span dropping and unavailable-processor fallback; keep logs disabled. Separate public URL/name markers from private payload/credential sentinels.
- [x] 1.3 Using the existing offline mock-provider fixture and a temporary store, verify reopened/exported traces retain safe source/root input/output and both name fields, excluding raw tool/agent/model/unknown payloads and logs.
- [x] 1.4 Document labels, edition roles, field exclusions and URL/size limits; check examples against tests and run `npm run docs:check`.

## 2. Source diagnostics

- [x] 2.1 Attach read diagnostics before method/truncation signals are lost; test nonthrowing failures, all methods/outcomes, caching, redirects and truncation without changing model-visible contracts.
- [x] 2.2 Attach existing search query, candidate URLs/counts and execution status; test empty/not_run/failure, preserved paths/query/fragment (including token-like values), character-safe truncation and bounds with unchanged budgets.
- [x] 2.3 Document source inspection and technical versus retrieval status; compare with saved mock spans and run `npm run docs:check`.

## 3. Run lifecycle

- [x] 3.1 Move ownership to runCatalogResearch and nest the agent via tracingContext.currentSpan, including initial retrieval; extend the existing offline mock-provider fixture through apply workflow runs to test one root per Event. Dry-run, injected generateCandidate and disabled paths must skip all tracing initialization, including nested tracing; add no test tracing API.
- [x] 3.2 Copy report researchStatus/outcome; retain native technical status, validation, writeState, fixed errorCode and one committedOperationCount. Derive committed edition summaries from returned CatalogItemResult and context without writer hooks; test report reuse, absent reports, pure projections and apply outcomes against catalog effects.
- [x] 3.3 Finalize after report construction, then end/flush/shutdown; test context/report exceptions, post-commit failure, unknown disposition, abort, fresh-process persistence, deadline crossing and tracing init/export/flush/shutdown failures.
- [x] 3.4 Document apply-only tracing, unchanged report/run-record contracts, outcome semantics and accepted tracing limits; verify against tests and run `npm run docs:check`.

## 4. Integrated acceptance

- [x] 4.1 Extend the existing mock-provider with network-blocked apply fixtures for partial historical creation, structurally accepted mistaken facts, and recovered initial-read failure in temporary catalogs/trace stores; verify outcomes, semanticValidation=not_run and incomplete usage/null cost.
- [x] 4.2 Compare tracing on/off across the outcome matrix; verify identical decisions, model contracts, operations/catalog effects, budgets/retries and exit semantics except existing per-run IDs/timing; verify report shape and durable run persistence stay unchanged, plus no disabled/dry-run/injected-path trace records or persisted SDK/config credentials, headers or full payloads.
- [x] 4.3 Use built-in @Browser with separate fixture Studio/store: verify visible Event/year roles/mode/result, source failure reason and terminal write outcome. Leave running Studio at port 4111 and existing stores untouched.
- [x] 4.4 After acceptance, sync the main spec and update operational/progress docs/index; run `npm run openspec:validate`, `npm run docs:check`, type-check, lint and relevant tracing/source/workflow/CLI/report tests. No paid ingestion or main-catalog writes.
