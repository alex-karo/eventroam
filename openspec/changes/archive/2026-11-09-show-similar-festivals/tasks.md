# Tasks

## 1. Catalog read

- [x] 1.1 Share the summary query and batch genre lookup with the alternatives read. Add the candidate filters and include the source Edition ID in the lookup. In the existing catalog tests, check that a confirmed sell-out still appears in discovery and that the summary has no ticket availability fields. [Read design](design.md#source-and-candidate-data) · [Catalog tests](../../../../src/catalog/read/public-catalog.test.ts)
- [x] 1.2 Implement source selection and match order. Test with a temporary catalog and a fixed request time. [Match order](design.md#match-order)
  - Give two future source Editions different genres. Check that the earlier Edition supplies the genres. Check the fallback to the latest past Edition when it was cancelled.
  - Give a candidate Event earlier sold-out and unrelated Editions. Check that the later eligible match is selected. Check that an Edition is eligible on its last local day when the UTC date is already the next day.
  - Use four matching Events. Give one of the returned Events an earlier broad match and a later narrow match. Check that its earlier Edition sets its rank and appears below a later narrow match from another Event. Assert the three Edition keys in order and their shared genre names.

## 2. Event page

- [x] 2.1 Load the matches from the Event render path and pass them to the Event view. Render the cards above history and omit the section for an empty result. In the presentation test, check the selected Edition's dates, duration, place, shared genre, and tentative label. Run `pnpm run type-check` and the presentation tests. [Request flow](design.md#architecture) · [Card design](design.md#event-cards) · [Presentation tests](../../../../src/components/catalog/presentation.test.tsx)
- [x] 2.2 Give the existing cancelled and future HTTP smoke fixtures a shared genre. Check that the cancelled Event page shows the section before history and links to the future Edition's `/summer` path. Check that the future Event page omits the section. Run `pnpm run build` and `pnpm run test:site`. [HTTP smoke test](../../../../src/test/site-smoke.ts)
