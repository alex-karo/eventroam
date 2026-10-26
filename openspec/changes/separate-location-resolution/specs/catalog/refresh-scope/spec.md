# Spec Delta

## MODIFIED Requirements

### Requirement: Full scope assigns saved history and the next candidate

Full instructions MUST assign Event summary and shared links, the latest completed Edition, and the ongoing or nearest announced future Edition.
They MUST request checks of all supported fields of those selected Editions, whether saved or new.
Location MUST assess the Editions accepted by the editor under location resolution.
Other saved Editions MUST remain context for matching, country checks, classification reuse, and historical coordinate donors.
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

Current scope MUST check only currentOrNextEdition. Its previousEdition MUST be null in every agent plan.
Its research instructions MUST request checks of announcement, dates, schedule status, location, tickets, and classification for that Edition.
Size, source coordinates, and detailed address can remain opportunistic.
Current MUST omit Event summary and shared-link findings and actions.
It MUST NOT re-audit history or an established Event identity baseline.
Location MUST assess only the target accepted by the editor.
The application MUST enforce the slot and Event-field restrictions.
It MUST trust the model's temporal selection and account of its checks.
Target ownership, country, field, and catalog guards MUST still apply.

#### Scenario: Current refresh has saved history

- **WHEN** current selects one future Edition and another Edition is saved
- **THEN** only the selected Edition can receive findings, changes, or publication evaluation
- **AND** the other Edition remains available as matching, country, classification-donor, and coordinate-donor context

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

### Requirement: Country conflicts veto the whole Event refresh

Refresh SHALL compare researched countries and final Location country actions with the known saved Edition countries. Different countries, clearing a known country, or conflicting saved baselines SHALL fail the whole Event without writes or publication. Unknown or omitted country SHALL NOT count as confirmation. A supported country MAY be filled when no baseline exists. The baseline SHALL be checked again before apply.

#### Scenario: A new Edition conflicts with saved country

- **WHEN** an existing Edition establishes IE and research supports AU for another Edition of the same Event
- **THEN** the entire refresh fails with a country-conflict diagnostic, including otherwise valid changes

#### Scenario: The saved country may be wrong

- **WHEN** sources support a different country from the saved baseline
- **THEN** refresh still fails; correcting the baseline requires a separate authorized catalog correction

#### Scenario: Country is unknown

- **WHEN** a mandatory country check cannot verify a country but finds no contradiction
- **THEN** the result remains unfinished, saved country is preserved, and no confirmation is claimed

#### Scenario: Saved Editions already conflict

- **WHEN** the Event's saved Editions have different known countries
- **THEN** refresh fails before source or model work instead of choosing one baseline

#### Scenario: Baseline changes during research

- **WHEN** saved country changes before an apply transaction
- **THEN** no operation commits using the stale country decision

#### Scenario: A geocoding result has another country

- **WHEN** a candidate or Location action conflicts with the established country baseline
- **THEN** it cannot authorize a country correction through ingestion
- **AND** a conflicting final action rejects the whole item

### Requirement: Selection uses one reference date

Add and refresh MUST use one frozen currentDate and applicable scope for research, editing, and Location. Inspected evidence MUST establish temporal selection. Saved context alone MUST NOT certify selection or completion. Location MUST NOT reassign selected Edition roles.

#### Scenario: The run crosses a date boundary

- **WHEN** agent stages run on opposite sides of a date boundary
- **THEN** all stages use the frozen reference date from the run
