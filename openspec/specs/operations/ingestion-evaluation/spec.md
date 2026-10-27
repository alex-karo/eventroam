# Ingestion evaluation

## Purpose

Define controlled ingestion experiments that separate catalog quality from targeted regressions and retain results for model comparison.

## Requirements

### Requirement: Cases have separate purpose and source labels

Each case SHALL declare its task, source origin, and `main` or `regression` suite. Fill, verify, and correct SHALL be distinct cases, even with shared pages. The initial main set SHALL contain five festival cases: captured Wacken, Roskilde, Sziget, and Afro Nation Portugal cases, and a synthetic Glastonbury case without source confirmation of its saved programme. The remaining 45 cases SHALL retain their targeted regression checks, including 13 isolated Location cases.

#### Scenario: Shared sources serve different tasks

- **WHEN** fill and verify cases use the same pages
- **THEN** each has its own identity, seed, and expectations
- **AND** source origin does not determine its suite

#### Scenario: Synthetic verification retains realistic source noise

- **WHEN** the Glastonbury verification case adapts the official site to a scenario without a next-festival announcement
- **THEN** its pages retain navigation, unrelated news, separate local events and page controls
- **AND** archive years are navigation only, without readable historical programme pages
- **AND** body text, links and metadata do not confirm the main festival programme
- **AND** the current saved Edition and draft Event checks remain in use
- **AND** provenance identifies the source captures and the synthetic edits

### Requirement: All groups can run together

One command SHALL support case and group selection. With no selection flags, it SHALL select five main cases. The `--all` option SHALL select all 50 cases. The repeat count SHALL default to one. CLI output SHALL identify selected groups and case counts.

#### Scenario: Default run selects main cases

- **WHEN** the command runs without selection or repeat flags
- **THEN** it selects each of the five main cases once
- **AND** the CLI identifies the main pipeline group and five selected cases

#### Scenario: Full run includes a rejected scenario

- **WHEN** `--all` selects all 50 cases and one scenario fails its checks
- **THEN** other groups still run and retain their results
- **AND** the command exits nonzero with separate group summaries

### Requirement: Quality and regression results stay separate

Results SHALL separate main pipeline, regression pipeline, regression editor, and regression Location groups. Main SHALL report quality dimensions; regressions SHALL report scenario success and failed checks. Location SHALL retain completion, correction, and preservation summaries. No combined quality average SHALL mix groups. Regression evaluators SHALL return checks with `path`, `passed`, and `message`, and SHALL pass only when every check passes. They SHALL expose one binary `scenario-success` score without intermediate completeness, correctness, Research, or tool-use scores. Failed-check messages SHALL provide the CLI diagnostics and Mastra reason without separate diagnostic categories.

#### Scenario: Location correction fails

- **WHEN** Location preservation cases pass but a correction case keeps a known wrong point
- **THEN** the correction case fails its existing checks
- **AND** its subgroup result remains visible separately from preservation and main quality


#### Scenario: Regression checks a required mutation

- **WHEN** a dry-run regression requires a field change but the value is only present in the initial record
- **THEN** the required-change check fails and scenario-success is zero
- **AND** existing partial-object and collection matching rules remain in use

### Requirement: Research checks belong to each case

Research conditions SHALL use explicit TypeScript case functions and small shared helpers. The functions SHALL define expected statuses, Edition slots, returned and omitted facts, unresolved questions, and deliberate refusals. JSON fixtures SHALL retain mutation, tool-use and Location expectations without an `expectations.research` schema or shared interpreter. Loading SHALL require a registered evaluator for every workflow case. Moving the conditions SHALL preserve their check meanings, including partial matching and technical-failure rejection.

#### Scenario: Review a Research refusal

- **WHEN** a case checks an identity-conflict refusal
- **THEN** its function states the Editor, search, source and unresolved-question conditions
- **AND** it reuses the common deliberate-refusal checks without branching on a JSON failure reason

### Requirement: Experiment sources and writes are isolated

