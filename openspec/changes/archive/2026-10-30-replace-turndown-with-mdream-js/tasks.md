# Tasks

## 1. Replace the HTML converter

- [x] 1.1 Add pinned `@mdream/js@2.0.3` and update the lockfile with the pinned package manager. Verify installation before replacing the converter.
- [x] 1.2 Replace Turndown in the existing extractor. Preserve image alt, time attributes, and region comments as described in the design. Use default GFM tables without the old custom cell rule. Run the existing extraction tests; check table facts and links within their rows instead of exact semicolon separators. Extend tests only for missing application cases that fail with the new converter.
- [x] 1.3 Remove the old converter packages and local GFM declaration, and update the lockfile. Verify type checking and no remaining source imports of the removed packages.

## 2. Preserve metadata and anchors without text

- [x] 2.1 Enable the standard `frontmatterPlugin()` on the prepared document with its head and body. Keep its YAML, default fields, and handling of repeated fields without a separate metadata collector. Remove the separate title lookup and generated page heading. Check YAML field names and values, the head title without an added heading, body heading order, extra default fields, one repeated field with a final empty value, an absent head, embedded titles, and retained body text when years differ; run the extraction suite.
- [x] 2.2 Select and insert missing labels in one pass after cleanup and the sparse-page measurement, using the delta spec's fallback order. Do not add a separate label capture before cleanup. Test accessible labels, title fallback, image-only links, destination fallback, repeated labels, and unsafe URLs. Test sparse inputs on both sides of 200 characters with long metadata and generated labels; run the extraction suite.
- [x] 2.3 Extend the existing direct/rendered JSON-LD test in `read.test.ts` with direct head metadata and a rendered body that has no head metadata. Assert the YAML field and value inside the direct-response section, and run the reader suite.
- [x] 2.4 Update `docs/source-reader.md` for YAML metadata, its source provenance and handling of repeated fields, the page title in YAML, link fallback, and its hidden-content limit. Verify the text against the delta scenarios and run `pnpm run docs:check`.
- [x] 2.5 Sync the accepted delta to `catalog/source-access` after implementation. Run `pnpm run openspec:validate` and confirm the main spec describes the implemented behavior.

## 3. Check the combined change

- [x] 3.1 Replay the saved 50 direct pages and the saved Firecrawl comparison through worktree code without live requests. Deliver a local comparison of protected facts, labelled links, map references, structured data, fallback decisions, full-output size, and projection truncation. Review newly missing evidence against the cases in the design.
- [x] 3.2 Run the focused extraction, reader, map-reader, and network suites, `pnpm run type-check`, `pnpm run deps:check`, and the Studio build. Report passed checks and any unavailable build or environment check separately; confirm the package removal and new import work outside the test runner.
- [x] 3.3 Refresh main eval Markdown through the production reader. Capture real pages again and save their raw HTML locally; retain Glastonbury as an explicit synthetic scenario, with a separate real History 2025 capture. Keep tasks and scoring rules, and update provenance and the eval guide.
- [x] 3.4 Run all five main eval cases once on the refreshed dataset. Inspect failed checks and distinguish agent, provider, fixture and scorer failures. Report the experiment ID and quality dimensions without comparing old dataset scores as if the inputs were unchanged.
