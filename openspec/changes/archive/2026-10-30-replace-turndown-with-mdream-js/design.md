# Design

## Change size

Medium. The dependency replacement is local to HTML extraction, but Markdown is evidence for Research. Metadata, link labels, and title output change that evidence. Verification must cover table relationships, regions, JSON-LD, maps, and direct/rendered results. There is no stored-data change.

## Approach

Use `@mdream/js@2.0.3` for synchronous HTML-to-Markdown conversion. This is the exact JavaScript package tested in the local experiment. Keep the current Cheerio parse and preparation in `extractSource`. Add the metadata and link behavior selected by the owner, as defined in the [delta spec](specs/catalog/source-access/spec.md).

The smallest migration replaces the Turndown call and keeps the application's evidence handling. The agreed additions recover page-head claims and links that currently disappear before conversion. They do not require a new reader, rendering service, extraction framework, or model-response field.

The flow is:

1. Parse the response with Cheerio. Extract maps and JSON-LD before destructive cleanup, as today. Leave the head title and metadata for the converter.
2. Apply existing node cleanup and `time[datetime]` handling. Resolve and validate anchors with the existing HTTP(S) and credential policy. Keep the current flattening of nonempty anchor labels.
3. Compute the sparse-page signal from the same cleaned body text used today. Do this before inserting new fallback labels or output-only image text, so new labels cannot suppress Firecrawl. Do not count head metadata.
4. Select and insert missing anchor labels in one pass over the retained anchors. Mark page regions. Convert the prepared document, including its head and body, with `@mdream/js`. Use `frontmatterPlugin()` from `@mdream/js/plugins` without options. Keep image alt text without media URLs. Use the converter's default GFM table output.
5. Keep the converter's YAML and body output, then append the existing `Structured data` section. The existing reader appends maps, combines direct/rendered responses, caches full Markdown, and applies the model projection.

Keep these steps in the existing read-page module. Use small local helpers where needed. Do not add a converter interface or keep a Turndown runtime fallback.

## Contracts

`extractSource` keeps its return shape: `markdown`, `maps`, `needsJavascript`, and `nonNavigationTextLength`. JSON and plain-text branches keep their behavior. `readPage` keeps its current response fields, budgets, status and reason codes, cache, and projection limit.

HTML Markdown adds YAML metadata and previously omitted allowed links. Keep metadata as source claims and retain body text when it differs; extraction does not decide the current Edition. Formatting can change, but factual body text, link labels and destinations, table relationships, and paired region comments must remain usable.

Use the plugin's YAML `title` for the page-head title. Remove the extractor's separate title lookup and generated page heading. Keep body headings in source order. A body or embedded title must not supply the YAML title; this protects the processed Universo page from using a nested video title as the page identity. Do not add an Open Graph title fallback.

Accept the plugin's standard YAML and default field set. For a repeated metadata field, it keeps the last value with a nonempty `content` attribute. Do not collect metadata through Cheerio, keep earlier repeated values, or add a separate `Page metadata` section. Keep the generated YAML as text; no YAML parser, callback, custom field filter, or serializer is needed.

The link label order is body text, image alt, `aria-label`, `title`, then the resolved destination. Read these values from retained anchors after cleanup and the sparse-page measurement. No separate label capture before cleanup is needed. Use Cheerio text setters for generated labels so source strings cannot become inserted HTML. Keep URL queries and fragments; do not enable tracker or fragment cleanup in this change.

## Key decisions

### Keep application evidence handling and use the JS engine

Cheerio already owns maps, JSON-LD, source cleanup, time attributes, URL policy, and region identification. Keep those responsibilities. Mdream owns Markdown syntax and GFM tables. Keep image alt as text and use public hooks for region comments. Use the native button spacing override: the saved Primavera calendar otherwise joins adjacent day numbers. The tested table fixtures keep notes, line breaks, empty cells, and links in their rows with the default output. Do not port Turndown's custom table-cell rule or require its semicolon separators.

Use the package's public plugin hooks for the converter-assigned region attribute. Mark generated comments for each conversion, remove empty pairs, then remove the markers. This keeps literal comments in metadata and code. Retain nesting and source order. Do not use private converter buffers or a second HTML parser. Reuse the current region identification and remove source-supplied marker attributes before assigning them.

The JS package avoids native deployment files and supports public hooks. Remove `turndown`, `turndown-plugin-gfm`, `@types/turndown`, and `src/ingestion/tools/read-page/turndown-plugin-gfm.d.ts` when the replacement passes its focused checks. Keep Cheerio.

### Preserve page context and fallback behavior

Do not enable `withMinimalPreset`, `isolateMainPlugin`, `tailwindPlugin`, or automatic cleanup. The research shows unique dates and links in headers, navigation, footers, and hidden components. This change protects retained regions without expanding hidden-content support.

