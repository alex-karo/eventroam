# Tasks

## 1. Centralize publication rules

- [x] 1.1 Implement the typed declarations and both pure checks from the design. Replace the old field assertions and facet predicates at their existing call sites. Run `pnpm run type-check` and the Edition domain tests. Verify that missing fields and facets produce the existing messages in the same order.
- [x] 1.2 Add a planner case with a draft Edition, valid year and dates, a country, and only `event_type`. Inspect the prepared operations before the writer runs. Verify that preparation succeeds and omits `publishEdition` for that Edition. Run the catalog plan tests, including the existing eligible historical Edition case.
- [x] 1.3 In the writer, read stored facets for direct publication and drop the unused slug projection. In `replaceTerms`, check the resolved terms after the unchanged-set return and before the first assignment write. Remove the post-write facet query. Add a writer test that keeps `event_type` but removes the last qualifying theme. Verify rejection and compare assignments, version, audit history, and receipts with their values before the call.
- [x] 1.4 In the existing published Edition country-clear test, move the row snapshot before the failed update. Verify that the country and version are preserved. Run the writer suite, including the existing publication cases for provisional dates and optional format.

## 2. Verify integration

- [x] 2.1 Run `pnpm run lint` and `pnpm test`. Confirm that the planner and writer use the same publication declarations and that the fixture validation path still checks published Edition fields.

## 3. Share Edition checks and classification preparation

- [x] 3.1 Bind field and facet declarations in a typed publication policy. Use the same policy for planning, writes, and fixture validation. Test a second set of rules through the full eligibility decision.
- [x] 3.2 Express date and coordinate consistency as ordered conditions. Preserve defaults, scalar checks, error order, and complete price validation.
- [x] 3.3 Move classification preparation and assignment limits to the domain. Preserve normalization order and reasons in proposals and strict ancestry checks in writes.
- [x] 3.4 Run domain, planner, proposal, writer, and fixture tests. Check types, lint, dependencies, the full test suite, and OpenSpec.
