## MODIFIED Requirements

### Requirement: Existing public pages are indexable

The system SHALL permit indexing of both clean host roots and every public Event and Edition page under existing publication rules. Missing optional facts and missing Event JSON-LD SHALL NOT add an indexing gate. Historical, cancelled, and postponed public pages SHALL remain indexable. No separate indexing activation SHALL be required.

#### Scenario: A published edition has sparse facts
- **WHEN** an Edition passes current public read rules with dates and a country, and both Event descriptions, the venue and the locality are missing
- **THEN** its detail page and its Event page permit indexing and remain eligible for the Festivals sitemap
- **AND** no new publication condition or feature switch is required

#### Scenario: A retained edition is outside upcoming discovery
- **WHEN** a public Edition is historical, cancelled, or postponed
- **THEN** its detail page remains indexable and eligible for the sitemap even if default discovery does not list it

### Requirement: Page metadata describes the rendered content

The system SHALL give each existing public page a descriptive title, description, canonical URL, and social metadata. Each Event or Edition page SHALL use one description for its meta, Open Graph and Twitter tags. Both page types SHALL prefer `shortDescription` and fall back to `description`. A blank value counts as absent. The Event description SHALL start with the public Event name and SHALL use the automatic festival text when both fields are absent. The Edition description SHALL start with the public Edition name, or the Event name when the Edition has no name. It SHALL include the stored year, applicable status and qualified dates before the festival text. When both text fields are absent, it SHALL include the public place. Metadata SHALL use only public facts and SHALL NOT include preview images.

#### Scenario: The visitor opens either clean root
- **WHEN** the configured apex or Festivals root is opened
- **THEN** its title and description identify the project presentation or festival catalog respectively
- **AND** each root has its own canonical and social URL

#### Scenario: An edition key differs from its year
- **WHEN** an Edition's key is `summer` and its stored year is 2027
- **THEN** metadata identifies the 2027 Edition while the canonical path retains `summer`

#### Scenario: Optional descriptive text is absent
- **WHEN** both descriptions are missing for a public Event or an Edition has no display name
- **THEN** metadata uses a factual description and name from the remaining public content
- **AND** no dates, locations, prices, or promotional claims are invented

#### Scenario: Historical or postponed edition
- **WHEN** an Edition has completed or is postponed with previous dates
- **THEN** its metadata identifies that status and does not describe those dates as an upcoming active schedule

#### Scenario: Dates are provisional or the edition is cancelled
- **WHEN** a public Edition has provisional dates or cancelled status
- **THEN** its description preserves the tentative-date or cancellation qualification shown on the page

#### Scenario: A public link is shared
- **WHEN** a crawler reads a page's social metadata
- **THEN** its title, description, and any social URL agree with the page's identity and facts
- **AND** no social preview image is declared

#### Scenario: The Event has a detailed description and a short description
- **WHEN** a crawler reads the Event page
- **THEN** the page shows the detailed description to readers and supplies the name and short description in its meta, Open Graph and Twitter tags
- **AND** the tags do not add a second name when the short description already starts with it

#### Scenario: An Edition has a short festival description
- **WHEN** a crawler reads the Edition page
- **THEN** its meta, Open Graph and Twitter descriptions put the name and qualified Edition dates before the short festival description

### Requirement: Edition structured data uses supported public facts

The system SHALL emit Event JSON-LD for a single Edition with a public name, confirmed dates, and a country plus street address or locality. Other Editions SHALL omit Event JSON-LD without changing indexing. Structured data SHALL use date-only values and preserve cancellation or postponement meaning. Images, organizers, performers, and offers SHALL NOT be invented.

#### Scenario: An edition has sufficient confirmed facts
- **WHEN** a public Edition has confirmed dates and a physical location that supports the required Event fields
- **THEN** its HTML contains Event JSON-LD with its public name, clean identity URL, known location, date-only start and end, and schedule status
- **AND** unknown times, offsets, images, organizers, performers, and offers are absent

#### Scenario: Confirmed facts are insufficient
- **WHEN** an Edition has provisional dates or no street address or locality
- **THEN** Event JSON-LD is absent even if a venue name, country, region, or coordinate point is known
- **AND** ordinary metadata, indexing, and sitemap eligibility remain available

#### Scenario: An eligible edition is cancelled or postponed
- **WHEN** an Edition with sufficient confirmed facts is cancelled or postponed without replacement dates
- **THEN** Event JSON-LD uses `EventCancelled` or `EventPostponed` respectively
- **AND** retained dates are not represented as a newly confirmed schedule

#### Scenario: A page lists several editions
- **WHEN** an Event history page or the discovery root is rendered
- **THEN** it does not describe the whole list as one dated Event in JSON-LD

#### Scenario: An Edition qualifies for structured data

- **WHEN** the page emits Event JSON-LD for an Edition
- **THEN** its description matches the festival text shown in the About section, including when the page uses a fallback
