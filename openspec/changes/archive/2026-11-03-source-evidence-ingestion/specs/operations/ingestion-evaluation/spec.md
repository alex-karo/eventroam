## MODIFIED Requirements

### Requirement: Cases have separate purpose and source labels

Each case SHALL declare its task, source origin, and `main` or `regression` suite. Fill, verify, and correct SHALL be distinct cases, even with shared pages. The initial main set SHALL contain five festival cases: captured Wacken, Roskilde, Sziget, and Afro Nation Portugal cases, and a synthetic Glastonbury case without source confirmation of its saved programme. Targeted workflow, Editor, and isolated Location regressions SHALL retain their checks. Isolated source-extraction cases SHALL reuse existing pages and preserve their origin labels.

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

### Requirement: Main evaluators define the checked data boundary

Only declared facts SHALL affect main completeness or factual errors. Required and additional facts SHALL state accepted values and the source evidence. Unlisted fields SHALL remain unchecked, subject to the saved-data protections below. Tomorrowland SHALL remain outside the suite until a case defines one festival identity.

#### Scenario: No source-supported facts are available

- **WHEN** all captured sources are blocked
- **THEN** required and additional completeness are N/A
- **AND** the case checks unchanged saved data, the expected source failure, and an unresolved question

#### Scenario: Full refresh also checks a saved Edition

- **WHEN** a fill case creates its next Edition and updates a selected saved Edition
- **THEN** declared additions must match their expectations
- **AND** additions to empty optional fields without expectations remain unchecked and earn no completeness credit
- **AND** populated saved fields, required fields, identities, publication, and declared coordinate rules stay protected

#### Scenario: An unchecked optional saved field is filled

- **WHEN** a saved Edition has no administrative area and its evaluator declares no expectation for that field
- **THEN** an added administrative area does not fail the case or earn completeness credit
- **AND** changing or clearing a populated saved administrative area still fails

#### Scenario: Add a declared locality point

- **WHEN** a saved Edition has no coordinates and its case permits a specific locality point
- **THEN** that exact point and locality precision may be added
- **AND** an existing point or a claim of exact precision remains protected

#### Scenario: Complete and publish a saved Edition

- **WHEN** the pages support a declared classification for an unclassified saved Edition
- **AND** its saved year, dates, and country satisfy the other publication gates
- **THEN** the case may accept that classification and publication
- **AND** other saved facts remain protected and earn no completeness credit
- **AND** generated version and update time do not count as factual changes

#### Scenario: Optional historical terms are incomplete

- **WHEN** a saved Edition starts without classification and the case allows specific supported historical terms
- **THEN** a subset of those terms is accepted without completeness credit
- **AND** a term outside the allowed set or a change to populated saved terms still fails

#### Scenario: Unlisted fields

- **WHEN** a field or ticket label has no explicit check
- **THEN** it earns no completeness credit and contributes no factual errors
- **AND** populated saved fields still have to remain equal


### Requirement: Ticket checks use declared structured facts

Main SHALL check returned admission offers only for `currentOrNextEdition`, including an ongoing Edition, against declared amount and currency pairs. Missing offers SHALL NOT reduce completeness. A returned offer SHALL need both values to match when both are declared. A case MAY explicitly accept a source-supported unpriced category by its label and availability, but both amount and currency MUST be absent. This exception MUST NOT permit arbitrary unpriced offers. Labels, terms, availability, and duplicate offers SHALL remain outside this general main check. Base price with full-programme coverage SHALL be one independent additional fact for the current-or-next slot only. A case MAY accept both the displayed price and its declared mandatory-fee total. General-purpose interpretation of ticket prose SHALL remain outside scoring. Historical ticket blocks and their offer URLs and Edition ticket links SHALL remain unchanged. A new historical draft SHALL NOT receive a ticket block or ticket link.

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

#### Scenario: Explicit sold-out categories have no published price

- **WHEN** Wacken returns Loyalty, Faster or Harder admission as sold out without amount and currency
- **THEN** those declared source-supported alternatives pass
- **AND** other unpriced labels or availability states do not pass that exception

#### Scenario: A case accepts a known base price as a floor

- **WHEN** a case explicitly accepts exact or from representation for its declared full-programme base price
- **THEN** either declared kind can match only at the allowed currency and amount with full-programme coverage
- **AND** Wacken permits EUR 364 or EUR 366 with equal minimum and maximum amounts
- **AND** range, free, other amounts and other coverage remain invalid for this alternative

