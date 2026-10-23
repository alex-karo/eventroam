# Tasks

Update affected test builders, fixtures, and replay inputs within each task. Preserve unrelated assertions.

## 1. Edition slots and preparation

- [x] 1.1 Replace research and ready editor arrays with the two required nullable slots. Export the shared Edition finding schema. Check both provider adapters for missing slots, required nulls, rejected output, and old-array rejection.
- [x] 1.2 Update preparation and operation derivation for matching slots. Remove obsolete count guards from workflow, research, and preparation. Replace count-rejection tests with workflow success cases for two creations and large saved context. Check wrong or swapped keys, country conflicts, and atomic rejection. Verify null slots preserve saved Editions and skip their publication. Retain owning-Event publication rules.

## 2. Selection and programme dates

- [x] 2.1 Build add, full, and current research instructions from one shared selection text block and a block for each mode. For several programme periods of one Edition, instruct research and editor to return one key, the first start date, and the last end date. Verify range storage in existing ingestion tests. Update scope guards. Check instructions and context for both roles, previous completion, current priority, ambiguity, and the final local day. Retain each mode's field checks, duplicate-add handling, country checks, and current-identity protections.

## 3. Classification

- [x] 3.1 Normalize resolved accept/set lists using taxonomy ancestry from the catalog layer. Reuse `validateTermAssignments` for facet limits and a small helper that follows `parentId` links to remove selected ancestors. Check unknown and duplicate IDs before normalization. Explain normalization in existing change output, including previews. Check deep ancestry, siblings, broad-only terms, omitted classification, invalid lists, and normalized no-ops. Verify raw model responses stay unchanged and direct writer validation still rejects redundant ancestors.
- [x] 3.2 Give research and editor the same general format definitions. Check both instruction sets for the agreed programme-setting rules and mixed-format precedence.

## 4. Search conditions

- [x] 4.1 Update the research prompt and search-tool description together. Check both texts for absent announcements, essential gaps in evidenced Editions, optional gaps, and resolved questions. Retain known-link priority, shared limits, destination inspection, and current identity restrictions.

## 5. Reports, documentation, and integration

- [x] 5.1 Update report construction and direct result readers to version 6 and the slot shape, including workflow logging and eval code. In existing scope fixtures, replace unordered key expectations with an expected key or null for each slot. Retain new-key and year checks where applicable. Check that swapped research roles fail scoring even when the editor follows them. Check returned counts, add `currentDate`, unsupported-version rejection, and unchanged historical JSON. Run the affected local suites.
- [x] 5.2 Update the ingestion guide, taxonomy guidance, and report examples. Cover selection, null slots, context-only history, date gaps, format, and general search conditions. Remove stale publication restrictions from taxonomy guidance. Sync implemented deltas into their owning main specs. Run `npm run docs:check` and `npm run openspec:validate`.
- [x] 5.3 Run affected ingestion and catalog suites, including CLI, Studio, and tracing checks. Run `npm run type-check` and `npm run lint`. Verify integrated behavior with injected results. Keep live ingestion and new specific-festival checks outside this change.
- [x] 5.4 Run the existing pipeline evals with `CATALOG_CAPTURE_TOOL_OUTPUTS=true` and the editor-only replay evals. Keep both eval reports and pipeline tool results. Match captures to each case by report `runId` and verify files exist for the initial source and tool responses where used. Review failed scores with the captures and record remaining failures or incomplete capture. Use fixed source fixtures and live model generation.
