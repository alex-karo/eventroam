# Spec Delta

## MODIFIED Requirements

### Requirement: Local research tracing is optional and independent

The owner SHALL be able to enable per-Event apply-run, agent, model and source tracing without sampling. Persistence SHALL be best effort. Tracing SHALL NOT alter research decisions, budgets, retries, catalog writes, report schema/semantics, durable run records or exit status. Integration failures SHALL emit bounded independent diagnostics; local LibSQL technical errors/stacks remain permitted.

#### Scenario: Tracing is disabled by default
- **WHEN** tracing is not enabled
- **THEN** research creates no trace store or records

#### Scenario: Dry-run skips tracing
- **WHEN** dry-run executes, even with tracing enabled
- **THEN** create no trace store or spans, including agent/model/source spans; retain existing preview reports and durable run records

#### Scenario: An enabled agent uses tools
- **WHEN** a traced agent calls model/source tools
- **THEN** spans retain relationships, names, timing, technical status and bounded mode/model/prompt-version/requested-Event metadata

#### Scenario: Trace persistence fails
- **WHEN** initialization or persistence fails, including internally handled exporter errors
- **THEN** emit a fixed stderr diagnostic without payloads; preserve research results, v2 business fields, budgets and exit status
- **AND** private LibSQL technical errors/stacks may appear locally, never forwarded to stored traces or reports

### Requirement: Exported research traces exclude content payloads

Persisted spans SHALL exclude prompts, pages, model messages/responses, raw tool payloads, SDK/config credentials, transport headers/bodies and raw errors/stacks. Only allowlisted bounded source diagnostics and root summaries SHALL be permitted input/output; source URLs follow the preservation rule below. Identity, timing, relationships and safe metadata/technical diagnostics SHALL remain. Private reports SHALL retain their final-output contract.

#### Scenario: Content appears in multiple span fields
- **WHEN** forbidden content appears anywhere in a span
- **THEN** persisted/exported spans exclude it while retaining operation identity/timing and the permitted projections

#### Scenario: Span sanitization fails
- **WHEN** sanitization fails
- **THEN** drop the span and emit a fixed content-free diagnostic without changing research

#### Scenario: Diagnostic projections survive content exclusion
- **WHEN** source diagnostics and root summaries are exported
- **THEN** allowed input/output survives persistence and fresh-process export; original tool and all agent/model/unknown-span payloads remain absent
- **AND** every export lifecycle event is sanitized; unavailable sanitization disables tracing without blocking research

### Requirement: Local traces use best-effort persistence and can be inspected

Tracing SHALL use a dedicated local store separate from the catalog. Saved spans SHALL be inspectable after exit without a hosted account. Completion, handled errors and cooperative aborts SHALL finalize the run summary/report or failure, end spans, then await flush and shutdown attempts. Overlapping background writes or forced termination may leave incomplete traces.

#### Scenario: Inspect a finished invocation
- **WHEN** the owner opens local trace inspection after a run
- **THEN** saved traces are available without rerunning research, catalog access or model credentials; the interface registers no research agents or mutation workflows

#### Scenario: A generation fails or is cooperatively aborted
- **WHEN** the run throws or cooperatively aborts
- **THEN** end root/owned children and await terminal-span flush before store closure and return, preserving the result/original error

#### Scenario: A short invocation finishes before automatic persistence
- **WHEN** a short run finishes with buffered spans and no overlapping background write
- **THEN** a fresh process can read final root output, labels and children after exit

#### Scenario: Background persistence overlaps another flush or cleanup
- **WHEN** background writing overlaps flush/shutdown
- **THEN** spans or terminal updates may be missing; research/report semantics, budgets, retries and exit status remain unchanged

#### Scenario: Flushing fails during cleanup
- **WHEN** flush fails
- **THEN** emit a fixed diagnostic and still attempt shutdown; neither failure replaces the result/original error

#### Scenario: Injected research fixture bypasses the agent
- **WHEN** an injected candidate generator bypasses the agent
- **THEN** create no trace/store; tracing tests exercise the real agent with an offline mock provider and a separate temporary store

#### Scenario: Cleanup crosses the research deadline
- **WHEN** generation finishes before its deadline but cleanup crosses it
- **THEN** preserve the model result/provider error; only actual generation timeout retains budget-failure classification

## ADDED Requirements

### Requirement: Trace lists identify the Event and edition roles

Labels SHALL show Event, context editions, mode and terminal research/mutation result, without a redundant apply marker. Primitive IDs SHALL remain stable. Context and committed mutations SHALL retain separate roles, stable edition keys and nullable years. Known years SHALL be visible; unknown years SHALL NOT be inferred from keys or dates.

#### Scenario: Partial historical discovery during a current-edition check
- **WHEN** check/apply with context year 2026 partially researches and creates cancelled edition 2023
- **THEN** initial/final labels identify Event, ctx:2026 and check; the final label adds partial and created:2023 without claiming 2026 was resolved
- **AND** details distinguish context and writer-confirmed mutations; uncommitted discoveries remain in the report

#### Scenario: Display-name precedence does not hide the label
- **WHEN** inspection prefers entity display name over operation name
- **THEN** both contain the same sanitized root label after terminal persistence/reload, without changing primitive IDs

#### Scenario: Addition, mismatched name, and long edition lists
- **WHEN** add lacks a saved target, a model name differs, or editions overflow
- **THEN** use requested/validated new names or canonical existing names; exclude unrelated context and uncommitted editions
- **AND** mark unknowns and omissions explicitly while preserving mode/result and non-year keys

#### Scenario: A nonnumeric edition key has a known year
- **WHEN** key summer has saved year 2026
- **THEN** retain both and show `ctx:2026 [key:summer]`; committed summaries use effective saved years, otherwise null