### Requirement: Explicit model selection applies to every stage

The eval option `--model X` SHALL select X for every executed model call in each selected group, overriding the Location environment setting. Without the option, existing environment selection SHALL apply. Experiment metadata SHALL record the resolved model settings.

#### Scenario: Explicit model overrides the Location environment

- **WHEN** `CATALOG_LOCATION_MODEL` names Y and an eval runs with `--model X`
- **THEN** each executed model call uses X
- **AND** this applies to both `--all` and `--location-only` runs

#### Scenario: No explicit model is supplied

- **WHEN** an eval runs without `--model`
- **THEN** all calls except place-resolution calls use `OPENROUTER_MODEL` or its default
- **AND** Location uses `CATALOG_LOCATION_MODEL` when set, otherwise the same model

### Requirement: All groups can run together

One command SHALL support case and group selection. With no selection flags, it SHALL select five main cases. The `--all` option SHALL select all registered cases. The repeat count SHALL default to one. CLI output SHALL identify selected groups and case counts.

#### Scenario: Default run selects main cases

- **WHEN** the command runs without selection or repeat flags
- **THEN** it selects each of the five main cases once
- **AND** the CLI identifies the main pipeline group and five selected cases

#### Scenario: Full run includes a rejected scenario

- **WHEN** `--all` selects all registered cases and one scenario fails its checks
- **THEN** other groups still run and retain their results
- **AND** the command exits nonzero with separate group summaries


### Requirement: Quality and regression results stay separate

Results SHALL separate main pipeline, regression pipeline, regression editor, regression Location, and regression Reader groups. Main SHALL report quality dimensions. Regressions SHALL report a binary `scenario-success` score and pass only when every check passes. Isolated source extraction SHALL also report declared evidence recall and literal binding validity. Each check SHALL identify its path, result, and message. Location SHALL retain completion, correction, and preservation summaries. No combined quality average SHALL mix groups. Failed checks SHALL be explained in CLI output and saved results.

#### Scenario: Location correction fails

- **WHEN** Location preservation cases pass but a correction case keeps a known wrong point
- **THEN** the correction case fails its existing checks
- **AND** its subgroup result remains visible separately from preservation and main quality

#### Scenario: Regression checks a required mutation

- **WHEN** a dry-run regression requires a field change but the value is only present in the initial record
- **THEN** the required-change check fails and scenario-success is zero
- **AND** partial-object and collection checks compare only their declared conditions


## ADDED Requirements

### Requirement: Source evidence extraction can be assessed alone

Isolated source-extraction cases SHALL use fixed complete pages and code-defined requirements. They SHALL assess literal source binding, declared fact coverage with necessary context, availability to the required specialist through production topic routing, and declared metadata conditions. Expectations SHALL NOT enter the model input. A valid alternative quotation layout SHALL pass when it retains the same required passages and context. These cases SHALL run without discovery, downstream interpretation, catalog writes or a model judge.

#### Scenario: A date correction is omitted

- **WHEN** a source gives confirmed dates and explicitly rejects other dates
- **AND** the case declares requirements for both the confirmed dates and their correction
- **THEN** retaining only the confirmed dates fails the case
- **AND** reporting the correction only in a navigation summary does not satisfy it

#### Scenario: Ticket conditions remain attached

- **WHEN** a requirement declares an admission product, price, fee and applicability
- **THEN** its evidence must retain those passages together in one item and its context available to Tickets
- **AND** a quotation with literal context can pass without matching one fixed response layout

#### Scenario: Alternative topics reach the same specialist

- **WHEN** a required passage has a topic accepted by the named recipient in production
- **THEN** its availability check passes without requiring another specific topic label
- **AND** all required conditions and scope still belong to the same item and its context

#### Scenario: Invalid quotations are discarded

- **WHEN** source binding discards a returned quotation or its context
- **THEN** the case reports the binding failure as a diagnostic and gives that quotation no fact credit
- **AND** the scenario can pass only if accepted evidence meets every declared requirement
- **AND** an empty result fails and does not receive full binding credit
- **AND** a passing extraction scenario does not change production processing status or establish full-flow success

#### Scenario: Extraction volume is visible

- **WHEN** a case retains a large passage or repeats shared context
- **THEN** saved results report unique source coverage and extracted text volume
- **AND** these measurements do not replace the declared correctness checks
