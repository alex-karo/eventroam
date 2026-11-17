# Tasks

## 1. Local duplicate check

- [x] 1.1 Add the private name/alias read and matching rule from [Start with the name or alias](design.md#start-with-the-name-or-alias). Test canonical names, aliases, phrase boundaries, URL-only name text, repeated matches for one Event, and Events without official links.
- [x] 1.2 Add the distinct-country read, optional country/URL parsing, and [decision rules](design.md#make-one-deterministic-decision). Test a name-and-country match without a URL, another path on the same host, a full URL with unknown country, country conflicts, unknown-country competitors, and URL resolution of same-name candidates. Cover clear country codes, code text inside names or URLs, unsupported wording, and several explicit countries.
- [x] 1.3 Add the early return to `loadResearchContext`. With a small identity fixture, test that both support forms retain the fixed date and match details without full catalog, full Edition history, or taxonomy reads. Verify that an unmatched add and refresh keep their current context.

## 2. Workflow result and reports

- [x] 2.1 Add the optional report field and early-skip report behavior from [Contracts](design.md#contracts). Verify country and URL support records, version 7 compatibility, empty source/model/write data, and successful status for an early skip. Preserve the current failure behavior for report, workflow, and persistence errors.
- [x] 2.2 Connect the context match to the existing workflow skip diagnostics and terminal-report path. Cover both support forms in preview and apply tests. Verify the matched Event ID in the report and durable run row, zero source/search/Reader/model/writer calls, and successful finalization. Verify that an unresolved note reaches collection unchanged and that an ordinary General duplicate still works.
- [x] 2.3 Update the catalog-sql skill, its add-batch query, the `add_events` description, and catalog assistant instructions as described in [Update report consumers](design.md#update-report-consumers). Extend the existing query tests to distinguish country-supported skips, URL-supported skips, source-confirmed duplicates, and failed or unknown attempts.
- [x] 2.4 Update `docs/ingestion-process.md` and `docs/ingestion-tools.md` for name-first lookup, optional country/URL support, clear country-code input, report meaning, and the exception to the search-leads rule. Check their workflow and report descriptions, then run `pnpm run docs:check`.

## 3. Integration checks

- [x] 3.1 Run the focused identity/context tests and existing workflow, run-persistence, scoped-refresh, queued-workflow, and catalog-query tests with fake source/model dependencies. Run `pnpm run type-check`, `pnpm run lint`, `pnpm run docs:check`, and `pnpm run openspec:validate -- skip-known-adds-before-reader`. Verify the CLI and queued-job success consumers accept an early skip without treating absent source work as a failure.
