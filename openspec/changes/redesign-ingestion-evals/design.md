# Design

## Change size

Medium. Explicit evaluators cover five main cases, while 45 regression cases keep their current checks. Reuse the Location runner and scorer added in main `6a4d684`. Main cases also need fixed geocoding responses for the three-agent workflow. Native metrics replace custom usage totals. Storage integration remains the main dependency risk and is checked first.

## Approach

One CLI run selects cases and starts separate Mastra experiments for `main/pipeline`, `regression/pipeline`, `regression/editor`, and `regression/location`. With no selection flags, run the five main cases. Use `--all` to run all 50 cases; keep explicit case and group selection, including `--editor-only` and `--location-only`. Show selected groups and case counts. Use fixed pages, search and geocoding results, and a frozen date. Workflow attempts get a fresh in-memory catalog; isolated Location attempts use their complete fixture input. Evaluator expectations never enter model input.

Main runs apply the normal Research → Editor → Location → writer workflow and check final catalog facts. Pipeline and editor regressions keep dry runs and targeted checks. The editor group injects the research handoff and still includes eligible downstream Location execution. Location regressions call real preparation and `resolveLocation`, then use `scoreLocationCase` without a catalog write or a fabricated ingestion report. A shared runner owns setup and reporting. Mastra owns experiment storage and comparison. See the [proposal](proposal.md) for scope and the [spec](specs/operations/ingestion-evaluation/spec.md) for behavior.

## Case groups and delivery

Add `suite`, `origin`, and a task description. Source origin (`captured | synthetic`) and execution mode remain independent of suite.

| Group | Initial cases | Report |
| --- | --- | --- |
| Main / pipeline | Wacken, Roskilde, Sziget, Glastonbury, Afro Nation Portugal | Catalog quality and scenario success |
| Regression / pipeline | Remaining 25 pipeline cases | Scenario success and failed checks |
| Regression / editor | Existing seven handoffs | Scenario success and failed checks |
| Regression / Location | Existing 13 Location cases | Scenario success and failed checks, split by completion, correction, and preservation |

All 50 remaining cases stay selectable. Tomorrowland is removed until a new case defines one festival identity. Workflow cases cover refresh only; add coverage remains a known gap. Separate fill, verify, and correct cases can share pages but retain their own seed and checks. Location subgroups remain labels within one experiment, not three new suites.

Wacken, Roskilde, and Sziget use real HTTP captures from 2026-10-27, including partial and failed responses. Glastonbury uses synthetic pages adapted from real HTTP reader output on 2026-10-27. Keep navigation, unrelated news, separate local events, page controls and general information. Remove main-festival programme confirmation from body text, links and metadata; archive years stay navigation only. Info contains a natural next-festival notice. Keep its seed and preservation checks; record the source edits in provenance. Afro Nation keeps its blocked capture. Each case records its source origin, date, and provenance.

The five main cases support conclusions about their fixed-source scenarios, not general quality on new sites or event types. Add cases when a reproducible failure on a new source exposes a gap in existing checks; case count alone is not a reason to expand the suite.

Reuse `fixedGeocoding` and normalized request matching. Keep source-backed locality fixtures for Wacken, Roskilde, and Sziget. Include initial forward/reverse requests and agent requests. An unmatched request stays `fixture_miss`, never live fallback or an invented empty provider result. Keep main source and geocoding fixture misses as diagnostics only; missing required facts, wrong checked facts, or failed task conditions still fail the case. Preserve existing regression failure rules. A captured no-match or provider error is declared test input, not a missing fixture.

## Main facts and scores

Use one TypeScript evaluator per main case. Shared helpers compare facts, normalize URL hosts/default ports, compute scores, check identities and protect saved data. Case files own expected values and short comments that name the captured sources. There is no field-path interpreter, field-policy schema, or JSON gold contract.

