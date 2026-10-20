# Tasks

## 1. Expose the existing signal and request rendered HTML

- [x] 1.1 Expose the non-navigation text length from `extractSource` alongside its current `needsJavascript` signal. Verify `extract.test.ts` covers sparse script-backed pages, short ordinary pages with scripts, JSON-LD, and pages with at least 200 body characters.
- [x] 1.2 Let the Firecrawl adapter request rendered `html` for HTTP 200 fallback while preserving `rawHtml` for HTTP 403. Verify `firecrawl.test.ts` covers both formats, page status, response-size bounds and final public-URL checks.

## 2. Select and report the source

- [x] 2.1 Add the one-attempt HTTP 200 fallback in `readPage` using the existing `needsJavascript` signal, key and deadline. Select a successful render only when its non-navigation text is at least 200 characters. Verify `read.test.ts` covers successful render, short ordinary pages, no key, insufficient time, provider failure, a longer loading placeholder, and unchanged 403 behavior.
- [x] 2.2 When a render is selected, combine rendered and labeled direct Markdown under the existing text limit, and deduplicate safe links under the existing link limit. Verify `read.test.ts` covers direct JSON-LD retention when it fits, links, truncation, provenance and request accounting.

## 3. Documentation and checks

- [x] 3.1 Update `docs/ingestion-process.md` to explain the trigger, render selection and partial-result behavior. Sync the owning source-workflow spec when implementation is complete. Verify `npm run docs:check` and `npm run openspec:validate` pass.
- [x] 3.2 Run the focused source-reader test files and `npm run type-check`; confirm the source tool output and report contracts still compile without migration.
