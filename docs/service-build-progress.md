# Service build progress

Current section: 3 — Basic catalog pages  
Fix rounds: 1 of 2  
Status: accepted; commit pending

## Acceptance checklist

- [x] Server-rendered Festivals list uses only public Occurrences and ordinary links to their stable detail routes; no draft or withdrawn data reaches HTML or read responses.
- [x] Durable Event pages show published editions and history, with deterministic active-edition selection and no cross-edition fact mixing.
- [x] Occurrence pages show accepted dates and status, tentative/previous-date labels, qualified location, edition classifications and official links; direct entry works without client JavaScript.
- [x] Configured scope host and canonical origins determine stable `/events/{slug}` and `/events/{slug}/{key}` routes; retained public aliases redirect to the current address while missing/hidden targets return 404.
- [x] Focused route/read tests verify public gates, direct visits, renamed addresses, historical/cancelled/postponed pages, and missing-coordinate presentation.

## Decisions

- Section 1 committed as `1863314`; section 2 committed as `b626c9c`. Section 2 used two fix rounds and passed independent final review.
- Use fictional development fixtures. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and deployment remain deferred.
- Optional findings remain parked: section 1 documentation cleanup; section 2 taxonomy immutability, UTC normalization, and partial-fixture recovery.
- Initial section 3 review found JPY minor units incorrectly divided by 100 on Occurrence pages. Details: `/tmp/eventroam-section3-review.md`. Optional notes: route/render tests and origin validation.
- Independent follow-up verified currency-aware server rendering (EUR, JPY, KWD) with no remaining blockers. Type check, lint, format, 19 tests, build, and direct HTTP checks pass. Optional test-fixture refinements remain parked.

## Next action

Commit accepted section 3, then define section 4 acceptance and start a fresh Sol implementer.
