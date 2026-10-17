# Design

## Change size

Medium. The change crosses attempt setup, the initial agent input, both source tools, and local file output. It changes no catalog or report schema and adds no dependency. The main risk is accidentally recording more source content than the agent received or letting a file error affect ingestion.

## Approach

An attempt creates an optional capture writer after obtaining its durable runId. The writer is enabled only by the exact value `CATALOG_CAPTURE_TOOL_OUTPUTS=true`. It writes to the project's ignored `data/catalog-debug/<runId>/` directory. The [proposal](proposal.md) defines the purpose; the [delta spec](specs/catalog/source-workflow/spec.md) defines observable behavior.

The research input records the exact `inspectedSources` projection sent in the initial prompt. Each tool wrapper reserves a sequence number on entry and records its final return object immediately before returning to the agent; concurrent completion can therefore write files out of order while filenames retain invocation order. `readPage` records the result after `boundedToolSource`; `searchWeb` records its normalized result with the final `remaining` value. A cached `readPage` call is a new agent-visible return and receives a new file. No raw HTTP body, provider response, prompt, header, or exception object enters capture.

## Contracts

The switch is process-local and defaults off. The capture is a diagnostic side effect, not a field in `CatalogResearchInput` or `CatalogResearchResult`. It works for preview and apply runs started through the local catalog CLI or Studio. Injected eval candidates do not have a research agent and need no capture.

Each captured item has a monotonically assigned sequence number, `runId`, origin (`initial-source`, `readPage`, or `searchWeb`), optional tool call ID, and the exact agent-visible result. Store complete JSON for every item and a `.md` companion for page Markdown. Fixed tool names and sequence numbers form filenames; untrusted URLs and queries never become path components. Empty Markdown remains represented in JSON and may have an empty companion file.

Capture files are private local files: create the run directory with owner-only access and files with owner read/write access. The existing `/data/` ignore rule covers them. A writer failure emits one bounded diagnostic with runId and capture phase to process stderr, disables further capture for that attempt, and does not throw into ingestion. The diagnostic contains no URL, query, source text, file-system exception message, or credentials. Existing reports, logs, and traces keep their current content exclusions.

## Architecture

The attempt owns the optional writer for its lifetime. The research input builder computes `inspectedSources` once and uses that same value for prompt serialization and capture. The two tool wrappers call the writer after all existing result shaping and abort checks. The writer owns sequence assignment and local file operations. It does not own source retrieval, budget accounting, validation, or run finalization.

```text
initial read --> inspectedSources --> agent prompt
                         |
                         v
                   capture writer

readPage/searchWeb --> final tool result --> agent
                              |
                              v
                        capture writer
```

## Key decisions

- Capture at the agent boundary. Recording the source session would retain Markdown that `boundedToolSource` removed and would miss repeated cached tool returns.
- Keep the result object in JSON and page text in a Markdown companion. JSON preserves all fields and exact values; Markdown makes page inspection easier. The duplicate bounded text is acceptable for explicit local debugging.
- Keep files outside DuckDB and SQLite. Their current contracts exclude source bodies or store durable run data; this opt-in diagnostic has a separate lifecycle.
- Treat capture as best effort with a visible error. An optional debug destination cannot change catalog transactions or research status.

## Simpler options

Saving only the source session would need fewer hooks, but it would not reproduce the agent-visible tool outputs or call order. Saving only tool wrapper returns would omit the initial inspected source. Both would lose an agreed part of the diagnostic record.

## Risks and validation

- Compare saved JSON to the actual tool return and saved initial data to the prompt's `inspectedSources`, including truncation and remaining budget.
- Exercise cache reuse and calls from CLI and Studio workflow entry points with a temporary capture root or isolated working directory.
- Verify disabled mode creates no files and simulated file failure changes neither the run result nor catalog writes, while printing a bounded diagnostic.
- Inspect captured files for raw provider payloads, headers, exception text, and unsanitized path components. Confirm normal traces and reports still exclude page bodies.
