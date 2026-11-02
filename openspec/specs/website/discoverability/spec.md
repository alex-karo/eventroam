# Website discoverability

## Purpose

Make the existing public pages discoverable through accurate metadata, canonical URLs, structured data, and crawler routes while preserving publication and discovery rules.

Existing host, redirect, and filter rules remain owned by [website routing](../routing/spec.md).

## Requirements

### Requirement: Existing public pages are indexable

The system SHALL permit indexing of both clean host roots and every public Event and Edition page under existing publication rules. Missing optional facts and missing Event JSON-LD SHALL NOT add an indexing gate. Historical, cancelled, and postponed public pages SHALL remain indexable. No separate indexing activation SHALL be required.

#### Scenario: A published edition has sparse facts
- **WHEN** an Edition passes current public read rules with dates and a country but no summary, venue, or locality
- **THEN** its detail page and its Event page permit indexing and remain eligible for the Festivals sitemap
- **AND** no new publication condition or feature switch is required

#### Scenario: A retained edition is outside upcoming discovery
- **WHEN** a public Edition is historical, cancelled, or postponed
- **THEN** its detail page remains indexable and eligible for the sitemap even if default discovery does not list it

### Requirement: Page metadata describes the rendered content

The system SHALL give each existing public page a descriptive title, description, canonical URL, and social metadata. Event metadata SHALL describe the festival and its published history. Edition metadata SHALL identify the festival, stored Edition year, and applicable status. Metadata SHALL use only facts available on the page and SHALL NOT include preview images.

#### Scenario: The visitor opens either clean root
- **WHEN** the configured apex or Festivals root is opened
- **THEN** its title and description identify the project presentation or festival catalog respectively
- **AND** each root has its own canonical and social URL

#### Scenario: An edition key differs from its year
- **WHEN** an Edition's key is `summer` and its stored year is 2027
- **THEN** metadata identifies the 2027 Edition while the canonical path retains `summer`

#### Scenario: Optional descriptive text is absent
- **WHEN** a public Event has no summary or an Edition has no display name
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

### Requirement: Canonical identity uses configured origins

The system SHALL derive canonical, social, sitemap, and structured-data identity URLs from configured origins and current public paths. Each root SHALL be self-canonical. Event and Edition pages SHALL have separate canonicals on Festivals. Detail identity URLs SHALL omit query parameters, including discovery context and tracking. Arbitrary request hosts SHALL NOT determine public absolute URLs.

#### Scenario: A detail link carries navigation and tracking state
- **WHEN** a current detail URL includes discovery, view, filter, or tracking parameters
- **THEN** its canonical, social URL, and structured-data identity use its clean current Festivals path
- **AND** navigation can still use its existing discovery context

#### Scenario: A public alias or apex detail path is requested
- **WHEN** the request resolves to a known public Event or Edition at an old path or on the apex
- **THEN** the existing permanent redirect reaches its current Festivals address
- **AND** only the final page's clean canonical address is eligible for sitemap output

### Requirement: Each host serves its own crawler routes

Each configured host SHALL serve `robots.txt` and `sitemap.xml`. Robots SHALL permit public pages and query variants and identify that host's absolute sitemap URL. The apex sitemap SHALL contain its clean root and Privacy policy URL. The Festivals sitemap SHALL contain its clean root, Privacy policy URL, and all current public Event and Edition URLs. Unconfigured hosts SHALL expose no site sitemap.

#### Scenario: The two configured hosts request crawler files
- **WHEN** a crawler requests each host's robots and sitemap files
- **THEN** both files are successful responses with the correct text or XML content type
- **AND** robots references only that host's sitemap
- **AND** each sitemap lists only canonical pages owned by its host

#### Scenario: A crawler opens a page with noindex
- **WHEN** a discovery query has `noindex,follow` under the existing routing rules
- **THEN** `robots.txt` permits the crawler to read that response

#### Scenario: An unknown host requests a sitemap
- **WHEN** its host is outside the configured origin mapping
- **THEN** the request returns no public sitemap and does not fall back to Festivals

### Requirement: Sitemaps reflect current public visibility

Sitemap responses SHALL contain only current public canonical URLs. They SHALL exclude drafts, withdrawn records, old aliases, redirects, API and health routes, query variants, and unimplemented pages. Publication changes SHALL affect the next sitemap request without a build or restart. Sitemap output SHALL NOT invent modification times from request, build, or source retrieval times.

#### Scenario: Withdrawn record
- **WHEN** a previously public Edition is withdrawn
- **THEN** its URL is absent from the next sitemap response
- **AND** its Event URL is also absent if no public Editions remain

#### Scenario: A record is published or renamed after build
- **WHEN** a valid record is published or its public slug or key changes while the application is running
- **THEN** the next sitemap response includes the current public address without a rebuild
- **AND** an old address is not listed as a second entry

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

### Requirement: Crawler content follows public read boundaries

Public HTML, metadata, JSON-LD, redirects, and sitemaps SHALL apply the same public visibility rules as page reads. They SHALL NOT expose private evidence, source retrieval times, audit data, ingestion reports, or unpublished content. Text inserted into JSON-LD SHALL remain data and SHALL NOT escape its script element.

#### Scenario: A draft or withdrawn record has a saved alias
- **WHEN** a crawler requests that current or former path
- **THEN** it receives no public record page or redirect revealing a private target
- **AND** neither address appears in the sitemap

#### Scenario: A public name contains script-like text
- **WHEN** that record is rendered with JSON-LD
- **THEN** its text cannot close the JSON-LD script element or insert executable markup
