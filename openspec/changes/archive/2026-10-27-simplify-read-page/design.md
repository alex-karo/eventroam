# Design

## Change size

Medium. The source contract crosses extraction, caching, model input, workflow state, diagnostics, and eval fixtures. No new dependency or database migration is needed. The main risk is inconsistent fields or truncation rules between initial context and later tool calls.

## Approach

Use one full internal read result and one bounded projection for the model. The agreed behavior is in the [source-access delta](specs/catalog/source-access/spec.md). Remove the extraction text cut and link-list collection. Keep the existing request byte limits, URL safety checks, and Firecrawl fallback conditions.

`extractSource` returns full Markdown and the observations needed for fallback, such as `needsJavascript` and `nonNavigationTextLength`. The fallback joins full rendered and direct Markdown in its caller. Remove `combineSourceExtractions` after its link-list and truncation duties are removed. Keep rendered text first and the existing heading before direct text. `createSourceSession` caches that result for the run. `boundedToolSource` applies the model text bound without changing the cache. Both the initial `inspectedSources` and tool responses use that projection.

## Contracts

```ts
type ReadPageInput = { url: string };

type ReadPageOutput = {
  url: string;
  status: "ok" | "unsupported" | "failed";
  markdown: string;
  truncated: boolean;
  reasonCode?: string;
  remaining: { searches: number; durationMs: number };
};
```

The internal read keeps `attemptedUrl`, `finalUrl`, `retrievedAt`, `method`, optional `httpStatus`, full `markdown`, `status`, and optional `reasonCode`. Remove `links`, `completeness`, and `sourceTruncated` from internal source results. Keep extraction observations local to extraction and fallback. These fields do not assess whether research is complete.

Map existing page outcomes as follows: `ok` and `partial` become `ok`; `blocked` and `failed` become `failed`; `unsupported` remains `unsupported`. Keep concrete reason codes for failed reads and JavaScript limits. Empty supported responses return `ok` with empty Markdown. `truncated` records only projection cuts. It does not claim that JavaScript content or all remote content was obtained.

The previous extraction bound is 20,000 characters. Remove it and retain the existing model projection allowance: 80,000 characters, less its current metadata reserve, for a normal tool call. Initial context continues to divide its 80,000-character allowance across reads. Move the existing natural-boundary cut into the projection helper. Avoid incomplete Markdown links or comment tokens at the cut. Do not add continuation reads or offsets. A bounded prefix can end inside a page region.

Use `truncated` alone for projection cuts. Keep `reasonCode` for retrieval failures and content limits such as `javascript_required`. Projection does not add or replace a cached read reason.

## Consumers and diagnostics

Change the internal source types and all direct consumers in one step before running the type check. This includes workflow metadata, report projection, logs, traces, injected readers, source fixtures, and their loaders. Use the canonical internal fields rather than legacy aliases. Keep focused workflow, report, and diagnostic behavior checks in task group 2. Fixture Markdown remains source input; tool-output capture records only the bounded model projection.

Delete `evals/source-links.ts`, its loader calls, and its dedicated test. They only rebuild the removed internal link list. Remove the direct `mdast-util-from-markdown` dependency if no other use remains.

Keep the separate report contract: `sources` retains `attemptedUrl`, `finalUrl`, `retrievedAt`, `outcome`, and optional `reason`. Its existing projection maps the new internal `status` and `reasonCode` to these report fields. New report source outcomes use the three new status values, all of which already fit report v7. This avoids an unrelated report-field rename or schema-version change. The run's catalog outcome and research status retain their existing meanings.

Logs and traces retain the requested and final URLs, time, method, HTTP status, cache observation, and text length where already available. Replace read completeness and source-truncation observations with the actual projection truncation observation where a projection occurs. Do not label the initial fetch as truncated before the model projection exists. Keep full cached bodies out of workflow state, reports, logs, and traces. Update trace field selection and existing content-exclusion tests for renamed fields.

## Page region comments

Change the existing Turndown region rule to emit paired comments, for example `<!-- Navigation -->` and `<!-- /Navigation -->`. Keep the existing region detection and page order. Keep URL normalization for inline links and structured data extraction. Remove only the separate link collection, deduplication, and `MAX_LINKS` limit.

## Risks and validation

- Full cached Markdown uses more memory. The current response byte and run time limits remain. Test with a page above the former 20,000-character cut and a page above the model bound.
- Removing the old extraction cut can expose facts that were previously omitted. Update affected fixtures deliberately and run the affected eval CLI cases.
- Initial context and later calls can receive different prefixes. Test that each sets `truncated` correctly and neither changes the cache.
- Removing `links` must preserve inline destinations and structured URL facts. Adapt existing extraction and fallback tests rather than add a second parsing suite.
- Keep tests for blocked destinations, unsupported formats, fallback failures, cache reuse, and report/trace exclusions. Run type checks, focused tests, documentation checks, and OpenSpec validation.

The plan removes the duplicate link representation and page-completeness estimate. No useful simpler option preserves the agreed full-cache and bounded-model behavior.
