# Service build progress

Current section: 4 — Search and filters  
Fix rounds: 1 of 2  
Status: accepted; commit pending

## Acceptance checklist

- [x] A same-origin read endpoint returns the complete compact public discovery summary set for Festivals, including eligible historical editions and records without coordinates; full details and internal evidence stay out.
- [x] Shared pure browser/server matching covers name, When, Where, Music genre, Duration, and Size with same-Occurrence AND semantics, multi-select OR semantics, unknown handling, date overlap, and deterministic ordering.
- [x] Server-rendered direct filter URLs and client interaction agree; applied URL state round-trips through reload and back/forward, while pending edits use Apply/Cancel.
- [x] Search/filter UI has active chips, result count, Clear all, empty/error recovery, valid URL normalization, and visible errors for invalid filters; unrelated or `bbox` parameters never constrain results.
- [x] Focused tests cover combined filters, inclusive/leap date boundaries, genre ancestry, capacity/duration bands and unknowns, same-edition matching, and browser/server parity.

## Decisions

- Sections 1–3 committed as `1863314`, `b626c9c`, and `2ebad02`; all passed independent review.
- Use fictional development fixtures. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and deployment remain deferred.
- Optional findings remain parked: section 1 documentation cleanup; section 2 taxonomy immutability, UTC normalization, and partial-fixture recovery.
- Section 3 optional notes remain parked: stricter origin validation and extra route/render fixtures.
- Section 4 implements list discovery only; Mapbox, combined map/list layout, mobile switch, and selection details are section 5.
- Initial section 4 review found Cancel hides an invalid-URL alert while the URL remains invalid, and the genre picker lists the full alphabetic taxonomy instead of eligible-inventory terms grouped under parents. Details: `/tmp/eventroam-section4-review.md`. Optional notes stay out of scope.
- Independent follow-up verified both fixes in Chrome, endpoint data, and tests; no remaining blockers. Type check, lint, format, 25 tests, build, and HTTP/browser checks pass.

## Next action

Commit accepted section 4, then define section 5 acceptance and start a fresh Sol implementer.
