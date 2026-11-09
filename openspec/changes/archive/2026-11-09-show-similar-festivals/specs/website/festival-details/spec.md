# Spec Delta

## ADDED Requirements

### Requirement: Event pages show similar festivals

The Event page SHALL show the first three matches, or all matches if there are fewer, under `Festivals like <Event name>` before Edition history. Each card SHALL show the festival name, Edition dates, duration, place, and shared genre. The name SHALL link to that Edition. The page SHALL omit the section when there are no matches.

#### Scenario: One match has provisional dates

- **WHEN** an Event has one match with provisional dates
- **THEN** the page shows one card and marks the dates as tentative
- **AND** the festival name links to the Edition that has those dates

### Requirement: Alternatives share a genre with the source festival

The website SHALL use genres from the source Event's earliest current or future public Edition, or its latest past public Edition if none is current or future. For each other Event, the website SHALL select the earliest matching public Edition that is announced or scheduled, has not ended, and has no confirmed sell-out. A match SHALL have a genre common to both Editions, including ancestors of their assigned genres. More specific matches SHALL appear first.

#### Scenario: A cancelled Edition has both narrow and broad matches

- **WHEN** an Event's only public Edition was cancelled and has the Hardstyle genre
- **AND** two eligible Editions from different Events have the Hardstyle and Techno genres respectively
- **THEN** the Hardstyle match appears first and the Techno match shows Electronic as the shared genre