The normal runner still applies Research → Editor → Location → writer in a fresh catalog. A fill evaluator selects the one new Edition by the difference from saved IDs and checks its writer reference. It protects populated saved Edition facts by value equality, with explicit allowed additions for selected historical Editions. Empty optional fields without declared expectations can be filled without completeness credit. Required fields, identities, publication, and declared coordinate rules stay protected. Version and update time do not count as factual changes. Main checks treat announced and scheduled as equivalent, including saved Edition preservation, until deterministic agent rules define the distinction. Cancelled and postponed remain distinct. Year alone does not select a target. Unrelated Events and Event identities remain protected.

| Unit | Completeness treatment |
| --- | --- |
| New Edition year, date pair, country, event type, topic/culture | Five required units per fill case |
| Listed scalar fields, classification groups, and official link purposes | One additional unit each |
| Full-programme base price, displayed or fee-inclusive | One additional unit |
| Returned offers | Correctness only; no extraction obligation |
| Preserved records, unlisted fields, prose | No completeness credit |

A fact has accepted alternatives. Missing data loses credit; contradictory supplied data adds one located error. Missing optional data alone does not fail a case. Zero expected facts gives N/A. A failed factual guard also counts as an error without adding completeness units. Execution, identities, publication, and source policy remain separate pass/fail conditions. Fixture misses alone are diagnostic in main. Main facts use final catalog data without duplicate Research confirmations. Verification regressions retain their existing evidence checks.

Roskilde keeps its tested 5 required and 11 additional facts. Wacken and Sziget each have 5 required and 8 additional facts. Glastonbury has no dated past or next programme facts: its four official link purposes are additional, its populated saved Edition fields stay unchanged, and its Event stays draft. Afro Nation has no available new facts: both completeness dimensions are N/A, its full Event stays unchanged, and it must return the expected source failure and an unresolved question. Existing failed-research and tool-policy checks remain in use.

Tickets use exact URL/amount/currency combinations. A returned offer needs all three values; labels, terms, availability, and duplicates are unchecked. Missing offers do not change completeness. Offer amounts may use the source's displayed amount or its explicit fee total. Base price accepts declared displayed or fee-inclusive alternatives. Wacken accepts its captured direct store URLs, the same store path without tracking parameters, and EUR 364 or EUR 366 base price. Sziget accepts the three captured admission products and EUR 349 or EUR 372 unrestricted base price. Roskilde accepts the displayed Smart Ticket payment of DKK 524 or the full DKK 2,720 cost (five payments plus a DKK 100 fee). It excludes gift cards and the separate Pumpehuset event. The three fill cases permit declared locality points where no point is saved. They accept their supported Festival/Music classification on an unclassified saved Edition and publication once the saved year, dates, and country satisfy the other gates. Existing coordinates and other saved facts remain protected. Wacken and Sziget do not require Openair for completeness. Captured pages permit Electronic for Sziget and Electronic and Metal for Roskilde. Wrong offer and base prices count separately.

Only explicitly listed facts are checked. Region and other unlisted new fields remain outside the boundary; no empty-region rule is inferred from missing evidence. URL paths, queries, fragments, and trailing slashes stay significant. A new accepted value requires a rule correction and fresh compared experiments.

Main fixtures retain research and tool conditions, without `required`/`forbidden` mutation assertions. Regression definitions and pass/fail checks stay unchanged. Remove the old main scorer, schema, gold files, and duplicate prototype. Keep the raw saved Roskilde output and replay it through the new evaluator without changing its observations.

## Runner and ownership

| Component | Responsibility |
| --- | --- |
| `fixtures.ts` | Load metadata and regression expectations; require a registered main evaluator |
| `run.ts` | Select groups, own isolated workflow databases, dispatch main apply, regression dry run, or isolated Location execution |
| Catalog reader | Use `readResearchCatalog` directly for main before/after state, including unrelated records |
| Main scorer | Check explicit facts and task conditions without model or source calls |
| Existing check modules | Keep workflow and Location regression checks, including required coordinate changes and preservation |
| `scorers.ts` | Expose the task-computed scores through thin Mastra adapters |
| Eval command and storage helper | Load datasets, start experiments, print group results and experiment IDs |

