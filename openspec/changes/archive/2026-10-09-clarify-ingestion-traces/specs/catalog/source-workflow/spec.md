# Spec Delta

## MODIFIED Requirements

### Requirement: Local research tracing is optional and independent

The owner SHALL be able to enable apply-run tracing independently of application logging. Eligible runs SHALL use a durable runId and one outer root with native agent/tool relationships. Tracing SHALL be best effort and SHALL NOT change research decisions, budgets, retries, catalog writes, report semantics, durable run records or exit status. Dry runs and injected candidate generators SHALL create no trace spans.

#### Scenario: Tracing only
- **WHEN** eligible apply research runs with tracing enabled and logging disabled
- **THEN** spans persist with runId and selected host fields, without requiring application logs

#### Scenario: Ineligible run
- **WHEN** a dry run or injected candidate generator executes
- **THEN** no spans are created regardless of the tracing switch

#### Scenario: Trace failure
- **WHEN** initialization, export, flush or shutdown fails
- **THEN** ingestion retains its original result/error and cleanup phases are still attempted with fixed content-free diagnostics

### Requirement: Exported research traces exclude content payloads

Host-owned span input/output/metadata SHALL contain only explicitly selected values. SDK-generated spans SHALL suppress automatic sensitive content at its source where supported; otherwise a minimal fail-closed exclusion SHALL remove prompts, message history, source bodies, full responses, transport payloads and raw errors before persistence. Safe host-owned fields, identity, timing, technical status and relationships SHALL remain visible. No generic recursive field allowlist or whole-projection byte cap is required for host-owned objects.

#### Scenario: Automatic model span captures messages
- **WHEN** the SDK attempts to attach prompts or model history to a span
- **THEN** stored spans exclude that content across creation and update/export events

#### Scenario: Host source metadata is selected
- **WHEN** the host records a source retrieval result
- **THEN** its explicit status, URL, method and completeness remain after reopen without the source body

### Requirement: Trace lists identify the Event and edition roles

Trace labels SHALL identify the Event, mode, context editions and confirmed committed editions with separate roles, stable keys and known years. Unknown years SHALL not be inferred from dates or keys. Technical completion SHALL remain distinct from terminal research and write outcomes.

#### Scenario: Historical edition is created
- **WHEN** a check sees context year 2026 and confirms creation of year 2023
- **THEN** final labels distinguish `ctx:2026` from `created:2023` and retain the research outcome

### Requirement: Source diagnostics retain only bounded safe projections

Source spans SHALL record explicitly selected read URLs, outcome/reason/method/completeness and source/tool truncation where known; discovery spans SHALL record selected query and candidate URLs/counts. Producers SHALL select and shorten useful fields without a generic projection framework. Technical completion SHALL not imply retrieval success. Full source text and response envelopes SHALL be excluded.

#### Scenario: Retrieval fails without throwing
- **WHEN** a source tool returns failed/request_failed under normal SDK completion
- **THEN** host fields show failed retrieval, selected URL and method without the source body

#### Scenario: URL contains query or fragment
- **WHEN** a source URL is selected for diagnostics
- **THEN** its components are preserved within any call-site shortening applied, without rewriting the request

### Requirement: One catalog-run trace covers the final result

Each eligible apply trace SHALL begin before context and initial retrieval, parent research/source work, and end after validation, write/rollback and report construction or failure. Root host fields SHALL be explicit ordinary objects with independent structuralValidation, targetValidation, semanticValidation=not_run, writeState, known committedOperationCount, and report researchStatus/outcome when available. No logging producer SHALL depend on a trace summary to calculate its own straightforward outcome fields.

#### Scenario: Report construction fails after a commit
- **WHEN** a confirmed write succeeds but report construction fails
- **THEN** the root retains committed disposition/count and technical failure without inventing unavailable report fields

### Requirement: Run traces distinguish write disposition from research outcome

Write state SHALL remain committed, rolled_back, unchanged, not_attempted or unknown independently of research status. The committed-operation count SHALL be null when transaction disposition is unknown; dry-run previews SHALL not be labelled committed.

#### Scenario: Writer rejects an atomic item
- **WHEN** the writer rolls back after failure
- **THEN** the root records rolled_back and zero confirmed changed operations without claiming successful mutation

### Requirement: Local traces use best-effort persistence and can be inspected

Tracing SHALL use the local observability store separate from the catalog and remain inspectable after exit. Completion, handled errors and cooperative aborts SHALL end owned spans and attempt bounded flush and shutdown. Logging and tracing SHALL be independently configurable. Overlapping background writes or forced termination may leave incomplete traces without changing catalog transaction guarantees.

#### Scenario: Fresh process inspection
- **WHEN** a completed run releases the store and Studio later opens it
- **THEN** safe root/source labels and result fields are visible without model credentials or catalog access
