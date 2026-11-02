---
type: Guide
title: Source reader
description: Page extraction, map evidence, fallback, and checks for readPage.
status: stable
tags: [catalog, ingestion, sources]
---

# Source reader

`readPage` loads a public page, extracts Markdown, reads supported maps, and returns evidence to Research. It does not choose a venue or Edition. Research assesses the evidence; Location decides coordinates.

## Page content

HTML and XHTML retain headings, tables, inline links, and image alternative text. Identified regions use paired HTML comments for Navigation, Main content, Page header, Page footer, and Aside.

The HTML converter is `@mdream/js` with its standard `frontmatterPlugin()`. Markdown starts with YAML when the page head has a title or supported metadata. The page title uses YAML `title`; the reader does not add a page-title heading. Body headings stay in source order. Titles in body content or embedded documents do not supply the YAML title.

The plugin's default metadata fields are `description`, `keywords`, `author`, `date`, `og:title`, `og:description`, `twitter:title`, and `twitter:description`, under YAML `meta`. Repeated fields keep the last value with nonempty `content`. These are source claims. A metadata date is not a verified Edition date, and body text stays when it differs. Earlier repeated values are not collected separately.

Links use retained text, image alternative text, `aria-label`, or `title`, in that order. If all labels are empty, the resolved destination becomes the label. Allowed destinations use HTTP(S) without credentials; queries and fragments stay. The reader does not infer labels from image filenames. Existing cleanup still removes scripts, SVG, and nodes marked `hidden` or `aria-hidden="true"`; this fallback does not recover their content or links.

JSON-LD adds selected structured fields. Valid coordinates from `Event.location.geo` and `Place.geo` stay with their owner's name and path. Malformed JSON-LD does not invalidate visible content. JSON responses use the same field extraction; invalid JSON stays as text. Plain text keeps normalized line endings. Other media types, Facebook, and Instagram return an unsupported result.

## Fallback

With `FIRECRAWL_KEY`, the reader tries Firecrawl once after HTTP 403, using raw HTML. Without a key, that read fails. Other HTTP errors do not trigger fallback.

For HTTP 200 HTML, rendered fallback needs a script other than JSON-LD, fewer than 200 characters of body text outside navigation, and at least one second remaining. A short page with an analytics script can meet this signal. A successful Firecrawl HTML response has no minimum text length. The reader keeps its extracted content, including links from images with no ordinary body text. If fallback cannot run or fails, the direct page stays `ok` with `javascript_required`.

Head metadata, generated link labels, and output-only image text do not count toward this signal.

A selected render keeps available direct text, YAML metadata, JSON-LD, and map references in the direct-response section. Rendered content keeps its own source section. The reader does not merge metadata across these sections. Fallback uses the shared request, time, and byte limits.

## Maps

The reader finds map references in anchors, iframe sources, `data-src`, `data-lazy-src`, and `noscript`. It merges repeated references and keeps distinct labels and nearby text.

After page fallback, it reads each unique public My Maps `mid` once within the same call. Supported forms are `embed`, `viewer`, and `edit`. Maps use bounded HTTP requests without rendering, script execution, Firecrawl, or following marker links. Ordinary Google Maps and short map URLs remain references only.

Map Markdown keeps the source URL, title, description, source years, layer names, and all point names, descriptions, latitude, and longitude. Parking and camping remain visible. Lines and polygons are skipped with a notice; their display coordinates are not points.

Research returns coordinates when a map clearly identifies the selected Edition's venue. It checks the map year and distinguishes the venue from parking and camping. Location makes the final coordinate decision.

A map failure keeps the readable page `ok`, with the map URL and a limitation notice. The reason is `map_read_incomplete` unless a page limitation reason already exists. Unread data does not prove that markers are absent.

## Response and limits

`readPage({ url })` returns `url`, `status`, `markdown`, `truncated`, optional `reasonCode`, and `remaining: { searches, durationMs }`. The URL is the final destination when known. Status is `ok`, `unsupported`, or `failed`; it does not assess research completion. A supported empty response is `ok`.

Requests, retries, fallback, and map reads share the run budget and transport safety checks. The session caches full page and map Markdown, including failed reads. Repeated requested or final URLs reuse that result. Concurrent reads of the same requested URL share one request. There is no separate map cache.

Only model input is cut: each tool response has an 80,000-character allowance less a 300-character reserve. Initial sources share the same allowance. `truncated` reports that cut without changing cached text or reason codes. Map blocks follow page text, so a cut can omit them or a region's closing comment. Links remain inline; there is no separate link list or completeness field.

## Check a read

Set `CATALOG_CAPTURE_TOOL_OUTPUTS=true` for a local preview run. Capture saves the exact responses seen by Research, including any text cut. Keep captures local.

PortAmérica's [directions page](https://portamerica.es/comollegar/) is a useful example. Recorded data has a festival point, separate parking and camping points, and a layer marked 2026. Live content can change.

Check the captured Markdown for labels, coordinates, source URL, year, truncation, and limitation notices. Then check the report's Location result for the chosen point and Edition. A successful page read alone does not establish a correct location choice.