#### Scenario: A stable key survives a year correction
- **WHEN** year changes from 2026 to 2027 with key 2026 unchanged
- **THEN** context remains 2026; writer-confirmed mutations show `2027 [key:2026]` with their respective roles
- **AND** failed writes create no committed entries; a numeric key with unknown year shows `? [key:2026]`

### Requirement: Source diagnostics retain only bounded safe projections

Source spans SHALL expose bounded read URLs/outcome/reason/method/completeness/truncation and existing search queries/candidate URLs. Technical completion SHALL remain distinct from retrieval outcome. Diagnostics SHALL NOT change model-visible schemas, arguments, instructions or decisions. Full payloads SHALL remain excluded.

#### Scenario: A source fails without throwing
- **WHEN** readSource returns failed/request_failed despite normal SDK completion
- **THEN** its short label and safe output show source/failure, attempted/final URLs, method and known completeness/truncation

#### Scenario: Retrieval methods and truncation differ
- **WHEN** retrieval uses HTTP, Firecrawl, a social stub, caching or truncation
- **THEN** preserve method and distinct ok/partial/unsupported/blocked/failed outcomes; separate source/tool truncation and leave unobserved truncation unknown
- **AND** cached results do not imply another network request

#### Scenario: Discovery yields candidates or does not execute
- **WHEN** discovery completes, is budget-reserved, or throws
- **THEN** retain the bounded existing query, at most ten candidate URLs and returned/retained/omitted counts, excluding titles/snippets
- **AND** distinguish not_run from successful empty searches; thrown failures retain only safe arguments and fixed codes

#### Scenario: Source URLs retain diagnostic context
- **WHEN** source URLs enter read/search diagnostics, queries or labels
- **THEN** preserve their components, including query and fragment, within field limits, without token heuristics, secret matching or URL rewriting; mark truncation
- **AND** SDK/config credentials, authorization headers and transport payloads remain outside the field allowlist; source validation and actual requests remain unchanged

#### Scenario: Diagnostic input exceeds its limits
- **WHEN** projections exceed their limits
- **THEN** enforce these UTF-8 byte and entry maxima with Unicode-safe truncation while preserving status/counts; no separate character-count limits apply:

| Field | Limit |
| --- | --- |
| Source input + output | 8 KiB serialized UTF-8 |
| Root application metadata + output | 16 KiB serialized UTF-8 |
| Query | 1200 bytes |
| URL / label / source name | 512 / 512 / 240 bytes |
| Event name / edition key | 320 / 160 bytes |
| Identifier or model / reason code | 160 / 64 bytes |
| Candidate URLs / each edition-role list | 10 entries, with omitted counts |

### Requirement: One catalog-run trace covers the final result

Each enabled per-Event apply trace SHALL start before context/initial retrieval and parent research/source operations through validation, writing/rollback and report construction or failure. One outer span SHALL suffice without detailed HTTP stages. Native technical status SHALL remain distinct from root research, validation, write and mutation outcomes.

#### Scenario: Initial source fails before model research
- **WHEN** initial retrieval fails with oversized_response and later sources help
- **THEN** the initial failure and agent share the outer trace, ending after the report with independent research/write outcomes

#### Scenario: Structurally accepted facts are semantically wrong
- **WHEN** a mistaken candidate passes structure/target checks
- **THEN** record those checks and semanticValidation=not_run without claiming factual verification or adding semantic checks

#### Scenario: Terminal status dimensions remain independent
- **WHEN** a run terminates
- **THEN** retain native technical status without duplicating it in output; list labels expose partial/invalid/write-failed results even beside technical OK. Root output contains:

| Field | Values / meaning |
| --- | --- |
| researchStatus / outcome | Copy existing report values; omit if no report could be built |
| structuralValidation / targetValidation | passed / failed / not_run, independently; only performed checks can pass |
| semanticValidation | not_run |
| writeState | Disposition below, independent of report outcome |
| errorCode | Fixed code for validation, research, write or workflow failure when applicable; no raw error text |
| committedOperationCount | Number of confirmed changed operations; zero when no changes committed, null when disposition is unknown |
| editions | Bounded context and committed-mutation summaries |

#### Scenario: Context or report construction fails
- **WHEN** context/report construction throws
- **THEN** retain a fixed stage-specific errorCode and native error status with original failure behavior; preserve a prior confirmed commit and its count. Copy report statuses only if an existing normal or fallback report is available

### Requirement: Run traces distinguish write disposition from research outcome

Write state SHALL be committed, rolled_back, unchanged, not_attempted or unknown, independently of research/mutation status. The committed-operation count SHALL be null when transaction disposition is unknown. Invalid/failed research SHALL NOT appear as a successful no-op.

#### Scenario: Valid apply commits or changes nothing
- **WHEN** apply changes facts, changes nothing, or skips duplicate add
- **THEN** show writeState=committed or unchanged, with the report outcome and count of confirmed changed operations; duplicate add retains outcome=skipped, and unchanged does not deny transactions/idempotency receipts

#### Scenario: Invalid or failed research never reaches the writer
- **WHEN** structure/target validation fails, research fails, or abort precedes writing
- **THEN** show not_attempted, the applicable errorCode and zero committed operations; mark the failed check and leave unreached checks not_run

#### Scenario: Atomic writer rejects the item
- **WHEN** the writer throws under its atomic rollback guarantee
- **THEN** show writeState=rolled_back, errorCode=write_failed and zero committed operations; copy report researchStatus/outcome when available

#### Scenario: Transaction disposition is not established
- **WHEN** an unexpected failure leaves disposition uncertain
- **THEN** show unknown with null committed count and a fixed diagnostic, without guessing or changing recovery behavior
