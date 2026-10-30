# Design

## Change size

Small. One result selection check changes. Transport, extraction, and tool response contracts stay in place.

## Approach

The page result and model tool output keep links from alternate retrieval even when there is no ordinary body text. The existing evidence retention requirement owns this behavior.

Remove the text length check in `tryRenderedFallback` and its unused import. A successful bounded Firecrawl response uses the existing extraction and merge path. Direct content remains in its own section. The direct HTTP signal still uses the 200-character threshold.

No replacement content test is needed. A new threshold would still drop valid evidence. Short placeholder content can now be selected, but direct evidence remains available. A successful read does not prove that research is complete.

## Risks and validation

Use synthetic HTML with an image link and zero ordinary text. Check both `readPage` and the actual research tool output. Also check short text and empty HTML. Update tests that expect short renders to be rejected. Run reader, transport, and tool tests to check that failures, limits, and safety remain covered. Keep real captures in ignored data.
