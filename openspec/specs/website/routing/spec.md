# Scoped website and URLs

## Purpose

Define the implemented host mapping, canonical record routes, redirects, and current discovery metadata.

## Requirements

### Requirement: Configured hosts select explicit scopes

The application SHALL use one shared catalog with an allowlisted host mapping. The apex host SHALL show a scope directory linking to Festivals; the Festivals host SHALL serve the festival catalog. An unknown host SHALL expose no default catalog. Public absolute links SHALL use configured origins rather than arbitrary request host values. Scope hosts SHALL represent subjects rather than languages or countries.

#### Scenario: An unconfigured host requests the root

- **WHEN** the request host is outside configured origins
- **THEN** it does not reveal the festival catalog

### Requirement: Public record routes are stable and scoped

The Festivals host SHALL use `/events/{eventSlug}` and `/events/{eventSlug}/{occurrenceKey}` for public records. Discovery SHALL occupy the scope root, without alternate map/list/filter paths. Slugs and keys SHALL be lowercase URL-safe segments. Published old paths SHALL remain reserved aliases that redirect after a rename; date or venue moves SHALL preserve keys. Public records reached from the apex SHALL redirect to the configured Festivals origin.

#### Scenario: A published Event is renamed

- **WHEN** a visitor opens its former Event or edition path
- **THEN** the stored alias redirects to the current canonical Event or edition path

#### Scenario: A visitor opens a draft path

- **WHEN** the referenced Event or Occurrence is not public
- **THEN** the route returns no public detail page even if an alias exists

### Requirement: Discovery state remains on the scope root

Applied filters SHALL be query parameters on the Festivals root. A view-only or unrelated tracking query SHALL canonicalize to the clean root. A materially filtered query SHALL use normalized filters in its canonical URL and emit `noindex,follow`; invalid filter state SHALL also emit `noindex,follow` with recovery feedback. Switching views and returning through browser history SHALL preserve applied filters. Desktop SHALL show both views irrespective of `view=list` or `view=map`.

#### Scenario: Only the preferred mobile view changes

- **WHEN** a visitor opens `?view=map` without filters
- **THEN** the canonical URL is the clean Festivals root and desktop still shows map and list
