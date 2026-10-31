## MODIFIED Requirements

### Requirement: Cases have separate purpose and source labels

Each case SHALL declare its task, source origin, and `main` or `regression` suite. Fill, verify, and correct SHALL be distinct cases, even with shared pages. The initial main set SHALL contain five festival cases: captured Wacken, Roskilde, Sziget, and Afro Nation Portugal cases, and a synthetic Glastonbury case without source confirmation of its saved programme. The remaining 45 cases SHALL retain their targeted regression checks, including 13 isolated Location cases.

#### Scenario: Shared sources serve different tasks

- **WHEN** fill and verify cases use the same pages
- **THEN** each has its own identity, seed, and expectations
- **AND** source origin does not determine its suite

#### Scenario: Synthetic verification retains realistic source noise

- **WHEN** the Glastonbury verification case adapts the official site to a scenario without a next-festival announcement
- **THEN** its pages retain navigation, unrelated news, separate local events and page controls
- **AND** archive navigation and the captured History 2025 page support an optional draft 2025 Edition with country GB and unknown programme dates
- **AND** body text, links and metadata do not confirm the next main festival programme
- **AND** the current saved Edition and draft Event checks remain in use
- **AND** no new Edition or one draft 2025 Edition with country GB and unknown dates is accepted; other new Editions, supplied historical dates and publication fail the case
- **AND** the historical year and country earn additional completeness credit; historical tickets and ticket links remain untouched and earn no completeness credit; capacity 210,000 does not support participant attendance
- **AND** provenance identifies the source captures and the synthetic edits

### Requirement: Research checks belong to each case

Each workflow case SHALL define expected source-check outcomes, Edition roles, supported and omitted facts, unresolved questions, and deliberate refusals. It SHALL declare required catalog changes, tool-use conditions, and place expectations. A case without an evaluator SHALL be rejected before model calls. A technical failure SHALL NOT satisfy an expected refusal.

#### Scenario: Review a Research refusal

- **WHEN** a case checks an identity-conflict refusal
- **THEN** its checks state the final decision, search, source and unresolved-question conditions
- **AND** a refusal passes only when those conditions are met

#### Scenario: One quote supports two facts

- **WHEN** one passage establishes the venue and supports the Event description
- **THEN** both resulting facts can use the same saved passage
- **AND** the case checks the two meanings without requiring independent sources

### Requirement: Experiment sources and writes are isolated

Workflow attempts SHALL start from declared seed data and date in a disposable catalog. Main SHALL use normal apply; workflow regressions SHALL retain dry runs. Isolated place evaluations SHALL use complete fixture input without catalog writes. No case SHALL modify the owner's catalog. Reads, searches, and geocoding SHALL use fixtures without live fallback. Evaluator expectations SHALL NOT enter model input.

#### Scenario: Repeated attempts and uncaptured sources

- **WHEN** a case repeats and requests an uncaptured page
- **THEN** it starts from a fresh seed and reports fixture access failure without a live read

#### Scenario: A main source fixture is missing

- **WHEN** a main case requests an uncaptured page
- **THEN** the result retains the source failure as a diagnostic without an independent scenario failure
- **AND** required facts, checked errors, execution, and task conditions still determine success
- **AND** no live request or invented source result replaces the missing fixture

#### Scenario: The page fixture is long

- **WHEN** a fixture contains a long page with relevant facts near its end
- **THEN** the case checks source-supported facts beyond an initial text prefix
- **AND** the result retains any processing limitation without claiming missing facts are absent
- **AND** no model receives evaluator expectations

### Requirement: Ticket checks use declared structured facts

Main SHALL check returned admission offers only for `currentOrNextEdition`, including an ongoing Edition, against declared amount and currency pairs. Missing offers SHALL NOT reduce completeness. A returned offer SHALL need both values to match when both are declared. Labels, terms, availability, and duplicate offers SHALL remain outside this general main check. Base price with full-programme coverage SHALL be one independent additional fact for the current-or-next slot only. A case MAY accept both the displayed price and its declared mandatory-fee total. General-purpose interpretation of ticket prose SHALL remain outside scoring. Historical ticket blocks and their offer URLs and Edition ticket links SHALL remain unchanged. A new historical draft SHALL NOT receive a ticket block or ticket link.

#### Scenario: Historical Glastonbury has a price without a product URL

- **WHEN** the captured page gives a historical price without a product URL for the optional previous Glastonbury 2025 Edition
- **THEN** no historical ticket block or ticket link is added or changed
- **AND** a historical ticket price earns no completeness credit
- **AND** the case checks historical preservation separately from current-or-next ticket interpretation

#### Scenario: An offer and base price repeat a wrong price

