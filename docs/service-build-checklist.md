# Service build checklist

Build the catalog service using development fixtures. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and production deployment are deferred. Use the existing specifications without a separate clarification phase.

## 1 Application foundation

- [ ] Scaffold one Next.js application with React, strict TypeScript, and pnpm.
- [ ] Set up domain logic, application services, database access, and UI directories.
- [ ] Configure SQLite, Drizzle, and environment validation.
- [ ] Add working development, type-check, lint, test, and build commands.

## 2 Catalog and publication

- [ ] Create schemas and migrations for Events, Occurrences, taxonomy, links, evidence, and audit history.
- [ ] Add stable IDs, slugs, edition keys, and retained URL aliases.
- [ ] Implement validated internal writes with atomic audit history, version checks, and replay protection.
- [ ] Enforce date, location, publication, and withdrawal rules; keep facts specific to each edition.
- [ ] Add repeatable development fixtures and focused tests for tentative dates, missing coordinates, historical editions, cancellations, and postponements.

## 3 Basic catalog pages

- [ ] Build a server-rendered festival list using public records only.
- [ ] Build Event pages with links to published editions and history.
- [ ] Build Occurrence pages with dates, status, qualified location, and official links.
- [ ] Support direct page visits, stable URLs, and redirects for renamed public addresses.
- [ ] Verify drafts and withdrawn records are absent from public pages and responses.

## 4 Search and filters

- [ ] Return the complete discovery summary set, including historical editions eligible for date searches.
- [ ] Implement name search, When, Where, Music genre, Duration, and Size using shared browser/server matching rules.
- [ ] Add Apply/Cancel, active filter chips, result counts, and Clear all.
- [ ] Persist applied filters in the URL and restore them on reload and back/forward navigation.
- [ ] Handle unknown values, invalid filters, empty results, and retryable errors.
- [ ] Test combined filters, date boundaries, same-edition matching, and browser/server parity.

## 5 Map and responsive discovery

- [ ] Integrate Mapbox with token configuration, a map style, and attribution; consult eventmap read-only where useful.
- [ ] Show map and list together on desktop and provide a Map/List switch on mobile.
- [ ] Use the same filtered results in both views, keeping editions without coordinates in the list and showing total, mapped, and unlocated counts.
- [ ] Add marker clustering, selection, and approximate-location labels.
- [ ] Load full details on selection, with retry and protection against stale responses.
- [ ] Preserve filters and selection across view changes; keep map movement independent of result filtering and fetching.
- [ ] Verify mobile and keyboard flows, direct links, and a usable list when the map is unavailable.
