# Spec Delta

## MODIFIED Requirements

### Requirement: Full scope assigns saved history and the next candidate

Full instructions MUST assign Event summary and shared links, the latest completed Edition, and the ongoing or nearest announced future Edition.
They MUST request checks of all supported fields of those selected Editions, whether saved or new.
Other saved Editions MUST remain context for matching, country checks, and classification reuse.
They MUST NOT require a separate field audit or become update targets.
The research model MUST report known unfinished mandatory checks.
The application MUST trust the model's account without a separate coverage record.
Success MUST NOT certify that all assigned checks were complete.

#### Scenario: Full refresh has saved history

- **WHEN** full refresh finds a new future announcement and has several saved historical Editions
- **THEN** it checks Event fields, the latest completed Edition, and the current-or-next candidate
- **AND** unfinished checks of those roles remain visible
- **AND** other saved Editions remain context without mandatory field checks

#### Scenario: Both selected Editions are missing

- **WHEN** inspected sources support a previous and current-or-next Edition absent from saved state
- **THEN** full can create both under the targeted Event
- **AND** the former limit of one new Edition does not apply

#### Scenario: A large saved history remains context

- **WHEN** the Event has more than twenty saved Editions
- **THEN** the saved count alone does not reject the two-slot result
- **AND** no twenty-Edition limit applies to saved context combined with selected new keys
- **AND** existing context and deadline limits still apply without silent truncation

#### Scenario: A farther future Edition already exists

- **WHEN** the nearest and farther future Editions are both saved
- **THEN** full checks only the ongoing or nearest future Edition for the current-or-next role
- **AND** it preserves the farther Edition as context

#### Scenario: Other unsaved history exists

- **WHEN** full completes the Event checks and both Edition-role checks
- **THEN** it does not require discovery of other unsaved historical Editions

### Requirement: Current scope focuses research on one selected Edition

Current scope MUST check only `currentOrNextEdition`. Its `previousEdition` MUST be null.
Its instructions MUST request checks of announcement, dates, schedule status, location, tickets, and classification for that Edition.
Size, coordinates, and detailed address can remain opportunistic.
Current MUST omit Event summary and shared-link findings and actions.
It MUST NOT re-audit history or an established Event identity baseline.
The application MUST enforce the slot and Event-field restrictions.
It MUST trust the model's temporal selection and account of its checks.
Target ownership, country, field, and catalog guards MUST still apply.

#### Scenario: Current refresh has saved history

- **WHEN** current selects one future Edition and another Edition is saved
- **THEN** only the selected Edition can receive findings, changes, or publication evaluation
- **AND** the other Edition remains available as matching, country, and classification-donor context

#### Scenario: Current returns an additional Event fact

- **WHEN** current returns an Event summary or shared-link finding, or the editor addresses an Event field
- **THEN** the application rejects the item before catalog operations

#### Scenario: No Editions are saved

- **WHEN** the targeted Event has no Editions
- **THEN** full can create up to two supported selected Editions and current can create up to one

#### Scenario: A result exceeds the assignment

- **WHEN** current returns a previous Edition or Event field finding, or a plan addresses a key outside its matching research slot
- **THEN** the result is rejected before catalog operations
- **AND** this includes keep-only actions for another saved Edition

#### Scenario: Current encounters Event facts

- **WHEN** current inspects a changed Event description or shared social account
- **THEN** it omits Event summary and shared-link findings
- **AND** it retains the observed name, source summaries, and identity diagnostics

#### Scenario: Optional details are unavailable

- **WHEN** current completes its mandatory checks without size, precise coordinates, or detailed address findings
- **THEN** their omission does not require separate research or partial status

### Requirement: Current selection uses inspected temporal evidence

For add and both refresh scopes, the research model MUST select an ongoing Edition first, otherwise the nearest supported announced future Edition.
It MUST return it in `currentOrNextEdition` and preserve its matching saved key.
Programme dates MUST be inclusive local dates using the saved time zone or UTC fallback.
Saved dates and statuses MUST remain leads, not proof.

#### Scenario: A festival is underway

- **WHEN** an Edition is supported as ongoing today and a later Edition is announced
- **THEN** the ongoing Edition is selected through its last day
- **AND** after it ends, the nearest supported future Edition becomes the candidate

#### Scenario: Several future announcements exist

- **WHEN** inspected sources support several future Editions with distinct start dates
- **THEN** research selects only the nearest one and does not create farther unsaved Editions

#### Scenario: A year-only announcement is the sole candidate

- **WHEN** one supported future announcement has a year but no exact dates and no competing earlier candidate
- **THEN** it can be selected without inferring dates from another year

#### Scenario: A gap remains inside one Edition range

- **WHEN** today falls between programme periods of one Edition's supported first-to-last date range
- **THEN** selection treats that Edition as ongoing through its final local date
- **AND** it does not create an Edition for each period

