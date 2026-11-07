# Tasks

## 1. Edition summary

- [x] 1.1 Build the responsive opening facts and ticket area, preserve detail content, and check summary, action selection, missing data, and historical states in presentation tests.
- [x] 1.2 Update Signal page guidance and check it with docs:check.

## 2. Integration

- [x] 2.1 Check the page in the built-in Browser at phone, tablet, and desktop widths, including long text, missing data, and enlarged text.
- [x] 2.2 Run focused tests, type-check, lint, build, code review, cleanup, and spec verification; synchronize the implemented main spec and validate OpenSpec.

## 3. Title and festival navigation

- [x] 3.1 Move the Festival overview link to Other editions. Update the history browser test and page guidance. Verify the link and synchronize the main spec.
- [x] 3.2 Use a smaller Edition title and place classification tags below it. Check the reading order and verify the layout on phone and desktop widths.

## Verification

- Browser: 320 px with long postponed content; 390 x 844 with the main ticket action on the first screen; 768 px with missing facts; 1440 x 900 with two columns. No horizontal overflow was found.
- Enlarged text: a temporary local response set the root font size to 200%. Long content remained readable without clipping. Native browser zoom shortcuts had no effect in the built-in Browser, so this was a text-size check.
- Keyboard: Tab moves from the primary ticket link to the official site with a visible focus outline. Show on map reaches Location.
- Checks passed: 22 focused tests, type-check, lint, production build, dependency checks, public-site HTTP smoke checks, changed-file formatting, docs:check, and OpenSpec validation.
- Code review: one Astra coordinator and three specialists found no blocking defects. TST1 and TST2 were fixed with stronger assertions. COR1 was resolved by aligning the missing-price scenario with the existing fallback. COR2-COR5, CLR1-CLR4 (aliases CLR-01-CLR-04), and TST3-TST4 were dismissed with source or Browser evidence. No second pass was needed: two test improvements changed no application contract.
- Cleanup: no useful removal was found. Application code and tests changed by zero lines during cleanup. The page uses CSS and existing React rendering; no custom state or layout measurement was added.
- Spec verification: all four changed requirements and their eight scenarios have implementation and test or Browser evidence. The implementation follows the design. Main website/festival-details is synchronized.
- Title and navigation follow-up. The Browser confirmed tags below the title and no horizontal overflow at 320, 390, and 1440 px. The history test confirmed that Festival overview opens in a new tab on desktop and mobile. The E2E run passed 67 tests and skipped 21.
