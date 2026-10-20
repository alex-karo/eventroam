# Design

## Change size

Medium. The change joins the existing HTML signal, provider retrieval, source extraction and research-budget accounting. It adds no dependency, stored data or public tool field. The main uncertainty is whether Firecrawl's HTML output exposes the rendered content on a given site.

## Approach

The source reader first performs its current bounded HTTP request. For a successful HTTP 200 HTML response, it reuses `extractSource().needsJavascript`: a script other than JSON-LD is present and the non-navigation body text is shorter than 200 characters. The reader tries Firecrawl once for that signal when `FIRECRAWL_KEY` is configured and at least one second remains in the shared deadline. See the [proposal](proposal.md) and [source delta](specs/catalog/source-workflow/spec.md).

This deliberately permits a short ordinary page with an analytics script to trigger a render request. A second classifier with app-root names and placeholder phrases would be brittle and more costly to maintain. The existing signal already marks such sparse pages partial; this change uses it to request more content. JSON-LD remains available in the direct extraction but does not veto a render attempt because it may omit page details.

## Contracts

`extractSource` keeps its current Markdown, links and `needsJavascript` output and also exposes the non-navigation text length used by the existing signal. Its outward `ReadPageResult` and model tool output stay unchanged. A sparse script-backed page without a selected render has `outcome: partial`, `completeness: partial` and `reason: javascript_required`, including when no key or time remains.

For the new HTTP 200 path, the Firecrawl adapter requests rendered `html` with `onlyMainContent: false` and `maxAge: 0`. The existing HTTP 403 path continues to request `rawHtml`. Both formats pass through the same extractor and page-status checks. The adapter continues to validate final public URLs and bound its full JSON response.

The reader selects a successful Firecrawl result only when its extracted non-navigation text is at least 200 characters. The direct page already has fewer than 200 such characters whenever `needsJavascript` triggers this path, so a separate comparison is redundant. This threshold rejects a slightly longer loading placeholder, even if Firecrawl returns more HTML bytes. It is a practical recovery check, not proof that every festival fact is present. When selected, rendered Markdown comes first, followed by labeled direct HTTP Markdown within the existing 20,000-character limit. The result combines safe links from both sources, rendered first and deduplicated, within the existing 120-link limit. The direct section retains JSON-LD text when it fits; if the combined text exceeds the limit, the result reports truncation through the existing path.

If the provider fails or its result does not pass the check, the reader retains the original HTTP result as partial. A provider failure or timeout on this path is logged with a safe code; it does not erase the direct page. A selected result records `method: firecrawl`; an unselected attempt leaves `method: http`. HTTP 403 keeps its current failure behavior because no successful direct page exists to retain.

## Key decisions

- Keep the existing sparse-page signal in the extractor and retrieval policy in `readPage`. The model does not decide whether to spend a Firecrawl request.
- Reuse `consumePage()` accounting and the shared deadline, with no page-count cap or retry loop.
- Apply the existing 200-character boundary to rendered non-navigation text rather than raw response size. More HTML bytes or navigation links do not show that rendering recovered the page body.

## Risks and validation

- A short ordinary page with a script can spend a Firecrawl request. Cover that case in reader tests and confirm that a below-threshold render leaves the direct result partial.
- Firecrawl may return its own error page or another long, unrelated body. Check page status and selection threshold, and preserve source provenance. The length check does not establish semantic completeness.
- A cleaned render may lose JSON-LD. Verify that direct Markdown and safe links remain available within source limits when a render is selected.
- A fallback can overrun the research deadline. Test insufficient time, single-request accounting and the 403 regression.
