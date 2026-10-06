# Source-backed catalog workflow

## Purpose

Supports owner-initiated catalog collection and refresh while preserving durable identities, accepted facts, and attributable run outcomes.

## Requirements

### Requirement: Source reads use bounded HTTP without script execution
The source reader SHALL retrieve public pages through bounded HTTP requests and SHALL NOT execute page scripts. It SHALL retain the source URL, retrieval time, outcome, and extracted Markdown. A page whose useful content appears to require script execution SHALL be reported as partial, so its missing facts are not treated as verified absences.

#### Scenario: HTML has useful source content
- **WHEN** a public HTML response contains readable festival facts
- **THEN** the reader extracts those facts and links without executing page scripts

#### Scenario: HTML depends on scripts for useful content
- **WHEN** a public HTML response has application scripts but little non-navigation text
- **THEN** the reader returns its available HTTP content with a partial outcome and a reason indicating that JavaScript is required
- **AND** it does not launch a browser or claim that missing facts were verified absent

#### Scenario: Unsafe HTTP destination
- **WHEN** a source URL or redirect points to a non-public address
- **THEN** the reader blocks the request before connecting to that destination

### Requirement: Collection runs are owner initiated
The system SHALL start discovery, source checks, and refreshes only through an owner-initiated local operation in the first version. Model calls SHALL use OpenRouter. Legacy import, server execution, and unattended scheduling are outside this change's scope.

#### Scenario: No unattended refresh
- **WHEN** no owner starts a run
- **THEN** the catalog does not autonomously discover or refresh records

#### Scenario: Owner starts a local run
- **WHEN** the owner initiates a collection run locally
- **THEN** the run can complete without a deployed collection server and uses OpenRouter for any model calls

#### Scenario: Default research model

- **WHEN** no model override is configured
- **THEN** research uses `openai/gpt-6-luna`
- **AND** `OPENROUTER_MODEL` can select another compatible model
- **AND** the default output allowance is 16,000 tokens per model call, including reasoning, overridable through `CATALOG_MAX_MODEL_OUTPUT_TOKENS`

### Requirement: Local catalog commands target Events without operator labels
The local catalog CLI SHALL accept a festival name for `add`, exactly one Event ID for `refresh`, and one or more Event IDs for `check`. It SHALL NOT require an operator name or accept an Occurrence ID as a target. Applied changes SHALL retain the fixed research actor in audit history; the initiating owner MAY be absent.

#### Scenario: Add without an operator name
- **WHEN** a local user starts `add` with a festival name and no operator name
- **THEN** research can run and applied changes identify `catalog-research` as the actor

#### Scenario: Check several Events
- **WHEN** a local user starts `check` with several Event IDs
- **THEN** each Event is researched independently with its relevant editions

#### Scenario: Unsupported CLI targets
- **WHEN** a local user supplies an operator or Occurrence target flag
- **THEN** the CLI rejects the unsupported flag before research starts

### Requirement: Festival addition covers historical and announced editions
The system SHALL research a new festival's identity, latest completed edition, and next announced edition, collect official links, and produce a short factual English Event description from the model’s source interpretation. Edition-specific facts SHALL remain associated with their own Occurrences. Missing information SHALL remain unknown; an unannounced next edition SHALL NOT be invented from prior-year dates or location.

#### Scenario: Both editions are documented
- **WHEN** official sources document the latest completed edition and the next announced edition
- **THEN** the run collects their facts separately under the same matched Event, collects official links, and generates a factual English description without presenting historical details as current

#### Scenario: No next edition is announced
- **WHEN** the inspected sources support a completed edition but no next edition
- **THEN** the run retains the supported history and reports that no next announcement was found in those sources without creating a forecast Occurrence

### Requirement: Existing events can be validated and refreshed
The system SHALL support research of existing Event and edition information and apply the model's proposed changes through catalog operations. Missing optional information SHALL NOT block other proposed changes or eligible publication.

