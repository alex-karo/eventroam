# Tasks

## 1. Schema and catalog contracts

- [x] 1.1 Add `occurrences.price_details` and `closed` availability in `src/db/schema.ts` and a reviewed migration. Verify the price array default and JSON constraint, existing data, foreign keys, indexes, and audit immutability on a migrated temporary database.
- [x] 1.2 Extend operation schemas, serialization, and payload hashing for complete price blocks. Unit tests verify invalid payload rejection, amount/currency constraints, round-trips, and hashes that include variant values.
- [x] 1.3 Add private research reads for drafts, versions, links, classifications, variants, and attribution needed to preserve owner corrections. Verify returned context and document the schema and backup/migration procedure in the development guide.

## 2. Writer and publication gates

- [x] 2.1 Extract shared preparation/validation for dry-run and apply, retaining the single-operation API. Verify identical decisions for fixed inputs and no dry-run changes to records, versions, audit, or receipts.
- [x] 2.2 Support related operations in one item transaction, resolving temporary Event/Occurrence references. Test dependent creation/publication, full rollback, stale versions, receipt replay, and isolation between festivals.
- [x] 2.3 Enforce structural publication gates on every path, including unchanged draft facts and classifications. Test price removal, owner attribution, and rejection of structurally incomplete publication.
- [x] 2.4 Write normalized variant arrays and primary prices as one complete block. Database tests verify replacement, clearing with audit notes, rollback of both representations, unchanged-order no-ops, and no per-variant updates.
- [x] 2.5 Propagate `closed` through public contracts and display “Ticket sales closed”. Test read/presentation behavior and exclusion of ticket variants from public payloads; inspect the changed state with the built-in Browser.

## 3. Source tools and runtime

- [x] 3.1 Add pinned Mastra/OpenRouter and HTTP extraction dependencies with configurable model, credentials, and limits. Verify Node compatibility and tool/structured-output setup; document environment variables and module boundaries without exposing secrets.
- [x] 3.2 Implement `readSource` HTTP extraction and Facebook/Instagram stubs with the shared result contract. Fixture tests cover blocks, links, timestamps, partial/unsupported content, failures, and social-link preservation.
- [x] 3.3 Remove the Chromium fallback and render budget; retain bounded HTTP public-address checks and redirect validation. Verify partial reporting for a JavaScript-dependent page and rejection of private targets, unsafe redirects, and oversized responses.
- [x] 3.4 Implement `discoverSources` using the OpenRouter web plugin with explicit `exa` and result limits. Verify candidate-only results, separate search costs, and no search plugin on ordinary model calls using mocked provider responses.

- [x] 3.5 Preserve page structure as bounded Turndown Markdown in source reads and agent input; retain exact citation anchors, regenerate fresh source fixtures, and compare the five Mastra eval cases.

- [x] 3.6 Replace citation blocks with continuous Markdown and URL/excerpt validation; regenerate all five source inputs while preserving their expected behavior.

## 4. Research and reconciliation

- [x] 4.1 Implement one research agent with read/search tools and Zod-validated candidates. Test exact excerpt membership, code-supplied URLs/times, untrusted-page instructions, and absence of write tools.
- [x] 4.2 Match Event identity and isolate editions using private catalog context. Test existing-event reuse, same-brand festivals, relocation, latest completed/next announced editions, and no invented or fallow-year Occurrences.
- [x] 4.3 Establish organizer identity and follow its edition-specific ticket links, retaining referring URLs/context without a seller-verification subsystem. Fixtures verify matching editions, rejection of saved-flag/search-rank authority, and unlinked third-party pages used only as leads.
- [x] 4.4 Implement shared conflict, supersession, and missing-field rules, including link merging. Test explicit corrections, unresolved contradictions, owner-correction preservation, and missing facts/links retained outside the price policy.
- [x] 4.5 Reconcile programme dates and complete locations. Fixtures verify camping dates are excluded, moves clear invalid coordinates or skip the group, and sibling editions remain unchanged.
- [x] 4.6 Reconcile edition classifications and capacity. Test edition-specific additions/removals and classifications blocked by structural publication rules, and attendance ranges or campsite capacity not converted into event capacity.
- [x] 4.7 Have the agent return `priceDetails` and typed `basePrice` or `null`; validate structure and coverage without a price-selection algorithm. Fixtures verify major/minor-unit contracts, free/ambiguous prices, day-only/empty results, and failed reads/invalid extraction skipping updates.
- [x] 4.8 Reconcile ticket availability independently from price clearing. Test edition-wide versus single-offer closure/sell-out, reopening, missing information, and schedule status preservation.
- [x] 4.9 Generate the factual English Event summary for `add` from reconciled facts. Verify source support, edition separation, and the existing 2,000-character limit; leave editorial style and summary-refresh refinements deferred.
- [x] 4.10 Assemble the workflow with validation feedback and host-enforced shared budgets. Test a resolved location issue, no-progress exit, at most two extra research rounds, transient retries, input/output limits, and partial results without budget resets; document source provenance and simple price-replacement rules in the development guide.

## 5. Local commands and reports

- [x] 5.1 Add `commands/catalog.ts` and the npm entry point for `add`, `refresh`, and `check`. Command tests verify inputs, actor attribution, dry-run default, direct eligible publication, explicit republication, and fresh research on ordinary apply after dry-run.
- [x] 5.2 Produce JSON and terminal reports with outcomes, old/new values, inspected URLs, gaps, stable reasons, model/prompt versions, time, tokens, and cost. Verify unchanged checks add no audit and logs contain no full pages, prompts, credentials, or sessions.
- [x] 5.3 Document CLI examples, limits, reports, fresh reruns after interruption, and dry-run/apply semantics in the development guide; update project structure and implementation progress. Verify examples against a temporary catalog and run `npm run docs:check`.

## 6. Integration and live acceptance

- [x] 6.1 Exercise all collection modes end to end with fixed sources and model responses. Verify identity reuse, useful partial success, dry-run/apply parity, publication gates, fresh reruns after crashes before/after item commit, and public/private separation; run type-check, lint, format check, unit/integration tests, and build.
- [x] 6.2 Before experiments, make a consistent backup of the entire `data/eventroam.sqlite`, verify integrity, and create a separate full working copy. Target 2000trees, Boom Festival, Afro Nation Portugal, and Zurich Openair there; use an empty catalog for `add`. Record IDs and expectations for two field changes and one publishable addition; confirm the original and backup remain untouched.
- [x] 6.3 Run the opt-in live sample, select the configured OpenRouter model, and record accuracy, gaps, duration, tokens, and cost. Require the expected changes and a successful published `add`, with no unsupported writes, duplicates, or edition leakage; retain a concise validation report and run OpenSpec/documentation checks.

## 7. Simplify research responsibility

These tasks supersede the reconciliation mechanics in section 4. Its source-quality requirements remain agent instructions and eval expectations.

- [x] 7.1 Replace host reconciliation with one model-selected candidate and a schema/target adapter; retain writer validation, omission rules, and atomic dry-run/apply.
- [x] 7.2 Simplify research context and source navigation for Event-level `add`, `refresh`, and `check`; cover target isolation and link selection with deterministic tests.
- [x] 7.3 Finalize the Event-level CLI, model defaults, provider accounting, and private research reports; verify their contracts.
- [x] 7.4 Add five fixed-source Mastra evals with captured pages and required/forbidden catalog-change assertions; report results separately from apply decisions.
- [x] 7.5 Sync specs and documentation, run project checks, and leave live semantic acceptance to 6.3.
