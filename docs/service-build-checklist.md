---
type: Checklist
title: Service build checklist
description: Fixture-backed service build tasks and remaining gates.
status: stable
tags: [progress, development]
---

# Service build checklist

Build the catalog service using development fixtures. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and production deployment are deferred. The completed fixture-backed behavior is now recorded in [main OpenSpec specs](../openspec/specs/); deferred approved work is in [active changes](../openspec/changes/).

## 1 Application foundation

- [x] Scaffold one Next.js application with React, strict TypeScript, and npm.
- [x] Set up domain logic, application services, database access, and UI directories.
- [x] Configure SQLite, Drizzle, and environment validation.
- [x] Add working development, type-check, lint, test, and build commands.

## 2 Catalog and publication

- [x] Create schemas and migrations for Events, Occurrences, taxonomy, links, and audit history.
- [x] Add stable IDs, slugs, edition keys, and retained URL aliases.
- [x] Implement validated internal writes with atomic audit history, version checks, and replay protection.
- [x] Enforce date, location, publication, and withdrawal rules; keep facts specific to each edition.
- [x] Add repeatable development fixtures and focused tests for tentative dates, missing coordinates, historical editions, cancellations, and postponements.
- [ ] Add source evidence when implementing the catalog database update workflow.

## 3 Basic catalog pages

- [x] Build a server-rendered festival list using public records only.
- [x] Build Event pages with links to published editions and history.
- [x] Build Occurrence pages with dates, status, qualified location, and official links.
- [x] Support direct page visits, stable URLs, and redirects for renamed public addresses.
- [x] Verify drafts and withdrawn records are absent from public pages and responses.

## 4 Search and filters

- [x] Return the complete discovery summary set, including historical editions eligible for date searches.
- [x] Implement name search, When, Where, Music genre, Duration, and Size using shared browser/server matching rules.
- [x] Add Apply/Cancel, active filter chips, result counts, and Clear all.
- [x] Persist applied filters in the URL and restore them on reload and back/forward navigation.
- [x] Handle unknown values, invalid filters, empty results, and retryable errors.
- [x] Test combined filters, date boundaries, same-edition matching, and browser/server parity.

## 5 Map and responsive discovery

- [x] Integrate Mapbox GL JS with a public token, Mapbox style, and visible attribution; consult eventmap read-only where useful.
- [ ] Configure token restrictions and usage monitoring before public deployment.
- [x] Show map and list together on desktop and provide a Map/List switch on mobile.
- [x] Use the same filtered results in both views, keeping editions without coordinates in the list and showing total, mapped, and unlocated counts.
- [x] Add marker clustering, selection, and approximate-location labels.
- [x] Load full details on selection, with retry and protection against stale responses.
- [x] Preserve filters and selection across view changes; keep map movement independent of result filtering and fetching.
- [x] Verify mobile and keyboard flows, direct links, and a usable list when the map is unavailable.
