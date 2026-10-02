# Service build progress

Current section: 5 — Map and responsive discovery  
Fix rounds: 0 of 2  
Status: development-fixture build complete and committed

## Acceptance checklist

- [x] Mapbox GL JS renders via a small client adapter with public token, style, visible attribution, clustered markers, and approximate-location labels; missing token/WebGL leaves the list usable.
- [x] Desktop displays map and list together; narrow screens provide a keyboard-usable Map/List switch without losing filters or selected edition.
- [x] Both views consume the same filtered summaries. Unlocated editions remain in the list, with accurate total, mapped, and unlocated counts independent of viewport.
- [x] Marker/list selection loads full public Occurrence details on demand through a publication-gated endpoint; errors can retry, stale responses cannot replace newer selections, and ordinary direct links remain usable.
- [x] Map movement does not refetch or filter results. Direct links, mobile and keyboard flows, selection persistence, clustering, and map-unavailable fallback received focused verification.

## Decisions

- Sections 1–4 committed as `1863314`, `b626c9c`, `2ebad02`, and `955ed9f`; section 5 is the current commit. All passed independent review for the development-fixture build.
- Use fictional development fixtures. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and deployment remain deferred.
- Optional findings remain parked: section 1 documentation cleanup; section 2 taxonomy immutability, UTC normalization, and partial-fixture recovery.
- Section 3 optional notes remain parked: stricter origin validation and extra route/render fixtures.
- Section 4 optional findings remain parked: descriptive chips, opener-specific focus restoration, and automated browser regression coverage.
- Mapbox token restrictions and usage monitoring are a required pre-deployment gate. Production deployment is deferred; document the exact gate now without creating or exposing an account token.
- Section 5 code review and independent live Mapbox review passed with no blocking findings. Lint, format, type check, 27 tests, build, HTTP, fallback, live tiles/attribution/clustering/selection, and browser flows pass. Details: `/tmp/eventroam-section5-review.md` and `/tmp/eventroam-section5-live-review.md`.
- The ignored `.env` contains a working local public token. Account-side restrictions, launch-host allowlist, usage monitoring, and budget alerts remain unverified and required before public deployment.

## Compact discovery refresh (2026-10-02)

- Implemented the approved compact proposal: slim search header, list/map workspace, floating filter pickers, denser edition rows, and contextual details. Mobile keeps results and Map/List switching accessible without a large heading block.
- Map points use smaller visual circles with larger invisible hit targets, compact clusters, informative previews, and fit/zoom controls. Initial fitting waits for a visible map and handles locations across the date line.
- Verified filtering, cancellation and focus restoration, history, empty search/reset, invalid pending filters, mobile error recovery, detail selection/Escape, direct edition links, and live Mapbox selection at desktop and 320px/390px mobile widths. Type checking, lint, formatting, 41 tests, and the production build pass.
- No catalog/API changes, dependencies, migrations, or production deployment were required.
- Astra review regressions corrected: discovery row styles no longer affect public event history, mobile map controls share a row below wrapping filter chips, and name-search validation has visible accessible feedback outside pickers. Browser checks reproduced and verified all three fixes, including search recovery and preservation of applied results.

## Next action

Before any public deployment, verify the account-side Mapbox restrictions, launch-host allowlist, monitoring, and budget alerts; keep that deployment gate unchecked until then.
