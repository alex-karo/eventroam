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

The delta specs also remove inherited requirements about which agent acts and when. Those edits preserve the domain rules and their observable scenarios. They do not create a new product feature for each internal role. The agent split does not require a new owner-facing report format or report-version change.

## Capabilities

### Modified Capabilities

- `catalog/ingestion-workflow`:
  - **Before**: Add and refresh requirements include instructions for model work.
  - **After**: They define the same requested checks and accepted catalog results, with the ticket-scope exception.
- `catalog/refresh-scope`:
  - **Before**: Full checks supported fields in both Edition roles and names internal selection responsibilities.
  - **After**: The same temporal and ownership rules apply to ingestion as a whole; ticket checks cover only the current-or-next role.
- `catalog/source-access`:
  - **Before**: Specs prescribe model response fields and bounded Markdown prefixes; complete text is kept in the run cache.
  - **After**: Specs define safe retrieval, preserved source text, explicit limits, and inspectable provenance, without prescribing a model handoff.
- `catalog/ingestion-updates`:
  - **Before**: Supported-update rules also assign work to individual agents.
  - **After**: The result must satisfy the same evidence, identity, and coherent-field rules; historical tickets are protected and new ticket replacements omit per-offer URLs.
- `catalog/classification`:
  - **Before**: Classification rules include model instructions and an Editor correction contract.
  - **After**: Complete lists, facet limits, and preservation rules apply to the final result. Supported reuse can use a preceding comparable Edition without requiring the nearest one.
- `catalog/location-resolution`:
  - **Before**: Place rules prescribe agent order, input preparation, and agent output decisions.
  - **After**: They define accepted targets, coherent place data, applicable evidence, and valid point choices.
- `catalog/ingestion-runs`:
  - **Before**: Reports are specified through a fixed set of agent responses.
  - **After**: Reports retain the same owner-facing findings, decisions, errors, and catalog outcomes without fixing the internal agent set.
- `operations/ingestion-diagnostics`:
  - **Before**: Inspection requirements name a fixed set of agents and provide optional source-tool capture.
  - **After**: Inspection explains execution and domain outcomes through required saved sources and workflow results; optional source-tool capture is removed.
- `operations/ingestion-evaluation`:
  - **Before**: Checks depend on internal responses and include historical ticket expectations.
  - **After**: Quality checks target ingestion results and preserved data; historical tickets remain unchanged and current offer checks use amount and currency without per-offer URLs.

## Impact

Implementation affects the ingestion workflow, prompts, internal schemas, source storage, report assembly, and evaluation fixtures. Existing catalog operations remain the write boundary. Private source files need persistent storage on the selected host. Internal workflow history can expose detailed execution data without making agent names part of the durable domain contract. No new package, catalog field, public command, autonomous refresh, or replay capability is required.