- **WHEN** an offer and base price each fail their price check
- **THEN** the report counts two errors and identifies both checks
- **AND** no-checked-errors is zero and the scenario fails

#### Scenario: Valid offer subset with varied labels

- **WHEN** the result contains a subset of valid offer combinations with different labels
- **THEN** offer checks pass without changing completeness denominators
- **AND** an unsupported amount and currency pair instead adds a factual error

#### Scenario: Displayed price and mandatory fees

- **WHEN** the source lists an offer price and a separate mandatory fee
- **THEN** its offer may use the declared displayed or total amount
- **AND** the full-programme base price may use either amount when both are declared alternatives

#### Scenario: The current festival is already running

- **WHEN** the fixed date falls inside the selected festival's inclusive local programme dates
- **THEN** its ticket facts remain in the current-or-next check
- **AND** a separate completed Edition remains outside ticket processing

#### Scenario: The official page has an overview and product links

- **WHEN** captured evidence distinguishes the Edition ticket overview from individual products
- **THEN** a targeted regression checks the overview in the Edition ticket slot
- **AND** an accepted ticket replacement contains no per-offer URLs

#### Scenario: The current price block has saved offer URLs

- **WHEN** no complete current-or-next ticket replacement is accepted
- **THEN** the saved block and its existing offer URLs remain unchanged
- **AND** an independently supported Edition ticket link can still change

### Requirement: Explicit model selection applies to every stage

The eval option --model X SHALL select X for every executed model call in each selected group, overriding the Location environment setting. Without the option, existing environment selection SHALL apply. Experiment metadata SHALL record the resolved model settings.

#### Scenario: Explicit model overrides the Location environment

- **WHEN** `CATALOG_LOCATION_MODEL` names Y and an eval runs with `--model X`
- **THEN** each executed model call uses X
- **AND** this applies to both `--all` and `--location-only` runs

#### Scenario: No explicit model is supplied

- **WHEN** an eval runs without `--model`
- **THEN** all calls except place-resolution calls use `OPENROUTER_MODEL` or its default
- **AND** Location uses `CATALOG_LOCATION_MODEL` when set, otherwise the same model

## ADDED Requirements

### Requirement: Missing geocoding fixtures return unavailable

In every eval group, a geocoding request without a matching fixture SHALL return `unavailable`. This SHALL represent a simulated tool failure. It SHALL NOT trigger a live request or return an invented empty result. The request and error SHALL remain in observations. The error alone SHALL NOT fail the case. Execution and case checks SHALL determine success.

#### Scenario: An initial geocoding fixture is missing

- **WHEN** reverse or forward geocoding has no matching fixture in any eval group
- **THEN** the request returns `unavailable` and its observation remains available
- **AND** no live geocoding request is made

#### Scenario: A request uses different parameters

- **WHEN** ingestion makes another geocoding request with different parameters and no fixture matches
- **THEN** that request also returns `unavailable`
- **AND** the result does not claim that the real provider failed or found no candidates

#### Scenario: A valid decision follows a missing fixture

- **WHEN** a case receives `unavailable` for a missing fixture and execution and all case checks pass
- **THEN** the case passes

#### Scenario: A wrong decision follows a missing fixture

- **WHEN** a case receives `unavailable` for a missing fixture and its decision fails a case check
- **THEN** the case fails with the failed-check diagnostic

### Requirement: Eval observations separate execution usage and quality

Eval outputs SHALL retain run IDs and available real trace IDs. Tokens and cost SHALL remain in optional execution observations without separate eval totals. Missing metrics SHALL NOT become zero or fail an eval. Duration SHALL remain separate from quality. Stage models and prompt versions SHALL identify the executed model configuration.

#### Scenario: Tracing is disabled

- **WHEN** a workflow or isolated Location eval runs without tracing
- **THEN** its output retains its run ID and available decisions without a fabricated trace ID, token count, or cost
- **AND** budget counters and tool observations remain usable by checks

#### Scenario: Tracing records place checks

- **WHEN** enabled tracing records an eval with place checks
- **THEN** the saved output retains available correlation to its execution observations
- **AND** each saved experiment result links to its real trace
- **AND** traces and metrics identify the experiment for token and cost inspection
- **AND** Place-check usage can be inspected separately from other execution work without an eval spending total

## REMOVED Requirements

### Requirement: Geocoding fixture gaps use a tool error

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Missing geocoding fixtures return unavailable" retains the domain checks. Internal contracts belong in the design.

### Requirement: Eval usage inspection separates usage from quality

**Reason**: The old block mixes domain outcomes with internal execution requirements.

**Migration**: The replacement "Eval observations separate execution usage and quality" retains the domain checks. Internal contracts belong in the design.