#### Scenario: Existing venue changes
- **WHEN** the model proposes a new venue for an existing Occurrence
- **THEN** the refresh updates that Occurrence while preserving other editions' locations and reporting unresolved fields

### Requirement: Known links can be checked for new information
The system SHALL support checks of known event and edition links for new or changed information, including dates, location, and ticket availability. A page-content change alone SHALL NOT write a catalog change; the model must propose a changed catalog value. Checks MAY use the same collection process as a full refresh; a separate monitoring engine or stored page-diff history is not required.

#### Scenario: Page changes without fact changes
- **WHEN** a known page changes wording but supports the same accepted catalog facts
- **THEN** the run reports the catalog facts as unchanged and creates no duplicate catalog change

### Requirement: Social links remain usable without content retrieval
The system SHALL preserve stored Facebook and Instagram links for catalog display while reporting their automated content retrieval as unsupported in the first version. Unsupported retrieval SHALL NOT by itself clear stored values.

#### Scenario: Festival has a website and Instagram link
- **WHEN** a run checks a festival with an accessible official website and an Instagram link
- **THEN** it processes the website, retains the Instagram link, and reports Instagram retrieval as unsupported without blocking other model-proposed facts

### Requirement: Candidate matching respects enduring Event identity
The model SHALL use linked URLs, available official IDs, canonical URLs, name, geography, and edition facts to select an Event without requiring a separate source registry. It SHALL keep parallel festivals under one brand as separate Events while preserving one Event when a festival relocates between years. The host SHALL accept a structurally valid Event selection without independently resolving ambiguous matches.

For `refresh` and `check`, research SHALL load only the requested Event's private context.

#### Scenario: Unrelated catalog records are excluded from targeted research
- **WHEN** a refresh or check targets one Event in a catalog with unrelated Events
- **THEN** the agent receives only the requested Event's private context

#### Scenario: Same brand in different countries
- **WHEN** two recurring festivals share a brand but operate in different countries at the same time
- **THEN** candidate matching preserves separate Event identities

#### Scenario: A festival relocates
- **WHEN** official continuity establishes that a recurring festival moved to a new location
- **THEN** a new edition is linked to the existing Event instead of creating a second Event

### Requirement: Model output is accepted as the research decision
The model SHALL select the Event, editions, facts, and links from inspected material. The host SHALL accept its factual interpretation without validating quote membership, source authority, ticket-link provenance, contradictions, or supersession. Omitted fields SHALL preserve stored values; a supplied complete price block SHALL replace stored prices. Schema validation and requested Event/Occurrence target checks still apply. Model evals SHALL measure factual quality.

#### Scenario: A source claim is semantically wrong
- **WHEN** the model returns a structurally valid but mistaken fact
- **THEN** the host does not perform a second semantic check and the model eval can flag the resulting change

#### Scenario: Inspected sources conflict
- **WHEN** the model proposes a structurally valid fact despite a conflict between inspected sources
- **THEN** the host applies the proposal without dropping the field for lack of confirmation

#### Scenario: Model omits a price block
- **WHEN** the model omits prices after a failed source read
- **THEN** the stored price block is preserved

### Requirement: Runs report attributable outcomes
The system SHALL report each run's mode (`add`, `refresh`, or `check`) and resulting record outcome (`created`, `updated`, `published`, `unchanged`, `skipped`, or `failed`), with stable catalog identifiers where a record exists. Reports SHALL include the run's proposed or applied old/new values and inspected source URLs. Source-check results SHALL identify the inspected URL, UTC check time, and outcome, distinguishing unsupported retrieval from successful checks and failures. Reports SHALL NOT require persistent source identifiers or catalog run records.

#### Scenario: Preserve the final model response
- **WHEN** a model generation returns a final response
- **THEN** private research and eval reports retain its final text and unnormalized structured object in `modelResponse`, separately from catalog operations
- **AND** the response remains available when candidate validation or writing fails
- **AND** unavailable responses or components are recorded as null, without copying prompts, page bodies, or transport metadata

