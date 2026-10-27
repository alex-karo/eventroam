# Tasks

## 1. Preserve page map evidence

- [x] 1.1 Extend pure extraction for map references, local context, lazy and noscript iframes, and duplicate references. Verify adjacent extraction tests cover PortAmérica-style markup and ordinary Maps links without changing table extraction.
- [x] 1.2 Extend JSON-LD extraction for Event location and Place coordinates. Verify tests keep multiple objects separate and reject invalid coordinate pairs.

## 2. Read My Maps point data

- [x] 2.1 Add the focused My Maps URL and point parser with small recorded fixtures and source metadata. Verify PortAmérica, Handpicked, and Mountain Music Fest cases, including map years, duplicate representations, malformed data, and polygon display coordinates.
- [x] 2.2 Integrate one-level map reads into the page reader using the existing bounded transport and budget. Verify unique mid reads, request URLs, byte limits, timeouts, retry accounting, page retention after transport errors, and no render or recursive reads. Reuse existing network tests for redirect safety and enforcement of byte and time limits.
- [x] 2.3 Append map Markdown to the page response and preserve map limit reasons and projection truncation. Verify full tool tests expose markers to Research and retain page text on failure. Extend the existing source-session cache test with map Markdown to verify reuse of the complete parent result.
- [x] 2.4 Update the existing ingestion guide to describe automatic My Maps reads and their limits. Verify `npm run docs:check`; update the documentation index only if the document set changes.

## 3. Verify the integrated change

- [x] 3.1 Run focused read-page and source-session tests, `npm run type-check`, and `npm run lint`. Verify all pass without live map requests or catalog writes.
- [x] 3.2 Sync the completed source-access delta to the main spec through the OpenSpec workflow. Verify `npm run openspec:validate` and check the implemented behavior against the scenarios before archive.