Workflow attempts SHALL start from their declared seed and date in a disposable catalog. Main SHALL use normal apply through Research, Editor, and Location; workflow regressions SHALL retain dry runs. Isolated Location SHALL use complete fixture input without catalog writes. None SHALL modify the owner's catalog. Reads, searches, and geocoding SHALL use fixed fixtures without live fallback. Evaluator expectations SHALL NOT enter model input.

#### Scenario: Repeated attempts and uncaptured sources

- **WHEN** a case repeats and requests an uncaptured page
- **THEN** it starts from a fresh seed and reports fixture access failure without a live read

#### Scenario: Main source or geocoding fixture is missing

- **WHEN** a main case requests an uncaptured page or geocoding response
- **THEN** the result retains the source failure or fixture_miss observation as a diagnostic without an independent scenario failure
- **AND** required facts, checked errors, execution, and task conditions still determine success
- **AND** no live request or invented provider result replaces the missing fixture
- **AND** regression fixture-miss checks stay unchanged

### Requirement: Main evaluators define the checked data boundary

Main SHALL use explicit TypeScript case evaluators and shared fact, identity, preservation, and execution helpers. Only listed facts SHALL affect completeness or factual errors. Required and additional facts SHALL have explicit alternatives and source comments. Unlisted fields SHALL remain unchecked. Main fixtures SHALL NOT contain regression mutation assertions or a separate gold file. The old field-policy schema and scorer SHALL be removed. Tomorrowland SHALL remain outside the suite until a new case defines one festival identity.

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

#### Scenario: Unlisted fields

- **WHEN** a field or ticket label has no explicit check
- **THEN** it earns no completeness credit and contributes no factual errors
- **AND** populated saved fields still have to remain equal

### Requirement: Equivalent values pass without hiding errors

Main comparisons SHALL accept declared alternatives and defined normalization. Main checks SHALL treat `announced` and `scheduled` as equivalent, including saved Edition preservation. This exception SHALL NOT cover `cancelled` or `postponed`. They SHALL distinguish missing facts from wrong assertions, including wrong extras. Errors SHALL identify their record and field or fact unit. The error count SHALL count failed factual checks. Equivalent forms SHALL NOT earn extra credit.

#### Scenario: URL alternatives

- **WHEN** a link matches a declared alternative
- **THEN** it passes
- **AND** a different path or query is not accepted merely because its host matches

#### Scenario: Expected alternatives missed a valid value

- **WHEN** a value differs from the accepted alternatives
- **THEN** its check fails without an uncertain verdict
- **AND** a correction to expected values requires fresh runs for the models being compared

### Requirement: Ticket checks use declared structured facts

Main SHALL check each returned admission offer against accepted URL, amount, and currency combinations. Missing offers SHALL NOT reduce completeness. A returned offer SHALL need all three values to match. Labels, terms, availability, and duplicate offers SHALL remain outside this check. Base price with full-programme coverage SHALL be one independent additional fact. A case MAY accept both the displayed price and its declared mandatory-fee total. General interpretation of ticket prose SHALL remain outside scoring.

#### Scenario: An offer and base price repeat a wrong price

- **WHEN** an offer and base price each fail their price check
- **THEN** the report counts two errors and identifies both checks
- **AND** no-checked-errors is zero and the scenario fails

#### Scenario: Valid offer subset with varied labels

- **WHEN** the result contains a subset of valid offer combinations with different labels
- **THEN** offer checks pass without changing completeness denominators
- **AND** an unsupported product or contradictory price instead adds a factual error

#### Scenario: Displayed price and mandatory fees

- **WHEN** the source lists an offer price and a separate mandatory fee
- **THEN** its offer may use the declared displayed or total amount
- **AND** the full-programme base price may use either amount when both are declared alternatives

### Requirement: Main completeness separates required and additional facts

Main results SHALL show correct/expected counts and fractions for required and additional facts. Zero expected facts SHALL produce N/A. Missing additional facts alone SHALL lower completeness without failing the scenario. Wrong additional facts SHALL count as errors. Fact-unit rules SHALL be fixed per scorer version.

