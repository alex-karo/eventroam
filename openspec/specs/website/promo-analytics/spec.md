# Promo analytics

## Purpose

Measure visits from GitHub and contact clicks on the project presentation.

## Requirements

### Requirement: LinkedIn contact clicks have explicit events

The project presentation SHALL send `promo_link_clicked` through the configured PostHog browser client when either LinkedIn contact link is clicked, with `destination` equal to `linkedin` and `placement` equal to `hero` or `footer`. The link SHALL keep its existing destination. Tracking SHALL NOT require visitor identification.

#### Scenario: Visitor selects a contact link

- **WHEN** a visitor clicks a LinkedIn contact link
- **THEN** the event identifies that link's placement
- **AND** the browser follows the LinkedIn link

### Requirement: GitHub links distinguish placement

The analytics guide SHALL provide public campaign URLs with `utm_source=github`, `utm_campaign=eventroam`, and distinct `utm_medium` values of `profile` and `readme`. The README URL SHALL include `utm_content=eventroam`.

#### Scenario: Owner prepares GitHub links

- **WHEN** the owner reads the campaign links in the analytics guide
- **THEN** separate profile and repository README URLs are available

### Requirement: Catalog entry has an explicit event

The project presentation SHALL send `promo_link_clicked` with `destination=festivals` and `placement=example` when a visitor clicks the catalog link. The link SHALL use the configured Festivals origin.

#### Scenario: Visitor opens the catalog example

- **WHEN** a visitor clicks the catalog link on the promo page
- **THEN** the event records the catalog destination and example placement
- **AND** the browser opens the configured Festivals site

### Requirement: Owner browsers can stop capture

The application SHALL block new analytics capture when a visitor opens `?analytics=off`, before sending the page view. The choice SHALL apply to later visits on that origin. `?analytics=basic` SHALL select cookieless capture. `?analytics=on` SHALL accept a persistent browser identifier. Clearing site storage SHALL return to basic capture and show the choice banner. The documentation SHALL provide links for both public origins and explain that earlier events remain stored.

#### Scenario: Owner disables capture

- **WHEN** the owner opens an origin with `analytics=off`
- **THEN** that visit and later visits on that origin collect no new analytics events
- **AND** another browser remains unaffected

#### Scenario: Owner restores capture

- **WHEN** the owner opens that origin with `analytics=on`
- **THEN** a persistent browser identifier is enabled
