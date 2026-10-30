# Proposal

## Why

A successful Firecrawl HTML response can contain useful links with no body text. The reader currently drops these links, as seen on Waking Life.

## What Changes

- Keep links returned by alternate retrieval when the page has no ordinary body text.
- Keep the direct HTTP fallback signal and all request limits.
- Test short text and links from images in page results and tool output.

## Capabilities

### Modified Capabilities

- `catalog/source-access`:
  - **Before**: The spec requires available alternate evidence to be retained. The code also requires 200 characters outside navigation after rendering.
  - **After**: The existing evidence retention requirement explicitly includes links, with a scenario for an image link without ordinary body text.

## Impact

The page reader, its tests, and the source reader guide change. No dependencies or response fields change. Compression, network failures, and hidden DOM content are outside this change.
