# Tasks

Implementation was authorized by the explicit apply request. [Design](design.md) owns scope, module interfaces, preserved contracts and the verification matrix; delta specs remain skipped because requirements do not change.

## 1. Establish the behavior baseline

- [x] 1.1 Run the offline baseline suite listed in [deterministic behavior acceptance](design.md#deterministic-behavior-acceptance); record its result and resolve unexplained failures before extraction without weakening assertions.
- [x] 1.2 Add missing fixed-input characterization for prompt projections (including the reduced remaining-budget shape), saved-price/source projections and provider response-schema compatibility, using the existing injected/mock-fetch seams. Verify the new expectations pass against the original implementation with the focused tests described in the design.
- [x] 1.3 Add only important uncovered native Mastra timeout, retained serialized-limit, cyclic-cause or deadline tests for `classifyModelError`; verify exact diagnostics and absence of sensitive payloads against the original `agent.ts` before moving any production code.

## 2. Extract the three owners sequentially

- [x] 2.1 Move model input functions and their tests to `research/model-input.ts`; in the same step move `ResearchCatalog` to `context.ts` and update its type-only consumers. Verify input characterization, price/preparation and `runtime/tracing/labels.test.ts`, plus `npm run type-check`, with unchanged expectations.
- [x] 2.2 Move response-schema adaptation and optional-null normalization together to `research/wire.ts`, including their tests. Verify provider schema compatibility, clearing versus omission, strict rejection and raw-response preservation through focused contract/preparation and mock-provider cases; run `npm run type-check`.
- [x] 2.3 Move safe error classification and its tests to `research/model-errors.ts`, preserving `isMastraTimeoutError` and keeping catches, native iteration policy, cancellation, logging and execution state in agent. Verify the unchanged diagnostic expectations from 1.3, relevant offline timeout/retry/cancellation/cleanup and logging cases and `npm run type-check`.
- [x] 2.4 Update the existing ingestion paragraph in `docs/project-structure.md` once to describe the verified owners and reading path. Verify it matches the completed extractions and `npm run docs:check` passes; add no separate architecture guide or check configuration.

## 3. Verify the complete pilot

- [x] 3.1 Run the baseline suite again (including existing shared-workflow and offline Studio transport cases), then `npm run type-check`, `npm run lint`, `npm run format:check` and `npm run openspec:validate`; record results against the design's behavior acceptance matrix. Broaden or repeat checks only for new changes, failures or unresolved concerns.
- [x] 3.2 Perform the four [clarity exercises](design.md#clarity-acceptance-and-durable-follow-up), using the design's current reading path as the baseline; inspect imports and the final diff against its permitted boundaries. Record remaining friction and verify documentation accuracy, preserved behavior and scope before marking the pilot complete.

## 4. User-requested agent layout and prompt extraction

- [x] 4.1 Group agent execution, input, wire and error code with their existing tests under `research/agent/`, using `index.ts` as the implementation entry and concise local names. Extract the exact instruction text into `prompt.ts`, retain JSON serialization in `input.ts`, update relative imports, and verify declaration/prompt equivalence plus focused research/provider tests and type checking. Add no compatibility barrel or runtime file loader.
- [x] 4.2 Update current documentation and change links/ownership to the resulting layout, then run the relevant offline regression suite, lint, formatting, documentation and OpenSpec checks. Record the final results and confirm no snapshots or new execution layers were introduced.

## Completion notes

- Baseline at `3b3fa9f`: 26 files / 349 tests passed offline on Node 26.10.0 and npm 11.19.1. Dependencies were installed locally from the unchanged lockfile; npm and native-build caches are under `/tmp`.

- Characterization passed on the original implementation: 38 tests across input/provider fixtures, including full prompt and actual response-schema snapshots; 19 research-helper cases then passed with the additional timeout, serialized-limit, cyclic-cause and deadline assertions. Snapshots were captured before production extraction and were later removed at the user's request; projection, compatibility and boundary assertions remain.
- Sequential extraction checks passed: input/preparation/trace labels (28 tests) and currency contracts (6); wire/contracts/preparation/mock provider (53); errors/provider/workflow/tracing/logging/observability (144). TypeScript passed after each extraction. TypeScript AST printing also confirmed every moved declaration and all remaining agent declarations match the baseline apart from exports and formatting.

- Clarity exercise — entry and effects: CLI `runCatalogResearch` and Studio `createStudioIngestionWorkflow` still enter the same eight-step graph in `workflow.ts`. `researchFestival` calls the three concrete transformation owners directly; callbacks and model cleanup remain visible there. Attempt finalization, active-work waiting and connection ownership remain in `attempt.ts`.
- Clarity exercise — branches: generation failure remains agent-owned; a generated failed envelope passes to strict preparation without operations. Invalid structure/target is rejected in preparation. Valid partial proposals can reach the writer; writer rejection rolls back the item while report assembly preserves research status and raw output. No branch or reporting policy moved.
- Clarity exercise — price: stored minor units now enter `model-input.ts: modelContext` and become major-unit base prices via `money.ts`. Wire adaptation preserves inner clearing; contracts enforce precision, `prepareTickets` converts the complete block into minor-unit `replacePriceBlock`, the writer owns committed validity, and report assembly joins actual diffs to reasons. The read, writer, public projection and report implementations are unchanged.
- Clarity exercise — change owners: an optional fact starts in strict `contracts.ts` and the adjacent `wire.ts` null-path policy, then its preparation mapping; prompt guidance is in `model-input.ts`. Safe error changes start in `model-errors.ts` and its allowlists/native timeout predicate. Remaining friction is the explicit optional-null path list and publication preflight overlapping authoritative writer checks; both are visible and unchanged, with no required follow-up in this pilot.
- Scope/import review: input has only the money runtime dependency, wire only contracts/Zod, and errors only the existing budget error/native timeout predicate. Context consumers are type-only. The production diff contains the three extractions, the context type relocation and tracing-label type import; no interfaces, services, barrels, provider wrappers, new enforcement configuration or workflow/writer/source execution changes were introduced.

- Final behavior matrix: all six evidence groups in the design passed in the offline regression run (28 files / 363 tests, versus the original 26 / 349). This includes safe diagnostics/limits, price/wire preparation, actual mocked provider requests, shared workflow/persistence, atomic writes/tracing/logging, and Studio transport. The 14 additional cases cover source bounds and error classifications; original assertions remain unchanged.
- Final static checks passed: `npm run type-check`, `npm run lint`, `npm run format:check`, `npm run openspec:validate` (9 items), and `git diff --check`. Documentation validation passed with its 10 checker tests. No live providers, user catalog writes, browser runs or schema migrations were used.

- User-requested simplification: removed both full-output snapshot assertions and their files (1046 snapshot lines). Existing price/context, remaining-budget, source bounds, provider schema/enum, strict validation and clearing assertions remain; exact full-output equality is no longer a completion requirement.

- User-requested layout: execution now lives directly in `research/agent/index.ts`, with input/wire/errors and adjacent tests in the same directory. `prompt.ts` exports the fixed instruction text; JSON context construction stays in `input.ts`. Host context/contracts/money/preparation remain above the folder. Existing consumers resolve the unchanged `./research/agent` import to the implementation entry without a compatibility barrel.
- Layout verification: all relocated implementation/test declarations are identical to their pre-layout versions; input declarations are identical after inlining the separate prompt constant, whose literal was checked byte for byte. Focused research/provider tests passed (6 files / 70 tests) and TypeScript passed. No snapshots, runtime file loader or additional execution layer was added.

- Final layout regression passed: 28 files / 363 tests, covering CLI/Studio resolution of the directory entry, provider behavior and lifecycle. TypeScript, lint, formatting, docs (10 checker tests), OpenSpec (9 items) and whitespace checks passed. Project structure and active change links describe the final folder and separate prompt.
