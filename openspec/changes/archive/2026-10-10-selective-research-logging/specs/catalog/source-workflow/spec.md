# Spec Delta

## MODIFIED Requirements

### Requirement: Research logging is optional and independent

The owner SHALL be able to enable local application logging independently of tracing. Logging SHALL be disabled by default and use configurable debug/info/warn/error levels. It SHALL use Mastra PinoLogger with ordinary level methods and child context. Logging failures SHALL produce fixed content-free diagnostics and SHALL NOT change research decisions, budgets, retries, catalog writes, report fields, durable run lifecycle/accounting, eval acceptance, or exit status.

#### Scenario: Logging without tracing
- **WHEN** logging is enabled and tracing is disabled, including a dry run or injected candidate generator
- **THEN** selected events can persist without trace spans, and the durable ingestion record remains required

#### Scenario: Neither signal is enabled
- **WHEN** logging is disabled and tracing is ineligible or disabled
- **THEN** no observability store is opened

#### Scenario: Logging or cleanup fails
- **WHEN** logger initialization, delivery, flushing, or shutdown fails
- **THEN** ingestion retains its original result or error and attempts independent cleanup with a fixed diagnostic

### Requirement: Research events have readable full-run context

Each stored application log SHALL have a short message, severity, durable runId, and useful selected context. Producers MAY include a stable event code and sequence for filtering. Scoped child context SHALL survive persistence. Real trace and span identifiers SHALL be present when available and SHALL NOT be invented when tracing is disabled. The runId SHALL match the ingestion row and report.

#### Scenario: Child context persists
- **WHEN** a source logger is created from a run logger with `child({...})`
- **THEN** Studio's saved log details include the run and source context, severity, and any real trace/span correlation after reopen

#### Scenario: Mastra uses the shared Pino logger
- **WHEN** application logging is enabled
- **THEN** Mastra uses the shared native PinoLogger with runId context for SDK diagnostics on stderr at the configured level
- **AND** automatic SDK log export remains disabled and explicitly bridged application records are saved once
- **AND** disabling application logging leaves the Mastra logger disabled

#### Scenario: Event identity becomes known
- **WHEN** an input eventId is known, an existing event is matched, or a new event is committed
- **THEN** subsequent application logs, including existing child loggers, and Mastra diagnostics include eventId in their context
- **AND** earlier logs are unchanged and transient dry-run creation IDs are not bound as eventId

#### Scenario: SDK emits its own log
- **WHEN** automatic SDK logging occurs
- **THEN** the research exporter does not admit it merely because application logging is enabled

### Requirement: Research logs cover actionable execution events

Enabled logging SHALL describe selected source retrieval, discovery, model steps, completed commentary and returned reasoning, tool calls/results, retry and terminal errors, budget limits, candidate preparation, write outcomes, and run completion. Producers SHALL calculate straightforward status/count fields where emitted, independently of a shared trace summary. Successful completion SHALL follow durable finalization. Logging SHALL NOT replay work or change generation settings.

#### Scenario: Source was fetched
- **WHEN** a source returns Markdown
- **THEN** the source event records useful fields such as `sourceCharacters` and selected response status/URL
- **AND** no source Markdown or full response is passed to the logger

#### Scenario: A dry run previews writes
- **WHEN** catalog changes are previewed
- **THEN** the log distinguishes preview from committed writes and retains selected counts without claiming a commit

### Requirement: Research log payloads are selected by event

Log producers SHALL pass plain objects with explicit useful fields. They SHALL NOT pass full prompts, message history, source Markdown or excerpts, full provider responses, transport headers/bodies, SDK objects, catalog snapshots, or raw exception objects. Selected model commentary and returned reasoning MAY be logged after explicit shortening. No runtime field allowlist, recursive payload processor, per-event payload type or callback, event-message registry, or whole-record 8 KiB cap is required. Native Pino serializers, mixins, child bindings, and redact settings SHALL NOT be relied upon to protect or populate the separately exported observability arguments.

#### Scenario: Producer selects nested response fields
- **WHEN** an HTTP response is useful for diagnosis
- **THEN** the producer passes a new plain object with status and URL rather than the response envelope

#### Scenario: Debug logging is selected
- **WHEN** debug events are enabled
- **THEN** they follow the same call-site selection rule without unrestricted payload forwarding

### Requirement: Model commentary and returned reasoning remain distinct

Completed-step commentary and provider-returned textual reasoning SHALL be logged as separate, labelled channels when available. Their selected text SHALL be shortened explicitly through `shrinkText(text)`, whose default limit is 4,000 Unicode code points. Each selected text event SHALL include original length and a truncation flag; retained length MAY be included. No 8 KiB serialized-record fit is required. Logging SHALL NOT collect streaming fragments, infer withheld reasoning, or duplicate final structured results.

#### Scenario: Long completed text
- **WHEN** a completed step returns more than 4,000 Unicode code points in either selected channel
- **THEN** that channel logs at most its first 4,000 code points with visible shortening metadata

#### Scenario: Interrupted step
- **WHEN** a step ends before its completion callback
- **THEN** it may have no text event; earlier completed-step events remain eligible for persistence

### Requirement: Tool events preserve calls and useful selected results

Observed tool starts and outcomes SHALL retain call identity, tool name, step/attempt context, selected arguments, and selected result metadata. Source result logging SHALL use retrieval metadata and source character count without Markdown. Unobserved outcomes SHALL NOT be fabricated; source/discovery host events SHALL not duplicate the same tool operation.

#### Scenario: A source tool completes
- **WHEN** the agent reads a source through its tool
- **THEN** the paired events retain the tool-call ID, selected URL/status and source character count, with no source body

### Requirement: Local research logs remain inspectable after exit

Enabled logs SHALL persist in the local DuckDB observability store and be readable in Mastra Studio after exit. Stored severity, runId and available trace/span IDs SHALL support inspection and correlation. CLI stdout and private reports SHALL retain their contracts. Pending writes SHALL receive bounded best-effort flush and shutdown attempts.

#### Scenario: Inspect saved logs
- **WHEN** the owner opens Studio after a completed run
- **THEN** selected events and scoped context are visible without rerunning research or accessing model credentials

### Requirement: Research tracing does not forward SDK logs

Enabling tracing or application logging SHALL NOT forward unrestricted SDK-generated logs. The exporter SHALL admit selected application Pino events through a narrow source distinction and exclude SDK logs by default. Sensitive SDK span payloads SHALL be suppressed at their source where supported or excluded by the smallest necessary fail-closed export mechanism.

#### Scenario: SDK generated content
- **WHEN** the SDK creates an automatic log or span containing a prompt, message history, source body, or full response
- **THEN** the stored observability record excludes that content without removing safe host-owned trace fields

### Requirement: Observability storage has explicit local ownership

Application logs and eligible traces SHALL share a local DuckDB store separate from the catalog. Recording and Studio SHALL use it sequentially when the backend requires exclusive process access. Existing historical files SHALL remain untouched; no conversion or legacy inspection is required.

#### Scenario: Another process owns the store
- **WHEN** the recording run cannot open DuckDB
- **THEN** it emits a bounded diagnostic and continues ingestion without taking ownership from that process

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
