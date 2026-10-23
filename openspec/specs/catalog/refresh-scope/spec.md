# Refresh scope

## Purpose

Define which Event and Editions a refresh must check, how a current Edition is selected, and when identity or country uncertainty prevents updates.

## Requirements

### Requirement: Refresh stays within its requested Event
Refresh SHALL use only the targeted Event's private catalog context and SHALL update only that Event and its assigned Editions. Saved links and facts SHALL be available as research leads with their Event or Edition ownership, but SHALL NOT count as newly verified evidence. A different Event with the same brand SHALL remain separate; an established relocation SHALL preserve Event identity only when the country guard allows it.

#### Scenario: A catalog contains unrelated Events
- **WHEN** refresh targets one Event in a catalog containing other festivals
- **THEN** research receives only the targeted Event's private context and cannot update unrelated Events

#### Scenario: Parallel festivals share a brand
- **WHEN** two recurring festivals use the same brand in different countries
- **THEN** refresh does not merge their Event identities

### Requirement: Full scope checks saved history and the next candidate
Refresh SHALL use one frozen current date. Full scope SHALL check every saved Edition plus the selected ongoing or nearest future Edition when missing. It SHALL verify supported Event facts, shared links, and all assigned Edition facts. It SHALL NOT search solely for unsaved historical Editions. Unfinished mandatory checks SHALL remain visible in research status.

#### Scenario: Full refresh has saved history
- **WHEN** full refresh finds a new future announcement and has a saved historical Edition
- **THEN** it checks the saved Edition as well as the new candidate
- **AND** finding the new announcement does not make unfinished saved checks complete

### Requirement: Current scope checks one selected Edition
Current scope SHALL check at most one ongoing or nearest future Edition. It SHALL assess announcement, dates, schedule status, location, tickets, and classification for that Edition. Size, coordinates, and detailed address MAY be opportunistic. Current SHALL omit Event summary and shared-link findings and SHALL not re-audit history or an established Event identity baseline.

#### Scenario: Current refresh has saved history
- **WHEN** current selects one future Edition and another Edition is saved
- **THEN** only the selected Edition may receive findings and changes
- **AND** the other Edition remains available as matching and country context

#### Scenario: No Editions are saved
- **WHEN** the targeted Event has no Editions
- **THEN** either scope may create one supported selected Edition under that Event

#### Scenario: A result exceeds the assignment
- **WHEN** current proposes several Edition targets, or full proposes more than one new Edition key or more than 20 saved-plus-new targets
- **THEN** the result is rejected before catalog operations

### Requirement: Current selection uses inspected temporal evidence
Current SHALL select an ongoing Edition first, otherwise the nearest future Edition supported by inspected material. Programme start and end dates SHALL be inclusive local dates using the saved time zone or UTC fallback. Saved dates and statuses SHALL guide checks but SHALL NOT prove the selection. The result SHALL preserve an existing Edition key when the selected announcement matches it.

#### Scenario: A festival is underway
- **WHEN** an Edition is supported as ongoing today and a later Edition is announced
- **THEN** current selects the ongoing Edition through its last day
- **AND** after it ends, the nearest supported future Edition becomes the candidate

#### Scenario: Several future announcements exist
- **WHEN** inspected sources support several future Editions with distinct start dates
- **THEN** current selects only the nearest one and does not create farther unsaved Editions

#### Scenario: A year-only announcement is the sole candidate
- **WHEN** one supported future announcement has a year but no exact dates and no competing earlier candidate
- **THEN** it may be selected without inferring dates from another year

### Requirement: Current selection preserves uncertainty
Research SHALL recheck saved cancellation or postponement before excluding a candidate. A source-confirmed cancellation or postponement without replacement dates SHALL exclude it from current selection. If candidate order remains ambiguous, current SHALL report unfinished selection without choosing arbitrarily. Completed checks that find no eligible announcement SHALL report that result without inventing an Edition.

#### Scenario: Saved status is stale
- **WHEN** a saved Edition is marked cancelled or postponed
- **THEN** research checks its status rather than excluding it from saved state alone

#### Scenario: An excluded candidate precedes an eligible one
- **WHEN** sources confirm the nearer Edition is cancelled without replacement dates and a later eligible Edition exists
- **THEN** current selects the later Edition without mutating the excluded one

#### Scenario: Candidate order cannot be established
- **WHEN** overlapping, tied, or incomplete dates could change the selected Edition
- **THEN** current reports partial research and no arbitrary Edition target

#### Scenario: No eligible announcement is found
- **WHEN** relevant announcement checks complete without a current or future eligible Edition
- **THEN** current may succeed with no Edition findings and no invented Edition

### Requirement: Edition matching preserves durable keys
Research SHALL match an announcement to saved Editions before proposing a new one. Calendar year alone SHALL NOT determine identity: multiple Editions can share a year, and corrected dates or year SHALL NOT replace a matching saved key. Unresolved matching SHALL remain an unfinished check rather than creating a possible duplicate.

#### Scenario: Imported key differs from year
- **WHEN** a source corrects dates for an Edition stored under a non-year key
- **THEN** the update retains that key and Edition ID

#### Scenario: Two weekends occur in one year
- **WHEN** an Event has two distinct Editions in the same year
- **THEN** their programme identities govern matching rather than year equality

### Requirement: Full refresh can recover a wrong source association
Full refresh MAY recover a wrong website association using an inspected known link or replacement. If Event identity remains unresolved, full refresh SHALL make no catalog or publication changes. The report MAY retain supported findings as partial research.

#### Scenario: A known link identifies the correct website
- **WHEN** full finds a wrong saved website but an inspected known link establishes the correct festival
- **THEN** it may continue with the correct source without searching solely to replace the wrong URL

#### Scenario: Identity remains unresolved
- **WHEN** full cannot resolve whether a source belongs to the targeted Event
- **THEN** it reports the contradiction and makes no catalog changes

#### Scenario: A wrong website contains facts about another Event
- **WHEN** full inspects a website associated with a different festival
- **THEN** its facts remain diagnostic context and do not become target proposals

### Requirement: Current refresh does not replace an unavailable or wrong source
Current refresh SHALL NOT search for a replacement website when a relevant source is unavailable or contradicts the target Event's identity. It SHALL report the unfinished check or identity contradiction. An identity contradiction SHALL request full refresh. Current refresh SHALL make no changes based on an unverified source.

#### Scenario: Current finds a contradictory identity
- **WHEN** current discovers that a relevant source materially identifies another Event
- **THEN** it fails with an identity question requesting full refresh and makes no changes

#### Scenario: Current cannot access a relevant source
- **WHEN** current cannot inspect a relevant saved source
- **THEN** it reports the unfinished check without searching for a replacement website or changing facts that depend on that source

### Requirement: Country conflicts veto the whole Event refresh
Refresh SHALL compare researched countries with the target Event's known saved Edition countries. A different country, clearing a known country, or conflicting saved baselines SHALL fail the whole Event. No catalog or publication changes SHALL commit. Unknown or omitted country SHALL not count as confirmation. A supported country MAY be filled when no baseline exists. The baseline SHALL be checked again before apply.

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
