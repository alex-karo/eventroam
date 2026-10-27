# Tasks

## 1. Full source text and bounded model responses

- [x] 1.1 Replace source read contracts and projections with the types in design.md. Apply status and reason-code mappings across retrieval, sessions, and initial model input. Remove completeness and source-truncation fields. Update all direct consumers in the same step, including workflow metadata, report types and projection, logs, traces, injected readers, source fixtures, loaders, and test fixtures. Preserve the separate report contract. Run `npm run type-check` after these updates. Verify existing read, session, and agent-input tests cover unsupported, failed, empty, and JavaScript-limited responses.
- [x] 1.2 Remove the extraction text cut and separate link list, including the eval link-rebuild helper, its calls, and its dedicated test. Remove the direct `mdast-util-from-markdown` dependency if unused. Replace `combineSourceExtractions` with a short Markdown join in the fallback caller. Emit page-region HTML comments. Keep inline URL normalization, structured facts, table rows, and fallback conditions. Adapt extraction and read tests to verify retained links, comment regions, and complete direct/rendered text in the existing order above the former 20,000-character cut.
- [x] 1.3 Apply text bounds only in the shared model projection. Keep the normal tool and initial-context allowances described in design.md. Verify a page above the model bound retains its tail in the cache, both projection paths report their own truncation, repeated reads reuse the cache, and projection does not change cached reasons or text. Adapt existing capture tests to verify they record only model-visible text.
- [x] 1.4 Update the source-reading section in docs/ingestion-process.md for the new tool response, cache contents, and comment regions. Verify examples match the schema and run `npm run docs:check`.

## 2. Source metadata consumers

- [x] 2.1 Verify the workflow metadata and report mapping changed in task 1.1. Adapt workflow and report tests to check failed/unsupported source diagnostics, the separate report field names and schema version, and the exclusion of full page bodies from execution state and reports.
- [x] 2.2 Verify source logs, initial-read traces, tool traces, labels, and allowed diagnostic fields changed in task 1.1. Adapt tracing and logging tests to check read statuses, failure reasons, content exclusions, the removal of obsolete completeness and source-truncation observations, and actual model-projection truncation where observed. Update the diagnostic section in docs/ingestion-process.md and run `npm run docs:check`.
- [x] 2.3 Validate updated source fixtures with the current eval loader and run the eval CLI on affected cases. Keep the separate main and regression scores and check that catalog and research completion statuses retain their meanings. Update fixture schema documentation in docs/development.md if its contract version changes. Verify the tests run without live retrieval and run `npm run docs:check` for documentation edits.

## 3. Integration and spec completion

- [x] 3.1 Run `npm run type-check`, `npm run lint`, and the affected ingestion test suite, including workflow, capture, and observability tests. Validate eval fixtures through the loader and CLI; do not restore eval unit tests removed by the eval redesign. Check for obsolete source fields in active code and fixtures; retain unrelated catalog outcomes and report fields.
- [x] 3.2 Sync the implemented source-access delta into the owning main spec. Run `npm run openspec:validate` and `npm run docs:check`. Verify the main spec describes the implemented model contract, cache behavior, and region comments.