### Requirement: Current selection preserves uncertainty

Research MUST recheck saved cancellation or postponement before excluding a candidate.
A confirmed cancellation or postponement without replacement dates MUST exclude it from current selection.
Ambiguous ordering MUST produce a null slot and an unfinished selection question, without an arbitrary choice.
Completed checks without an eligible announcement MUST produce a null slot without inventing an Edition.

#### Scenario: Saved status is stale

- **WHEN** a saved Edition is marked cancelled or postponed
- **THEN** research checks its status rather than excluding it from saved state alone
- **AND** supported replacement dates participate in selection under the same matched key

#### Scenario: An excluded candidate precedes an eligible one

- **WHEN** sources confirm the nearer Edition is cancelled without replacement dates and a later eligible Edition exists
- **THEN** research selects the later Edition without mutating the excluded one
- **AND** source summaries retain the exclusion explanation

#### Scenario: Candidate order cannot be established

- **WHEN** overlapping, tied, or incomplete dates could change the selected Edition
- **THEN** research reports partial status, `currentOrNextEdition:null`, and a specific unfinished selection question
- **AND** independently supported full-scope Event or previous-Edition findings can remain usable

#### Scenario: No eligible announcement is found

- **WHEN** relevant announcement checks complete without a current or future eligible Edition
- **THEN** research can succeed with `currentOrNextEdition:null` and no invented Edition
- **AND** an inaccessible relevant source remains an unfinished check

### Requirement: Edition matching preserves durable keys

Research MUST match each selected Edition to saved keys before proposing creation.
Calendar year alone MUST NOT determine identity. Corrected dates or years MUST preserve a matching saved key.
Multiple programme periods of one realization MUST use one Edition and its first-to-last date range.
Distinct realizations in one year MUST remain distinguishable.
Unresolved matching MUST remain unfinished instead of creating a possible duplicate.

#### Scenario: Imported key differs from year

- **WHEN** a source corrects dates for an Edition stored under a non-year key
- **THEN** the update retains that key and Edition ID

#### Scenario: Two weekends occur in one year

- **WHEN** an Event has two distinct Editions in the same year
- **THEN** their programme identities govern matching rather than year equality

#### Scenario: Several periods describe one realization

- **WHEN** inspected sources describe several dates as parts of one Edition
- **THEN** research returns one finding under one matched or new key
- **AND** it does not use a second key or the other role for another period of that same Edition

## ADDED Requirements

### Requirement: Selection uses one reference date

Add and refresh MUST use one frozen `currentDate` for research and editorial assessment.
Both stages MUST receive the same date and applicable scope.
Inspected evidence MUST establish temporal selection. Saved context alone MUST NOT certify selection or completion.

#### Scenario: The run crosses a date boundary

- **WHEN** research and editing run on opposite sides of a date boundary
- **THEN** both stages use the frozen reference date from the run

### Requirement: Previous selection uses the latest completed Edition

For add and full, research MUST select the latest Edition that actually finished before the reference day.
Known dates MUST use the final local date with the saved time zone or UTC fallback. Selection MUST require inspected evidence.
A cancelled Edition or postponement without a completed programme MUST NOT count as completed.
The previous role MUST be null when absent or unresolved. Unresolved selection MUST include a question.

#### Scenario: The previous calendar year has no completed Edition

- **WHEN** the latest supported completed Edition predates the previous calendar year
- **THEN** research selects that Edition rather than inventing a yearly predecessor

#### Scenario: The last local day has not ended

- **WHEN** the reference day equals an Edition's final local date
- **THEN** that Edition remains eligible for the current role, not the previous role
- **AND** the previous role uses an earlier completed Edition when supported

#### Scenario: A recent candidate was cancelled

- **WHEN** inspected evidence confirms cancellation or postponement without a completed replacement programme
- **THEN** research excludes it from the previous role
- **AND** it can select an earlier supported completed Edition

#### Scenario: Completion order remains uncertain

- **WHEN** useful evidence cannot establish which completed Edition is latest
- **THEN** research returns `previousEdition:null` and partial status with a specific question
- **AND** independently supported Event or current-or-next findings can remain usable

#### Scenario: Completion is established without exact dates

- **WHEN** inspected evidence establishes the latest completed Edition but does not give exact programme dates
- **THEN** research can select it without a dates finding
- **AND** it does not infer dates from another Edition
- **AND** unresolved completion or ordering still prevents an arbitrary selection

#### Scenario: Current does not select a previous Edition

- **WHEN** the assignment is current refresh
- **THEN** research and editor return `previousEdition:null`
- **AND** historical context remains available without a previous-Edition audit

#### Scenario: No previous Edition exists

- **WHEN** relevant checks establish that no Edition has yet completed
- **THEN** research returns `previousEdition:null`
- **AND** this completed absence check alone does not make research partial
