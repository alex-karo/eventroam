# Proposal

## Why

Replace Turndown with `@mdream/js` while keeping the source evidence that Research already receives. Include the agreed improvements for page metadata and links without text: the saved festival pages lose dates, venue names, and routes to official evidence in these forms.

## What Changes

- Replace Turndown and its GFM plugin with the JavaScript Markdown converter.
- Keep existing JSON-LD, maps, table rows, image alternative text, time attributes, page regions, and safe inline links.
- Include page-head metadata and the page title as standard YAML from the converter. Accept its default fields and handling of repeated fields. Use only the page-head title and do not add a generated page heading.
- Keep allowed link destinations when their anchors have no text. Use available labels, then the destination itself.
- Check evidence preservation against the saved 50-page corpus and the 11-page Firecrawl comparison. Keep small, permanent regression fixtures in the test suite.
- Refresh main eval Markdown through the production reader and run the five main cases. Keep their tasks and scoring rules. Capture real pages again when original HTML is missing, and retain Glastonbury as a synthetic scenario, as selected by the owner.

The owner selected this scope in this chat. Hidden content, application data in scripts, OCR, response decoding, rendered-fallback rules, direct/rendered deduplication, and broader cleanup are outside this change.

## Capabilities

### New Capabilities

None. These additions belong to the existing source-access capability.

### Modified Capabilities

- `catalog/source-access`:
  - **Before**: The spec requires available page facts, inline links, table rows, regions, and map context. It does not define ordinary head metadata or a label fallback for empty anchors. The implementation reads the first title anywhere and drops anchors without text or image alt.
  - **After**: The reader also returns page-head metadata as YAML and allowed anchor destinations without text. Repeated metadata fields use the last nonempty value. The page title appears in YAML without an added heading. Existing source bounds and evidence contracts continue to apply.

## Impact

The work affects the HTML path in `src/ingestion/tools/read-page/extract.ts`, its tests, and focused reader integration tests. Replace `turndown`, `turndown-plugin-gfm`, and `@types/turndown` in the package manifest and lockfile. Remove the local GFM type declaration. Keep Cheerio for source preparation and maps.

Update `docs/source-reader.md` and the owning spec when implementation is complete. The model response keeps its existing fields. Markdown gains YAML metadata and previously omitted links; formatting can change. No database or catalog schema change is required.

Main eval source files, capture provenance and `docs/ingestion-evals.md` also change. Raw HTML and full reader results stay local. The eval runner and scorers do not change.