#### Scenario: Optional price is missing or wrong

- **WHEN** an available optional base price is omitted
- **THEN** additional completeness falls without a scenario failure from that omission
- **AND** an asserted wrong price earns no credit, adds a fact-unit error, and fails the scenario

### Requirement: Scenario success includes the assigned task

Main success SHALL require correct available required facts, zero checked errors, expected publication, and declared task and preservation conditions. Regression success SHALL retain its existing check meanings. Unexpected execution failures SHALL fail either group. Main factual scores SHALL use final catalog data without duplicate Research confirmation checks. Expected source failures SHALL still match the declared outcome.

#### Scenario: Final facts lack a duplicate Research confirmation

- **WHEN** checked final facts are correct but a fill report omits a duplicate Research confirmation
- **THEN** this omission alone does not fail the main case
- **AND** targeted verification regressions retain their evidence checks

#### Scenario: Refusal is expected

- **WHEN** a case expects an identity-conflict refusal
- **THEN** success requires the expected diagnostic, question, and preserved catalog
- **AND** a technical failure does not pass merely because no data changed

### Requirement: Main identity and protected data are checked

Main comparisons SHALL distinguish Event and Edition identities without relying on generated IDs or year alone. They SHALL reject unexpected records and changes to protected data. Evaluator factual and publication expectations SHALL be independent of production validation.

#### Scenario: Same-year Editions and duplicates

- **WHEN** two Editions share a year
- **THEN** saved IDs, newly created records, and writer references determine the match
- **AND** an ambiguous match or extra duplicate fails the scenario

#### Scenario: Structurally valid false facts

- **WHEN** an invented date passes structural validation
- **THEN** the evaluator still rejects it

### Requirement: Experiment results remain available for inspection

Saved experiments SHALL retain case identity, task output, check diagnostics, relevant tool observations, model/prompt configuration, and evaluation revision. Main results SHALL also retain before/after catalogs. Results SHALL remain available after restart for viewing and comparison. Files SHALL remain the source of case definitions. The CLI SHALL reuse an existing dataset by ID without reading saved items or comparing saved content. It SHALL create and populate a dataset only when that ID is absent, then pin its current native version for the experiment.

#### Scenario: Reuse a saved dataset

- **WHEN** a dataset with the computed ID already exists
- **THEN** the CLI reuses it without adding duplicate items or checking saved content
- **AND** manual Studio edits are not detected or imported back to repository files

#### Scenario: Inspect a completed experiment

- **WHEN** the experiment viewer is reopened after a run
- **THEN** each item's output, scores, and diagnostics remain available
- **AND** original results are not replaced by a later run

#### Scenario: Eval output uses stored experiments

- **WHEN** an eval command completes
- **THEN** the CLI shows group summaries, failed checks, and experiment IDs for inspection in Studio
- **AND** the eval command has no `--report` option and writes no separate JSON report file

#### Scenario: Experiment storage rejects a write

- **WHEN** experiment storage rejects a result or score write
- **THEN** Mastra's native error or warning behavior applies without custom recovery or post-run storage checks
- **AND** complete saved results and a nonzero CLI exit are not guaranteed for this exceptional case

### Requirement: Experiment names identify development runs

Experiment names SHALL contain the current Git branch, eval group and model, with an optional `--label` suffix. Isolated Location SHALL use its resolved model. Detached HEAD SHALL use the first eight commit characters in place of a branch. Experiment metadata SHALL retain the full commit, branch or null, a dirty flag for tracked changes or untracked files, and the label or null. The CLI SHALL display the name. Branch, commit, dirty state, label and model SHALL NOT change dataset identity. Each run SHALL create a separate experiment even when names match.

#### Scenario: Compare before and after a code change

- **WHEN** unchanged evaluation cases and rules run with different commits or labels
- **THEN** each experiment retains its own name and Git metadata
- **AND** both experiments use the same dataset