Keep the 200-character signal and render acceptance rule. New metadata and generated anchor labels are output evidence, not extra body text for that heuristic. Accepted rendered HTML and the full direct response remain combined by `read.ts`, so direct metadata survives when Firecrawl strips the head. Do not merge or deduplicate those outputs in this change.

## Simpler options

A converter-only migration needs fewer tests, but it leaves the agreed metadata and empty-anchor losses. The owner selected both additions. Using raw mdream with a minimal preset would remove existing evidence handling and some useful page regions. The saved corpus does not support that reduction.

Use the existing tests and a small set of regression fixtures. Keep the full saved corpora as an offline acceptance check, not as a new crawler, benchmark service, or permanent test matrix. Do not add a feature flag or compatibility layer for this dependency change.

## Risks and validation

The [research chat](codex://threads/01a182cd-5dfd-78f1-90d4-e9394476bf5f) and its two dated reports are the source for these cases. The reports and raw captures are uncommitted files in the original checkout. This worktree starts from committed HEAD. The plan below records the required cases so it remains understandable without those local files.

| Risk | Focused check |
| --- | --- |
| Table formatting changes hide a lost row relationship | Use the existing table cases for line breaks, inline links, empty cells, and omitted select options. Check text and links within their row; accept default `<br>` separators and spacing. |
| Region hooks add empty comments or break nested regions | Keep existing region fixtures and cover empty and nested regions. Do not assert incidental blank-line differences. |
| Existing evidence is lost during replacement | Use existing map, JSON-LD coordinate-owner, time, URL, and reader tests. Replay Boom dates/coordinates/ticket URL, ZNA structured dates, Own Spirit header date/place, and Psy-Fi status context. |
| The plugin does not receive the head or metadata changes body evidence | Check YAML from a real page head, extra default fields, an absent head, and a nested video title. Confirm the head title appears in YAML without an added heading and body headings keep their order. Keep body text when its year differs. Use one repeated-field fixture, including a final empty value, to confirm the last nonempty value survives. Check Coachella dates, Dekmantel venue, and Strawberry Fields place. |
| Empty-looking links disappear or get invented labels | Cover the Dekmantel SVG ticket link, an Outlook-style accessible label, and an image-only anchor with no label. Keep the URL as the last fallback and check unsafe/credential destinations. |
| New labels change rendering decisions | Compare sparse-page lengths before and after label generation on both sides of 200 characters. Test that long metadata and URL fallback labels do not suppress fallback. Existing body text and rendering rules stay the same. |
| Firecrawl and direct evidence are confused | Replay the existing reader integration with direct head metadata and a rendered body without it. Keep both origins and the direct JSON-LD tail. |
| Packaging or imports fail outside the test runner | Run type checking, dependency checks, and the Studio command build. Confirm the removed packages and declaration have no remaining source references. |

For offline comparison, use the original checkout's `data/research/homepage-markdown-2026-10-28` and `data/research/firecrawl-homepages-2026-10-29`. Replay saved responses through the new worktree code without provider calls. The old replay scripts contain exact-output assertions, so use them as input readers rather than accepting their assertions unchanged. Compare link labels and destinations in Markdown and embedded HTML; a Markdown-only scan previously misreported 12 retained details-block links as missing.

Review all newly missing link destinations and factual probes. Expected gains are YAML metadata and retained-anchor routes. Earlier values of a repeated metadata field need not survive. The saved Woodford, Nibirii, and Own Spirit pages contain such repeats; check useful facts across the full output rather than requiring every meta value. Known hidden/script/image losses remain documented limits, not failed promises of this change. Record full-output size separately from the 80,000-character model projection and map additions. Check truncation and fallback decisions; smaller text or lower CPU time alone does not establish better extraction.

The local 50-page prototype preserved baseline HTTP(S) destinations, structured-data tails, map references, and sparse flags. It saved about 2.3 ms per page with JS, but still emitted empty region comments and extra whitespace. It is feasibility evidence, not a completed implementation or a latency target. Add small permanent fixtures for accepted behavior; keep full captures and one-time comparison output outside Git.

Finish implementation by updating the source-reader guide and syncing the delta to the owning main spec. Run the focused extraction/reader/map/network suites, type and dependency checks, `docs:check`, and `openspec:validate`. Use the pinned toolchain for implementation and report any unavailable check explicitly.

The owner also selected a main eval refresh. These evals replay saved Markdown and do not call the HTML extractor. Capture Roskilde, Wacken and Sziget again through the production HTTP reader, with rendering disabled, because their old HTML is missing. Save raw HTML locally and update source provenance and the fixed capture date. Keep tasks, initial records, geocoding responses and scorers. Keep Afro Nation's empty blocked-source fixture. Preserve Glastonbury's synthetic unannounced-festival scenario: rebuild its ten adapted bodies as explicitly synthetic HTML, then convert them through the reader. Capture the real History 2025 page separately. Keep the synthetic scenario date and record the archive page's actual retrieval time. Run the five main cases once on the refreshed dataset and inspect all failed checks. Do not treat old-dataset scores as a controlled before/after comparison.