Main outputs retain before/after catalogs, the full workflow result, tool observations, and score diagnostics. Regression outputs retain their existing workflow/check evidence. Keep receipts and reference IDs; ignore timestamps and irrelevant order during factual comparison. Do not require snapshots for regressions.

Keep the real v7 ingestion report once in workflow output. For isolated Location, retain execution, materialized decisions, safe geocoding observations, actual agent tool calls, and errors. Keep initial geocoding observations distinct from agent calls. Retain run IDs and available real trace IDs in both paths; do not invent traces when tracing is disabled.

Save detailed eval outputs only in Mastra. Remove the separate JSON report builder, file writer, and eval `--report` option. The CLI prints group summaries, failed checks, and experiment IDs. This removes duplicate output formats; there is no portable JSON export or fallback report file. Normal ingestion reports remain unchanged.

Expose required completeness, additional completeness, no-checked-errors (1 or 0), and scenario success as main scores. Keep the raw error count in item output and the CLI. Native comparisons assume higher scores are better; do not expose an inverted raw error count as a quality score. Regression exposes scenario success only; existing numeric intermediate results can remain internal. Use `notScorable()` for intentional N/A. Distinguish failed checks from task/scorer errors; either causes a nonzero CLI exit. Finish other groups after scenario failures and report execution failures separately.

## Mastra storage and comparison

The installed DuckDB adapter provides observability, not dataset or experiment storage. Add a compatible LibSQL adapter and a separate local eval database. Before scoring work, verify persistence with a deterministic experiment containing a correct result, a wrong result, N/A, and an execution failure. Mastra manages these tables; no catalog migration is needed.

The eval CLI uses this store. Existing Studio receives its datasets, experiments, and scores domains through composite storage, while keeping its current observability setup. Use the same absolute eval database path in both processes. Eval execution stays in the CLI with an inline task; Studio is for viewing and comparing saved runs. Do not register the owner-catalog workflow as an eval target.

Accept experiment storage failures as an exceptional case handled only by Mastra's existing behavior. Add no custom recovery, retries, or post-run storage checks. A score write failure can remain a warning and leave incomplete saved scores without a failed CLI exit. The integration test verifies normal result and score persistence across restart; it does not add runtime guarantees for write failures.

Repository files remain the source of truth. Hash all JSON/MD files under `cases/`, `main.ts`, and non-test TypeScript files under `main/`, in sorted path order. Hash file names and full contents once per command. This coarse hash covers all cases and main rules for every group; whitespace, comments and changes to unselected cases can create new datasets. Keep the explicit scorer version for scoring changes outside these paths. Do not hash the resolved in-memory suite or store source snapshots.

Dataset identity combines that file hash with group, sorted selected case IDs, repeat count and scorer version. Use Mastra item `externalId` from case ID and repetition. If the dataset ID exists, reuse it without reading saved items or comparing saved content; otherwise create it and add the case items. Pin the current native version for each experiment. Edit definitions only in repository files. Manual Studio changes are not detected or imported. Keep case expectations in item ground truth and compact revision metadata on the dataset.

Store workflow revision and resolved Research, Editor, and Location models and prompt versions, plus reasoning effort, service tier, and limits on each experiment. These settings do not change dataset identity.

Compare runs of the same dataset revision in Studio. This supplies per-item and per-scorer results without a custom comparison engine. Changed inputs, expected values, or scorer rules require fresh runs for all compared models. Cross-revision results can be inspected but are not a valid quality comparison; Studio is not a domain-aware compatibility gate.

