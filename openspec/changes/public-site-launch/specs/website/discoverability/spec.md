# Spec Delta

## Purpose

Makes the launched public catalog's Event, Occurrence, and discovery pages understandable to visitors and discoverable through canonical metadata and linked URLs.

## ADDED Requirements

### Requirement: Public detail metadata describes the rendered record
The system SHALL give each public Event and Occurrence page a title, description, canonical URL, social URL, and relevant structured data based on that page's accepted facts and status.

#### Scenario: Historical or postponed edition
- **WHEN** an Occurrence has completed or is postponed with previous dates
- **THEN** its metadata identifies that status and does not describe those dates as an upcoming active schedule

### Requirement: Sitemaps contain only public canonical pages
The system SHALL generate sitemap entries from currently public canonical pages and exclude drafts, withdrawn records, redirects, API routes, and filtered discovery variants.

#### Scenario: Withdrawn record
- **WHEN** a previously public Occurrence is withdrawn
- **THEN** its URL is absent from newly generated sitemap entries