#### Scenario: Run without a branch or label

- **WHEN** a detached HEAD runs an eval without `--label`
- **THEN** its name uses the short commit, group and model without a label suffix
- **AND** metadata retains null branch and label values

### Requirement: Valid model comparisons use the same evaluation revision

Valid comparisons SHALL use the same group, selected cases, inputs, expectations, scorer rules, and uniform repeat count. Inputs SHALL include geocoding fixtures and complete isolated Location inputs. Experiment metadata SHALL expose stage models, prompt versions, workflow, and runtime settings. N/A SHALL be excluded with applicable counts visible. Partial results SHALL NOT be presented as a complete comparison.

#### Scenario: Inputs or scoring rules change

- **WHEN** any JSON/MD/TypeScript file under cases, main.ts, case-research.ts, research.ts, or a non-test TypeScript file under main changes
- **THEN** its file name and full contents affect one shared file hash for all groups
- **AND** dataset identity combines that hash with the group, sorted selected case IDs, repeat count and explicit scorer version
- **AND** whitespace and changes to unselected cases may create new datasets
- **AND** metadata stores the hash without source snapshots, and each item ground truth contains only its case expectations
- **AND** scoring changes outside the hashed files need an explicit scorer-version update
- **AND** old and new runs remain inspectable but are not a valid quality comparison

#### Scenario: Repeat counts or case sets differ

- **WHEN** selections or repeat counts differ
- **THEN** results belong to different evaluation revisions
- **AND** no custom common-subset or unequal-repeat comparison is required

### Requirement: Explicit model selection applies to every stage

The eval option `--model X` SHALL select X for Research, Editor, and Location in every selected group, overriding the Location environment setting. Without this option, existing environment model selection SHALL apply. Experiment metadata SHALL record resolved stage models.

#### Scenario: Explicit model overrides the Location environment

- **WHEN** `CATALOG_LOCATION_MODEL` names Y and an eval runs with `--model X`
- **THEN** each executed Research, Editor, or Location stage uses X
- **AND** this applies to both `--all` and `--location-only` runs

#### Scenario: No explicit model is supplied

- **WHEN** an eval runs without `--model`
- **THEN** Research and Editor use `OPENROUTER_MODEL` or its default
- **AND** Location uses `CATALOG_LOCATION_MODEL` when set, otherwise the same model

### Requirement: Eval usage inspection uses native observability

Eval outputs SHALL retain run IDs and available real trace IDs. Tokens and cost SHALL remain in optional native observability without eval totals. Missing metrics SHALL NOT become zero or fail an eval. Duration SHALL remain separate from quality. Stage models and prompt versions SHALL identify Research, Editor, and Location.

#### Scenario: Tracing is disabled

- **WHEN** a workflow or isolated Location eval runs without tracing
- **THEN** its output retains its run ID and available decisions without a fabricated trace ID, token count, or cost
- **AND** budget counters and tool observations remain usable by checks

#### Scenario: Tracing records Location execution

- **WHEN** enabled tracing records an eval that executes Location
- **THEN** the saved output retains available correlation to its native observations
- **AND** each saved experiment result links to its real trace
- **AND** native traces and metrics carry the experiment ID for Studio's token and cost queries
- **AND** Location usage can be inspected separately from Research and Editor without an eval spending total

### Requirement: Execution and quality failure stay distinct

The command SHALL fail on rejected scenarios or unexpected task/scorer failures. Intentional N/A SHALL NOT independently fail it. Reports SHALL distinguish task completion from quality success and explain failed checks. Experiment storage failures SHALL retain Mastra's native behavior.

#### Scenario: Completed task fails quality

- **WHEN** a completed task returns wrong checked facts
- **THEN** it is a failed scenario and the command exits nonzero with diagnostics

#### Scenario: N/A versus scorer failure

- **WHEN** a dimension has no expected facts
- **THEN** it is N/A rather than a scorer exception
- **AND** unexpected scorer exceptions still fail execution