Name experiments `<branch> · <group> · <model>` with an optional `--label` suffix, such as `before`, `after` or `prompt-v2`. Use the resolved Location model for the isolated Location group. For detached HEAD, use the first eight commit characters instead of a branch. Save `workflowRevision`, `workflowBranch` (null for detached HEAD), `workflowDirty` (tracked changes or untracked files) and `label` (null when absent) in experiment metadata. Read Git state once per command. Names can repeat; experiment IDs stay unique. These fields and model selection do not change dataset identity.

Use the same repeat count for every case in a comparison. Native means then give each case equal weight for fully scored dimensions. Show N/A and applicable counts in CLI summaries and saved diagnostics. Do not rely on native score-table counts for N/A or rank failed or incomplete runs by partial means. Keep suite/mode summaries separate. Unequal-repeat aggregation, partial-set comparison, offline rescoring, and a custom UI are deferred.

### Duration, tokens, and cost

Show experiment/task duration separately from quality. Inspect tokens and cost through existing optional Mastra observability, using retained run/trace IDs. With `CATALOG_TRACING=true`, current tracing includes dry-run and injected-source evals. Keep Research, Editor, and Location distinguishable by their native agent IDs. Reuse existing flush and storage ownership; do not add another telemetry collector.

Do not add token/cost fields, metric queries, or replacement totals to eval output or CLI summaries. Link the existing [metrics guide](../../../docs/ingestion-process.md#execution-metrics) from eval documentation. Missing metrics remain unknown, not zero. Native reported and estimated costs stay distinct; cache/reasoning token details are subsets, and model costs do not represent search or geocoding bills. Budget counters remain available for source/tool policy checks without tracing.

### Model selection guidance

An explicit `--model X` sets both `config.model` and `config.locationModel` to X for every selected group. It overrides `CATALOG_LOCATION_MODEL`, including in combined and isolated Location runs. Without `--model`, keep current environment resolution: Research and Editor use `OPENROUTER_MODEL` or its default; Location uses `CATALOG_LOCATION_MODEL` or falls back to that model. Save the resolved stage models in experiment metadata.

Use these rules for human decisions, without an automatic ranking or a new combined score:

- Compare the share of cases without checked factual errors first, then required completeness, then additional completeness. Use cost and duration when quality is close.
- Keep one repetition as the CLI default for development. For model selection, recommend three repetitions of each main case for each model, on the same evaluation revision. This is not a CLI minimum or proof of statistical superiority. Do not choose a winner from a lead that rests on one successful attempt.
- Before replacing a model, run all 50 cases for both the current model and the candidate. Resolve new regression failures before replacement, including Location completion, correction, and preservation. Inspect whether the cause is model behavior, a narrow expectation, or unstable results. Keep this as review guidance, not a new automatic replacement gate.

## Validation

Test shared comparison rules in helper tests. Test common main conditions once and keep case-specific tests for source rules and important errors. Do not repeat each expected value or the same omission for each festival. Keep one real replay through the current scorer; do not test the old saved score as a JSON constant. Test case evaluators with independent model substitutes and deliberate corruption, including optional omissions, wrong currency, URL alternatives, wrong extras, saved records, and diagnostic fixture misses. Reuse existing identity, preservation, source-isolation, and rollback tests where applicable.

Verify all five main cases load and all 45 regressions keep their pass/fail meaning. Test default selection and all 50 selected cases without model calls. Use seven representative cases for an explicit `--all` integration run across all four experiment groups, including a failed Location case and valid siblings. Test all five main evaluators separately. Reuse Location tests for initial/agent fixture misses, required changes, and preservation. Check geocoding changes create a new dataset revision. Store two comparable experiments and inspect them through the built-in browser in Studio. Verify persistence after restart, stable item alignment, N/A handling, and optional run/trace correlation without fabricated usage. No paid model run is needed to prove these contracts.

Reuse `evals/location.test.ts` and `runtime/observability/metrics.integration.test.ts` for tracing and native token/cost coverage. New model and observability checks cover only model selection and saving/reopening experiment metadata and run/trace IDs.
