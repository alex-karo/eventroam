# Tasks

## 1. Catalog records

- [x] 1.1 Migrate Event storage and catalog types. Verify that populated and null summaries survive as `description` and that `shortDescription` starts null. Update the Studio SQL guide and check it against the new schema.
- [x] 1.2 Update fixtures and verify that each description can be set or cleared without affecting the other.

## 2. Ingestion

- [x] 2.1 Move description work to Classification as described in the [design](design.md#approach). Verify that add and full assign both fields to Classification and that Location can run for a new festival without saved text.
- [x] 2.2 Carry both fields through Editor, preview and apply. Verify that a mixed review changes only the approved field and that distinct reasons reach the correct report fields. Update the General, Classification and Editor prompt versions and the ingestion guide.
- [x] 2.3 Handle early exits when processing the General result. Check the [Edition gate scenarios](specs/catalog/ingestion-workflow/spec.md#requirement-ingestion-requires-information-about-an-edition) and the [current scope scenarios](specs/catalog/refresh-scope/spec.md#requirement-current-scope-focuses-research-on-one-selected-edition). Reuse `scope-current-ambiguous` to verify that an unchanged catalog preserves partial research status and unresolved questions. Check that full still requests descriptions when a saved Edition passes the gate and both target slots are empty.
- [x] 2.4 Replace `summary` in eval projections and fixtures. Run the narrow-current cases to verify that Classification omits both fields. Inject a prohibited proposal for each field and check that neither reaches catalog operations.
- [x] 2.5 Run a focused pipeline eval against the [description scenarios](specs/catalog/ingestion-workflow/spec.md#requirement-descriptions-give-a-fair-picture-of-the-current-festival), including continuity and announced changes. Reuse `size-historical-and-unknown` for attendance and programme evidence tagged only as classification. Inspect both texts and the Editor decisions.

## 3. Public pages

- [x] 3.1 Apply the [display rules](design.md#display). Test the four fallback cases in the shared selector. Check page text, metadata and JSON-LD with distinct and blank texts. Include a historical Edition page to check the current About text and Edition-specific metadata.
- [x] 3.2 Run the catalog, ingestion and website checks, then validate the updated documentation and OpenSpec requirements before archive.

## 4. Main eval

- [x] 4.1 Add the description format check to main eval. Verify it on saved main results and a text with the wrong format.
- [x] 4.2 Count each numeric result as a required fact with an 80% threshold. Verify the boundary and fields without scores.

## 5. Isolated Classification eval

- [x] 5.1 Run Classification with fixed evidence, Edition targets, and saved context. Check the category IDs and score each proposed text. Register the group in CLI selection and document it. Verify the case with the default model.
