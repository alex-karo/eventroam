# Proposal

## Why

Broad model tasks and repeated page context make ingestion harder to check and less reliable on large pages. Split the internal work while preserving the overall ingestion contract and keeping inference growth limited.

## What Changes

- Refactor collection, interpretation, and validation around shared saved evidence. The agents, prompts, tools, and handoffs are described in [the design](design.md).
- Keep specifications about the complete ingestion result: supported facts, scope, identity, preservation, publication, failures, and owner inspection. Internal agent contracts belong in design and implementation documentation.
- Preserve the existing CLI modes, preview/apply behavior, catalog types, publication gates, atomic writes, country guards, and explicit uncertainty.
- Save parsed Markdown with provenance for private inspection and validation without another fetch. A general page description helps explain the source but does not establish facts by itself.
- Allow classification reuse from a supported preceding comparable saved Edition. It need not be the nearest comparable Edition; the source key and continuity basis remain required.
- **BREAKING** Remove optional source-tool capture through `CATALOG_CAPTURE_TOOL_OUTPUTS`. Use required source artifacts and saved workflow results for inspection. The exact ordered tool-response dump, including discovery responses and repeated cached results, is no longer provided.
- Limit ticket updates to `currentOrNextEdition`, including an ongoing Edition. Preserve historical prices, availability, offer URLs, and primary ticket links. This is an intentional scope change, separate from the refactor.
- **BREAKING** Omit per-offer URLs from ingestion ticket replacements. Keep the selected Edition's ticket link independent and prefer an established overview, as required by the Roskilde regression. Product pages can still be read as sources.

Delta specs cover changed behavior and the contracts needed by the new flow. Unchanged requirements remain in the main specs. Internal role changes belong in the design. The agent split does not require a new report format or report version.

## Capabilities

### Modified Capabilities

- `catalog/refresh-scope`:
  - **Before**: Full checks all supported fields in both Edition roles.
  - **After**: Historical ticket fields are excluded; current-or-next ticket checks include ongoing Editions.
- `catalog/source-access`:
  - **Before**: Complete source text stays in the run cache; model input uses a bounded prefix.
  - **After**: Private source artifacts retain full text and provenance after exit. Processing limits remain explicit, and source support retains its context.
- `catalog/ingestion-updates`:
  - **Before**: Editor can replace finding values, Location runs after Editor, and ticket offers can contain URLs.
  - **After**: Editor reviews supported proposals for all fields. Historical tickets are preserved; current replacements omit offer URLs and keep link selection independent.
- `catalog/classification`:
  - **Before**: Reuse requires the nearest preceding comparable saved Edition.
  - **After**: Reuse can use another preceding comparable saved Edition with its key and continuity basis.
- `catalog/location-resolution`:
  - **Before**: Location receives Editor's accepted targets and prepared forward and reverse context.
  - **After**: Location proposes changes before Editor review, using applicable saved and source evidence. Code prepares reverse context; Location chooses forward queries.
- `catalog/ingestion-runs`:
  - **Before**: Reports use Research's findings and source summaries.
  - **After**: Reports use selected targets and saved sources. They retain source-storage failures and useful partial research after an identity refusal.
- `operations/ingestion-diagnostics`:
  - **Before**: Optional source-tool capture supplies a separate debug record.
  - **After**: Required source artifacts support inspection and survive workflow-history deletion. Optional capture is removed.
- `operations/ingestion-evaluation`:
  - **Before**: Ticket checks include historical offers and offer URLs; model overrides name three agents.
  - **After**: Checks preserve historical tickets and compare current offers by amount and currency. Explicit model selection applies to every executed role.

- Add three isolated Reader eval cases from existing source fixtures, with code-based evidence and context checks.

## Impact

Implementation affects the ingestion workflow, prompts, internal schemas, source storage, report assembly, and evaluation fixtures. Existing catalog operations remain the write boundary. Private source files need persistent storage on the selected host. Internal workflow history can expose detailed execution data without making agent names part of the durable domain contract. No new package, catalog field, public command, autonomous refresh, or replay capability is required.