#### Scenario: Reasoning configuration and token accounting

- **WHEN** the owner configures a supported reasoning effort
- **THEN** research and discovery requests send that effort and reports identify the requested setting
- **AND** omitting the setting explicitly selects `medium`
- **AND** reports include provider-reported cached input and reasoning token counts as subsets of total input and output, using null when details are unavailable or a generation is interrupted

#### Scenario: Unchanged recheck
- **WHEN** a recheck confirms the current accepted facts without changes
- **THEN** the run reports unchanged and creates no duplicate catalog change

#### Scenario: Source cannot be fetched
- **WHEN** a known source fails to load and the model proposes no changes
- **THEN** the report identifies the attempted URL, check time, and failure without changing catalog facts or audit history

### Requirement: Dry runs preview changes without applying them
The system SHALL let the owner inspect a transient diff of proposed catalog changes before an apply run. Dry-run SHALL use a transaction on the catalog database and roll it back without retained record, version, audit, or receipt changes; it SHALL NOT create a database copy.

#### Scenario: Dry run of a venue correction
- **WHEN** the owner requests a dry run for a model-proposed venue change
- **THEN** the output shows the proposed old and new values while the catalog version and audit history remain unchanged

### Requirement: Eligible apply runs publish without review queues
The system SHALL apply and publish model-proposed, structurally eligible records directly through catalog operations, with atomic audit history and no per-item or batch approval task.

#### Scenario: Complete new festival
- **WHEN** an owner-initiated run proposes a new in-scope Event and Occurrence with all structurally required publication facts
- **THEN** the apply operation publishes them, records the changes atomically, and reports stable identifiers

### Requirement: Interrupted collection can be rerun from current state
After interruption, a new owner-initiated run SHALL reload the catalog and research again with new operation keys. Committed changes SHALL remain; incomplete item transactions SHALL roll back. Existing writer receipt idempotency SHALL remain supported. Automatic run recovery and a history-viewing command are outside this change.

#### Scenario: Owner reruns after interruption
- **WHEN** a run stops after one festival is committed and the owner starts it again
- **THEN** the new run uses current catalog state without duplicating that festival or resuming a saved operation file

### Requirement: One model response uses a direct catalog adapter
The research model SHALL return one structured candidate after any tool calls. The host SHALL validate its schema and requested Event/Occurrence targets, preserve omitted values, and map its proposal into catalog operations. The host SHALL NOT run validation feedback rounds, check citations, or trial-apply groups to a temporary database. The existing writer SHALL enforce structural rules, versions, no-op detection, publication scope, and atomic transactions. A structurally invalid operation SHALL fail the item transaction.

#### Scenario: One proposal contains invalid catalog data
- **WHEN** the model proposes an invalid date or price alongside other values for one item
- **THEN** the writer rolls back the whole item and the run reports a write failure

#### Scenario: Research needs a more specific page
- **WHEN** an inspected page leaves a material question unresolved
- **THEN** the agent may read a relevant linked page or discover a source within its budget before returning its one candidate

#### Scenario: Saved links are available without eager retrieval
- **WHEN** a refresh or check starts with saved links
- **THEN** the host initially reads the first official-site link, or the first link if none is marked as an official site
- **AND** every saved link is included in the agent's input with its owner and edition context where known

#### Scenario: Addition starts without a source URL
- **WHEN** the owner starts `add` with a festival name
- **THEN** the agent discovers and inspects a candidate source before returning its proposal

#### Scenario: Tool calls include explanatory text
- **WHEN** an intermediate model response includes source-tool calls and explanatory text
- **THEN** the research loop executes the tools and continues within the shared budget
- **AND** the final result must pass strict candidate-schema validation before it can produce catalog operations
