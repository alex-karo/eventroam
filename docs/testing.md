---
type: Guide
title: Testing
description: Application checks, browser tests, and temporary test data.
status: stable
tags: [development]
---

# Testing

Choose the [common checks](development.md#common-checks) that apply to your change.

CI runs `pnpm run openspec:validate -- --draft` and `pnpm run test:openspec`. Draft mode permits a complete planning prefix and checks existing documents. Full `pnpm run openspec:validate` requires proposal, design, and tasks for each active change, with requirements and a separate Acceptance criteria list in the proposal. Normal validation permits unfinished implementation tasks; archive requires completion. Workflow tests use temporary roots and native OpenSpec without changing project history. See [change checks and archive](change-workflow.md#validate-and-archive-changes).

Run `pnpm run build` then `pnpm run test:site` for the public-site HTTP smoke checks. The smoke runner starts the built app on a free local port with a temporary validated catalog and runtime public origins. It makes HTTP requests with a crawler user agent; it does not start a browser or use an owner database.

## Browser checks

Use the built-in Browser for local UI checks. On macOS, obtain approved execution outside the command sandbox before a shell runner starts full Chrome, including headless Chrome. Do not retry a sandboxed launch after an `_RegisterApplication` or `SIGABRT` startup crash. Stop other local Next.js servers before an E2E run because they share the build directory.

Install the test browser if needed with `pnpm exec playwright install chromium`. Run `pnpm run test:e2e` for desktop and mobile discovery and detail journeys. The runner starts a development server on port 3137 with a temporary fixture database. The default mode disables Mapbox and checks list and map fallbacks. Pass Playwright options after the script name, for example `pnpm run test:e2e --project=mobile`.

For a small real-map check, set `E2E_REAL_MAP=1` and supply `NEXT_PUBLIC_MAPBOX_TOKEN`. The runner and Playwright server forward that token only in this mode. This command loads the local token from `.env` without printing it:

```sh
E2E_REAL_MAP=1 node --env-file-if-exists=.env scripts/run-e2e.mjs e2e/real-map.spec.ts --workers=1
```

The real-map tests need provider access and browser rendering support. Keep the token local. The default suite skips them. See `e2e/real-map.spec.ts` for the scenarios.

UI tests use `e2e/fixtures.ts` to set the analytics choice to disabled before the page loads. This keeps the banner out of unrelated journeys. Banner tests set `showAnalyticsBanner: true` to check the choices and the page layout with the banner open.

## Coverage

Run `pnpm run test:coverage` for unit and integration coverage of application and command TypeScript, including unimported files. E2E, test helpers, declaration files, and child-process coverage from Studio and tracing fixtures are excluded. Reports go to ignored `coverage/`; CI publishes totals and retains the HTML `test-coverage` artifact for 14 days. Coverage thresholds are not enforced. React tests use a per-file `// @vitest-environment jsdom` directive and React Testing Library; other tests use Node.

## Test data

Tests live beside their implementation. Use `testDatabase()` for a fresh migrated temporary database and `testFixtures()` from `src/test/fixtures.ts` for typed builders and inserts. Cleanup is automatic.

| Need | Helper |
| --- | --- |
| Read a migrated vocabulary term | `fx.existingTerm(facet, slug)` |
| Reuse stored Festival terms | `fx.festivalTerms()` or public-scenario helpers |
| Add a custom scenario term | `fx.term(...)`; keep the existing dictionary |
| Build without storage | `fx.build.*` |
| Create a complete public scenario | `fx.publishedEvent(...)` |

Set values that affect the scenario or assertions. Omitted fields receive defaults. Explicit `null` is preserved; `undefined` overrides are ignored. Prefer builders to development fixtures in unit and integration tests. Use fixed responses for source pages. Use direct SQL only for database constraints or deliberately invalid data.

Ingestion tests supply direct role responses through `generateRole` or `generateRoles`. The helpers in `src/test/ingestion.ts` provide current role answers and temporary workflow storage. Set each role response that affects the test. HTTP provider fixtures add the required transport envelope and nullable slots; they do not convert a combined research result into role answers.

## Dependency checks

Run `pnpm run deps:check` to check runtime dependencies in `src/` and `commands/` for circular dependencies, unresolved imports, and production imports of test code. Type-only imports and other dependencies erased by TypeScript compilation are excluded. CI runs the same check.
