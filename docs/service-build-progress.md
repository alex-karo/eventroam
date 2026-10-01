# Service build progress

Current section: 2 — Catalog and publication  
Fix rounds: 2 of 2  
Status: accepted; commit pending

## Acceptance checklist

- [x] Reviewed Drizzle schema and SQL migrations cover Events, Occurrences, occurrence-owned taxonomy, links, Source/evidence, run records, and immutable CatalogChange history with typed constraints and foreign keys.
- [x] Stable opaque IDs, globally unique Event slugs, stable per-Event Occurrence keys, home-scope ownership, and retained published URL aliases survive rename/date moves and cannot be reused by another identity.
- [x] Validated internal create/update/publication operations atomically write changes and audit entries, reject stale versions, and make same-key retries idempotent while rejecting different payloads.
- [x] Date/location/publication/withdrawal and edition-isolation rules are enforced; factual publication and changes require appropriate source evidence. Typed positive capacity and bounded original-currency price summaries follow the information brief.
- [x] Repeatable development fixtures are separate from schema migrations; focused real SQLite tests cover tentative dates, missing coordinates, historical editions, cancellations, postponements, rollback, and replay/version behavior.

## Decisions

- Process sections in checklist order and commit each accepted section separately.
- Use development fixtures. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and production deployment remain deferred.
- Section 1 accepted and committed as `1863314` after independent review and checks on Node 26.10.0/npm 11.19.1.
- Section 1 optional improvements are parked: remove one stale pre-scaffold statement and mention the polling fallback in `docs/development.md`.
- Keep fixtures as development data operations, not migration seed data. Parsing, crawling, imports, public pages, and agent workflow transport are outside section 2.
- Initial independent review found six blocking defects: unchanged link replacement mutates IDs/history; evidence can lack excerpt/snapshot; completed source-check replay fails; completed runs can be deleted; SQL permits incomplete price values through NULL; published records accept `ZZ` country code. Details: `/tmp/eventroam-section2-review.md`.
- Optional review notes (out of gate): assigned taxonomy immutability, UTC normalization, and fixture recovery after partial seeding.
- Follow-up review verified five of six fixes. The SQL price CHECK still accepts populated rows with `price_kind = NULL` because SQLite treats NULL CHECK results as passing. Details: `/tmp/eventroam-section2-followup1.md`.
- Final independent review verified the last SQL fix against fresh SQLite and found no remaining blockers. Required tests, type check, lint, format, build, migration check, and repeat fixture/migration runs pass.

## Next action

Commit accepted section 2, then define section 3 acceptance and start a fresh Sol implementer.
