# Proposal

## Why

Broad instructions encourage redundant searches after official sources have been checked. Tool names are unclear, and discovery discards available highlights.

## What Changes

- **BREAKING** rename `readSource` → `readPage` and `discoverSources` → `searchWeb`, without aliases.
- Return bounded citation highlights to help select pages for inspection.
- Limit search to unknown/wrong/inaccessible official sources or material identity/date conflicts with the original event or other sources; reuse known links and prior results first.
- Put conditions in the tool description and a short reference in the prompt. Missing announcements or fields alone do not justify search.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog/source-workflow`: Clear tool names, candidate highlights and exceptional-use search instructions.

## Impact

Update active tools/contracts, prompts, tests/evals, observability and current docs. Keep OpenRouter's Exa plugin/default mode, credentials, safeguards, accounting and report v5. Preserve editor ownership of write decisions and historical artifacts. No database or Edition-scope changes; `narrow-current-refresh` remains independent.
