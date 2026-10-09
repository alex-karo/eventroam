# Proposal

## Why

The festival research prompt currently combines identity, editions, source navigation, dates, location, classification, links, and detailed ticket interpretation. Isolating ticket interpretation can shorten the main model's instructions and lets us test whether a specialist improves correctness; neither an accuracy improvement nor a reduction in total tokens or cost is established.

## What Changes

- Keep the main researcher responsible for Event/Occurrence identity, source discovery and reading, non-ticket facts, and official link ownership. Replace its ticket JSON output with edition-specific routing of already inspected pages.
- Preserve saved ticket-variant URLs as private edition-specific navigation leads in main research, while removing saved amounts and ticket interpretation payloads. A saved variant URL does not become an official public link merely by being a lead.
- Keep the existing TypeScript orchestrator and execute both agents through Mastra; no Mastra Workflow conversion is proposed. A small per-run helper provides lazy access to one Mastra instance and optional tracing, with final cleanup owned by the orchestrator.
- Run one bounded, tool-free ticket specialist batch after valid main research. Supply exact edition context, saved ticket blocks in original currency units, and original inspected Markdown with URLs and retrieval limitations. Do not add independent search or retrieval.
- Keep specialist output to edition keys, optional explained ticket blocks and unresolved questions. Omit per-edition status and model-generated errors; host code reports execution, limit and validation failures. Valid blocks remain usable alongside questions, and omission preserves saved prices.
- Keep page summaries with the main researcher and ticket explanations with the specialist; do not merge stage summaries or add tighter summary limits.
- Assemble the specialist's complete explained variants/basePrice blocks in host code into one final research candidate; do not ask the main model to reproduce or reinterpret them. Preserve deterministic money validation/conversion and the existing atomic catalog writer.
- Preserve omission versus supported explicit clearing, whole-block availability corrections, concession exclusion, currency precision, edition ownership, and duplicate-add skipping. Isolate specialist failure so saved prices survive and unfinished ticket checks remain visible alongside usable other findings. Overall success/partial depends only on the main identity, edition/dates and location checks; ticket navigation and interpretation do not downgrade it.
- Preserve optional local traces with distinct allowlisted agent identities and stage prompt versions; flush/shutdown after research and deterministic work, with the existing content exclusions and best-effort policy.
- Share the existing model-call, input, output, and deadline limits; account for main, specialist, and discovery usage exactly once. Retain existing main-only provider_unavailable retries and refunds; the specialist makes one attempt without SDK/error-processor retries. Keep existing version-2 report totals and the main raw response; add one compact ticket-stage record and the assembled candidate for inspection.
- Use existing offline tests and fixed-source evals, adding focused ticket assertions. Compare saved before/after results from identified Git revisions rather than building a paired runner or embedding the old pipeline. Paid model evaluation requires separate authorization.

Out of scope: public UI, catalog storage/schema changes, autonomous research loops, independent specialist retrieval, per-category agent proliferation, new automatic retries or corrections, and changing publication or catalog-write policy.

## Capabilities

### New Capabilities

None; ticket specialization belongs within the existing source-backed catalog workflow.

### Modified Capabilities

- `catalog/source-workflow`: separate ticket interpretation from general research; define the handoff, assembly, shared limits, failure preservation, independent main/ticket completion, compact reporting, and existing-eval verification while retaining one final result per atomic update.

`catalog/records` remains unchanged: complete price replacement and model-selected full-programme summaries already cover specialist-produced blocks.

## Impact

Planning targets `src/ingestion/workflow.ts`, `research/{agent,contracts,prepare,money}.ts`, new narrowly scoped ticket contract/runner/assembly modules, `sources/session.ts`, `runtime/{budget,openrouter,tracing}.ts`, `report.ts`, shared dependency/result types, existing CLI report consumers, and the existing eval fixtures/seeding/scorers/runner. Reuse Mastra Agents and the current Mastra model-router/OpenRouter provider configuration and deterministic writer; no dependency or database migration is proposed. Update ingestion/development/structure documentation during implementation and keep the documentation index current. Implementation and verification progress is tracked in tasks.md.
