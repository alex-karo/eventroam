# Spec Delta

## ADDED Requirements

### Requirement: Local research tracing is optional and independent

The owner SHALL be able to enable research-agent, model, and tool tracing without sampling. Local persistence SHALL be best effort. Tracing SHALL NOT change research decisions, budgets, provider retries, catalog writes, report schema, or exit status. Integration failures SHALL emit bounded application diagnostics independently of research results; additional local LibSQL technical errors and stacks are permitted.

#### Scenario: Tracing is disabled by default

- **WHEN** the owner runs research without enabling tracing
- **THEN** research creates no trace store or trace records

#### Scenario: An enabled agent uses tools

- **WHEN** a traced research agent calls the model and source tools
- **THEN** the saved trace shows their parent relationships, operation names, timing, and available technical error status
- **AND** application metadata includes mode, model, prompt version, and requested Event ID when one was supplied

#### Scenario: Trace persistence fails

- **WHEN** the local trace store cannot initialize or persist data
- **THEN** a fixed application tracing diagnostic code is emitted in stderr without raw payloads, including when the exporter handles the error internally
- **AND** LibSQL's private logger may additionally emit original technical errors and stacks in local stderr, without forwarding them into observability storage or research reports
- **AND** research retains its own result, report format, budgets, and exit status

### Requirement: Exported research traces exclude content payloads

Persisted research spans SHALL exclude prompts, source-page bodies, model responses, tool input/output payloads, credentials, transport headers and bodies, and raw exception messages or stacks. Traces SHALL retain operation identity, timing, relationships, bounded application metadata, and safe technical diagnostics. Existing private research reports SHALL retain their current final-output contract.

#### Scenario: Content appears in multiple span fields

- **WHEN** prompts, pages, model output, or secrets appear in span inputs, outputs, attributes, or error details
- **THEN** none of that content appears in the persisted trace or its exported JSON
- **AND** the trace still identifies model and tool operations and their timing

#### Scenario: Span sanitization fails

- **WHEN** sanitization cannot safely prepare a span for export
- **THEN** that span is dropped and a fixed diagnostic code is emitted without its contents
- **AND** the unsanitized span is not persisted and research retains its own result

### Requirement: Research tracing does not forward SDK logs

Research tracing SHALL disable forwarding of agent and SDK log events to observability storage. Fixed application tracing diagnostics SHALL remain separate from observability logs and SHALL exclude original log messages and metadata. Additional technical errors and stacks emitted by LibSQL's private logger to local stderr are outside this diagnostic-format guarantee.

#### Scenario: SDK logs contain private content

- **WHEN** an agent or SDK logs a prompt, page body, model response, credential, or raw error during a traced invocation
- **THEN** the log event is absent from observability storage and its exports

### Requirement: Local traces use best-effort persistence and can be inspected

Enabled tracing SHALL use a dedicated local store separate from the catalog database. Saved spans SHALL remain inspectable after exit through a local browser interface without a hosted account. Normal completion, handled errors, and cooperative aborts SHALL await explicit flush and shutdown attempts. Completeness is not guaranteed when background writes overlap another flush or storage shutdown, or after forced termination.

#### Scenario: Inspect a finished invocation

- **WHEN** an enabled invocation finishes and the owner starts the local trace interface
- **THEN** its saved trace is available for inspection without rerunning research
- **AND** opening the interface requires neither a catalog database nor a model API credential
- **AND** the interface registers no catalog research agents or mutation workflows

#### Scenario: A generation fails or is cooperatively aborted

- **WHEN** an enabled generation throws or returns through its abort cleanup
- **THEN** an explicit flush of buffered completed and terminal spans is awaited before closing the trace store and before research returns
- **AND** any cleanup failure does not replace the research result or its original error

#### Scenario: A short invocation finishes before automatic persistence

- **WHEN** a traced invocation finishes while its final spans remain buffered
- **THEN** after the process exits, its final spans can be read from the trace store by a new process

#### Scenario: Background persistence overlaps another flush or cleanup

- **WHEN** an SDK background write remains in progress while another flush or trace-store shutdown occurs
- **THEN** the stored trace may have missing spans or missing terminal updates under the accepted best-effort persistence policy
- **AND** research retains its own result, report format, budgets, retry policy, and exit status

#### Scenario: Flushing fails during cleanup

- **WHEN** flushing pending spans fails
- **THEN** a fixed diagnostic code is emitted and resource shutdown is still attempted
- **AND** flush or shutdown errors do not replace the generation result or its original error

#### Scenario: Injected research fixture bypasses the agent

- **WHEN** research uses an injected candidate generator instead of the real agent
- **THEN** it creates no agent trace or trace store

#### Scenario: Cleanup crosses the research deadline

- **WHEN** the model finishes before its deadline but tracing cleanup finishes after it
- **THEN** the original model result or provider failure is preserved instead of becoming a research timeout
- **AND** an actual generation timeout retains its budget-failure classification
