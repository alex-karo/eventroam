# Design

## Change size

Medium. Explicit evaluators cover five captured cases, while 45 regression cases keep their current checks. Reuse the Location runner and scorer added in main `6a4d684`. Main cases also need fixed geocoding responses for the three-agent workflow. Native metrics replace custom usage totals. Storage integration remains the main dependency risk and is checked first.

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

The five main cases support conclusions about their fixed-source scenarios, not general quality on new sites or event types. Add cases when a reproducible failure on a new source exposes a gap in existing checks; case count alone is not a reason to expand the suite.

Reuse `fixedGeocoding` and normalized request matching. Keep source-backed locality fixtures for Wacken, Roskilde, and Sziget. Include initial forward/reverse requests and agent requests. An unmatched request stays `fixture_miss`, never live fallback or an invented empty provider result. Fail main cases on fixture misses even if Location later returns valid output. Preserve existing regression failure rules. A captured no-match or provider error is declared test input, not a missing fixture.

## Main facts and scores

Use one TypeScript evaluator per main case. Shared helpers compare facts, normalize URL hosts/default ports, compute scores, check identities and fixtures, and protect saved data. Case files own expected values and short comments that name the captured sources. There is no field-path interpreter, field-policy schema, or JSON gold contract.

The normal runner still applies Research → Editor → Location → writer in a fresh catalog. A fill evaluator selects the one new Edition by the difference from saved IDs and checks its writer reference. It protects complete saved Editions by value equality. Year alone does not select a target. Unrelated Events and Event identities remain protected.

| Unit | Completeness treatment |
| --- | --- |
| New Edition year, date pair, country, event type, topic/culture | Five required units per fill case |
| Listed scalar fields, classification groups, and official link purposes | One additional unit each |
| Full-programme base price with mandatory fees | One additional unit |
| Returned offers | Correctness only; no extraction obligation |
| Preserved records, unlisted fields, prose | No completeness credit |

A fact has accepted alternatives. Missing data loses credit; contradictory supplied data adds one located error. Missing optional data alone does not fail a case. Zero expected facts gives N/A. A failed factual guard also counts as an error without adding completeness units. Execution, identities, publication, source policy, and fixtures remain separate pass/fail conditions. Main facts use final catalog data without duplicate Research confirmations. Verification regressions retain their existing evidence checks.

Roskilde keeps its tested 5 required and 11 additional facts. Wacken and Sziget each have 5 required and 9 additional facts. Glastonbury has no confirmed programme facts: its four official link purposes are additional, its saved Edition stays unchanged, and its Event stays draft. Afro Nation has no available new facts: both completeness dimensions are N/A, its full Event stays unchanged, and it must return the expected source failure and an unresolved question. Existing failed-research and tool-policy checks remain in use.

Tickets use exact URL/amount/currency combinations. A returned offer needs all three values; labels, terms, availability, and duplicates are unchecked. Missing offers do not change completeness. Offer amounts may use the source's displayed amount or its explicit fee total. Base price must include mandatory fees. Wacken accepts its captured direct store URLs and EUR 366 base price. Sziget accepts the three captured admission products and EUR 372 unrestricted base price. Roskilde excludes gift cards. Wrong offer and base prices count separately.

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

Repository files remain the source of truth. Before a run, load the selected cases into a dataset for their group and evaluation revision. Use Mastra item `externalId` from case ID and repetition; reuse the generated item IDs on later runs. Reuse unchanged datasets without appending duplicate items. Do not import Studio edits back to files. Compare item identity, input, ground truth, and metadata, plus owned dataset metadata, before execution. Ignore unused Mastra item fields and extra dataset metadata.

`mainEvaluatorSources()` stores case evaluator and shared helper source text once in main dataset metadata. Each item ground truth contains only its case expectations. Changes to these texts change the revision without a manual version bump. Main expected values do not enter model input. Keep the explicit scorer version for changes outside those files.

The evaluation revision covers selected case IDs, resolved page/search contents, normalized geocoding requests and responses, seed or complete Location input, date, taxonomy, handoffs, main evaluator source text and task conditions, regression expectations, scorer version, and repeat count. Use a separate dataset identity when this revision changes. Store workflow revision and resolved Research, Editor, and Location models and prompt versions, plus reasoning effort, service tier, and limits on each experiment. Verify repository and dataset content before model calls, then pin the verified dataset version for execution.

Compare runs of the same dataset revision in Studio. This supplies per-item and per-scorer results without a custom comparison engine. Changed inputs, expected values, or scorer rules require fresh runs for all compared models. Cross-revision results can be inspected but are not a valid quality comparison; Studio is not a domain-aware compatibility gate.

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

Test shared comparison rules in helper tests. Test common main conditions once and keep case-specific tests for source rules and important errors. Do not repeat each expected value or the same omission for each festival. Keep one real replay through the current scorer; do not test the old saved score as a JSON constant. Test case evaluators with independent model substitutes and deliberate corruption, including optional omissions, wrong currency, URL alternatives, wrong extras, saved records, and fixture failures. Reuse existing identity, preservation, source-isolation, and rollback tests where applicable.

Verify all five main cases load and all 45 regressions keep their pass/fail meaning. Test default selection and all 50 selected cases without model calls. Use seven representative cases for an explicit `--all` integration run across all four experiment groups, including a failed Location case and valid siblings. Test all five main evaluators separately. Reuse Location tests for initial/agent fixture misses, required changes, and preservation. Check geocoding changes create a new dataset revision. Store two comparable experiments and inspect them through the built-in browser in Studio. Verify persistence after restart, stable item alignment, N/A handling, and optional run/trace correlation without fabricated usage. No paid model run is needed to prove these contracts.

Reuse `evals/location.test.ts` and `runtime/observability/metrics.integration.test.ts` for tracing and native token/cost coverage. New model and observability checks cover only model selection and saving/reopening experiment metadata and run/trace IDs.
