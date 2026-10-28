# Website privacy

## Purpose

Explain public website data use and limit browser analytics to basic usage statistics.

## Requirements

### Requirement: Browser analytics uses cookieless capture

The website SHALL use cookieless analytics before a choice and after rejection when analytics is configured and the visitor has not disabled it. Acceptance SHALL enable a persistent browser identifier. It SHALL NOT create visitor profiles or record sessions. It SHALL capture only page views and the existing explicit discovery and promo events. It SHALL exclude search text, URL query strings, and fragments from event URL properties. Analytics SHALL remain disabled when its configuration is absent.

#### Scenario: Visitor uses discovery

- **WHEN** a visitor views a page, submits a search, applies filters, changes the view, or selects edition details
- **THEN** the configured client can send the corresponding event without persistent browser tracking identifiers unless the visitor has accepted
- **AND** it does not send automatic interaction events, browser errors, or session recordings

### Requirement: Privacy notice is accessible on public hosts

Both configured public hosts SHALL serve a Privacy policy at `/privacy`. Public pages SHALL link to it. The notice SHALL describe the operator contact, purposes, analytics data and limits, storage, service providers, and visitor choices and rights. It SHALL distinguish cookieless analytics from storage used for website features and privacy choices. It SHALL include a short summary and a compact provider table.

#### Scenario: Visitor reads the notice

- **WHEN** a visitor follows the Privacy policy link from either public site
- **THEN** a readable notice appears with controls to disable analytics or choose basic or extended analytics on that origin
- **AND** an unknown host does not expose the notice

### Requirement: Visitors choose whether analytics uses a persistent identifier

Both public hosts SHALL show a compact bottom banner until the visitor accepts or rejects analytics on that origin. Basic statistics, Allow cookies, and Disable analytics SHALL be accessible. The banner SHALL link to the Privacy policy. Basic events SHALL run without tracking storage before acceptance. The application and SDK SHALL share the choice in local storage. Acceptance SHALL permit analytics cookies, local storage, and session storage on that origin. Rejection SHALL remove analytics identity storage and return to cookieless events. Full opt-out SHALL block all new analytics events and remove stored analytics identity. The Privacy policy SHALL let visitors change their choice and SHALL NOT claim full anonymity. If storage is blocked, the choice SHALL apply to the current page only.

#### Scenario: Visitor makes a choice

- **WHEN** a visitor with no saved choice opens a public page
- **THEN** the banner appears and basic cookieless events run
- **WHEN** the visitor accepts or rejects
- **THEN** the banner closes and the choice applies on that origin
- **AND** only acceptance allows a persistent browser identifier

#### Scenario: Visitor withdraws acceptance

- **WHEN** a visitor rejects analytics after previously accepting it
- **THEN** later browser events use cookieless identity, including in other open tabs on that origin

#### Scenario: Visitor disables analytics

- **WHEN** a visitor disables analytics from any mode
- **THEN** all later analytics captures are blocked on that origin, including in other tabs and after reload
- **AND** no analytics identity is stored, while the choice remains saved
- **AND** the visitor can return to basic or extended analytics
- **AND** events collected before opt-out are not deleted and can finish delivery
