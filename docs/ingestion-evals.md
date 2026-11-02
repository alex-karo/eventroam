---
type: Guide
title: Ingestion evals
description: The approach, scoring rules, and requirements for ingestion evaluation cases.
status: stable
tags: [catalog, ingestion, evals]
---

# Ingestion evals

Evals measure catalog quality and protect specific workflow behavior. They use fixed inputs so that model comparisons can separate model changes from changes to source websites. This guide covers commands, result inspection, and case maintenance. The [evaluation spec](../openspec/specs/operations/ingestion-evaluation/spec.md) defines the current contract.

## Run evals

`pnpm run catalog:eval --help` lists options. The default runs five main cases once. Main runs the complete ingestion flow in a fresh in-memory catalog. Workflow regressions use dry runs; isolated Location cases use complete inputs without a catalog or writer. The owner's catalog stays untouched. Pages, searches, date, taxonomy, and geocoding come from fixed fixtures. Only model calls use the network and can incur charges. CI does not run evals or tests of the eval code, and application coverage excludes eval code and its CLI. Run evals through the CLI when needed.

```sh
pnpm run catalog:eval
pnpm run catalog:eval --all
pnpm run catalog:eval --group regression/pipeline
pnpm run catalog:eval --editor-only
pnpm run catalog:eval --location-only
pnpm run catalog:eval --group regression/reader
pnpm run catalog:eval --case sziget --repeat 3 --model openai/gpt-6-luna
pnpm run catalog:eval --label before
pnpm run catalog:eval --label after
```

Cases form five separate experiment groups. Use CLI help for the current selection:

| Group | Purpose |
| --- | --- |
| `main/pipeline` | Catalog quality and scenario success |
| `regression/pipeline` | Targeted workflow behavior |
| `regression/editor` | Captured Editor handoffs and eligible Location |
| `regression/location` | Direct Location execution |
| `regression/reader` | Full-page extraction, literal binding and evidence context |

Use repeated `--group GROUP` or `--case ID` flags for a selection. A case selection without a mode flag can span groups. Use one of `--all`, `--group`, `--editor-only`, or `--location-only`; an incompatible case selection fails before provider setup. `--repeat N` accepts 1–20 and applies equally to all selected cases. Location retains separate completion, correction, and preservation summaries. Its positive cases require the declared changes; keep-only output cannot pass them. The provider adapter tests cover raw Geoapify parsing; eval fixtures cover normalized client responses.

### Model settings

`--model X` selects X for all eight agents, including direct Location, and overrides `CATALOG_LOCATION_MODEL`. Without it, Research and Editor use `OPENROUTER_MODEL` or the default; Location uses `CATALOG_LOCATION_MODEL` or falls back to the same model. Experiments save resolved stage models, prompt versions, workflow revision, reasoning effort, service tier, and limits. Reader uses medium reasoning effort for literal extraction. Tickets, Classification and Links use the configured effort. Research, General, Editor and Location use medium when the configured effort is low; other explicit settings stay unchanged. Native call logs retain the effective settings. Injected handoffs do not claim Research usage.

### Results and failures

Results are saved as Mastra datasets, experiments, and scores. The eval command has no `--report` option and writes no separate JSON report. Ordinary ingestion reports are unchanged. Each workflow result contains one current ingestion report in `output.report`; main also retains `before`, `after`, and `quality`. Direct Location retains its actual execution, observations, run ID, and available trace ID without a fabricated workflow report. A returned failure report is scored against the case.

Unexpected task errors have null output and a bounded diagnostic; scorer errors remain distinct from intentional N/A. Other cases and groups continue.

Failed scenarios, task/scorer errors, or missing required scores cause exit code 1. Mastra task completion counts are not quality pass counts.

### Experiment names

Experiment names use `<branch> · <group> · <model>` and append `--label` when supplied. For example, `feature/location · main/pipeline · openai/gpt-6-luna · before`. The isolated Location group uses its resolved model. Detached HEAD uses the first eight commit characters instead of a branch. Each experiment saves the full commit, branch, dirty flag and label in metadata. The dirty flag includes tracked and untracked files. It does not save their contents. Names can repeat; IDs stay unique. Branch, commit, dirty state, label and model do not change dataset identity.

The CLI shows counts, metrics, N/A applicability, failed checks, experiment IDs, and duration. Use the [score definitions](#keep-completeness-and-errors-separate) to interpret them.

Edit cases and checks in the [source locations below](#define-what-the-sources-can-support). Review source identity, Edition identity, venue versus office addresses, and ticket links versus signup forms when refreshing captures. Follow the [revision rules](#compare-models-on-the-same-revision) before comparing results.

### Inspect and compare in Studio

Start `pnpm run catalog:studio`, open `http://127.0.0.1:4111`, and choose **Experiments**. Open an experiment to inspect item outputs and per-scorer values. Select **Compare**, choose two runs of the same group and dataset revision, then select **Compare Experiments**. Stable item IDs align repetitions. Run new experiments from the CLI; the Studio inline target is not an executable eval entry point. Use each dimension, not Studio's generic overall average. N/A appears as a dash; inspect saved quality counts or the CLI summary for applicability. Do not rank failed or incomplete runs by partial means. Changed cases, inputs, expectations, scorer rules, or repeat counts require fresh runs for both models.

### Usage and storage failures

Duration is separate from quality. Set `CATALOG_TRACING=true` to collect native tokens and cost. Eval traces and metrics carry the experiment ID, and saved result rows link to their real trace. Concurrent cases share one DuckDB store for the full CLI run; the CLI closes it after all cases finish. Studio shows the native Tokens/Cost summary when metrics are available; evals add no usage totals or metric queries.

Eval runs and Studio must use the same `CATALOG_OBSERVABILITY_DATABASE_PATH`. Close Studio before CLI evals and reopen it after they finish: separate processes cannot write to the same DuckDB file at the same time. Old runs without this correlation are not backfilled. See [execution metrics](ingestion-process.md#execution-metrics). Missing metrics are unknown.

Experiment storage write failures retain Mastra's native errors or warnings; no custom retry, recovery, post-run storage check, or JSON fallback is added. For this exceptional case, scores can be incomplete and the exit code might not indicate failure.

## Local eval storage

Mastra datasets, experiment results, and scores use `CATALOG_EVAL_DATABASE_PATH`, which defaults to `data/mastra-evals.sqlite`. This file is separate from the catalog and DuckDB observability. Relative paths resolve from the project root. `pnpm run catalog:studio` passes the same absolute path to Studio; set it explicitly for `studio:start` if you use a custom path. Studio can inspect saved datasets and experiments without model credentials. Keep eval execution in the CLI.

The [archived `SQLITE_BUSY_SNAPSHOT` issue](archive/known-issues/2026-10-27-mastra-sqlite-busy-snapshot.md) records earlier incomplete score writes and experiment update failures. The error did not recur in the final 100-attempt measurement after the dependency update; no separate concurrency check was run.

## Separate case purpose from source origin

Main cases measure the final catalog after the full Research → Editor → Location → writer flow. Each attempt starts from a fresh disposable catalog. Regression cases check a specific behavior through the pipeline, an Editor handoff, or direct Location execution. Keep their results separate; do not combine them into one quality average.

Source origin is a different property. Both main and regression cases can use captured or synthetic sources. Fill, verify and correct are separate tasks, even when they use the same pages. A blocked-source case can pass by returning the expected failure and preserving the catalog.

Add a case for a distinct task or an observed failure. Reuse pages when useful, but avoid cases that repeat the same input and checks without adding coverage. Use the CLI group selection to see the current cases.

## Define what the sources can support

Each case needs a clear task, initial catalog, fixed date, source origin and provenance. Supply the page, search and geocoding responses needed for that task. Keep evaluator expectations out of model input.

Define expected facts from the supplied evidence, independently of a model answer or production validation. A structurally valid date can still be false. Check Event and Edition identity, the programme year, venue versus office addresses, and admission products versus unrelated purchases.

Use explicit TypeScript evaluators with shared helpers. Keep expected alternatives and source comments close to the checks. Do not add a general rule engine or require a policy for every possible field.

Case inputs and source files live in [`src/ingestion/evals/cases/`](../src/ingestion/evals/cases/). Main checks live in [`src/ingestion/evals/main/`](../src/ingestion/evals/main/). Regression checks live in adjacent `checks.ts` files under `cases/`; [`regression.ts`](../src/ingestion/evals/regression.ts) registers workflow checks and [`location.ts`](../src/ingestion/evals/location.ts) registers direct Location checks. Register a new case in the suite manifest and its evaluator registry.

## Keep completeness and errors separate

Main exposes four scores:

| Score | Meaning |
| --- | --- |
| `required-completeness` | Correct required facts / expected required facts |
| `additional-completeness` | Correct additional facts / expected additional facts |
| `no-checked-errors` | 1 when no checked fact is wrong; otherwise 0 |
| `scenario-success` | Required facts, checked correctness, execution and task conditions all pass |

Use required facts for the task and publication needs. Additional facts improve the record but are not a requirement for success. A dimension with no expected facts is N/A, not zero. Saved facts earn no completeness credit.

For each declared fact:

- Missing: no credit. A required omission fails the case; an additional omission alone does not.
- Correct: one unit of credit, including an accepted alternative.
- Wrong: no credit and a checked error, including an additional fact.

For example, omitting a checked Instagram link lowers additional completeness. An unsupported official Instagram URL adds an error. The error count counts failed factual checks, not individual characters or every field in a record.

Publication, identity, protected records and execution have separate conditions. High completeness cannot compensate for a failed condition.

Regressions use the same pass/fail check format as main conditions. They expose `scenario-success`: all checks must pass. Workflow, Editor and Location regressions save `checks` and `passed`, without intermediate percentages or separate diagnostic categories. Reader also exposes evidence recall and literal validity, as described [below](#isolated-reader-cases). The CLI and Mastra reason show failed-check messages.

Define workflow, Editor and Location regression checks in the case directory's `checks.ts`: catalog mutations, source-check results, tool use, and Location decisions. Use plain TypeScript conditions and small helpers. JSON files hold inputs, source references, geocoding responses and captured role results. They have no `expectations` block or comparison language. The loader rejects an unregistered evaluator in every group before model calls. Dataset revisions include the check code; saved outputs retain each check's result and message. Expected values do not enter model input.

Editor handoff fixtures use schema version 5. Collection checks use nullable text reasons for source acquisition blockers rather than interpretation findings. Each fixture fixes the ordered page reads, Reader outputs, collection result and specialist proposals with explicit evidence references. Research and Reader use these fixed results without model calls. Normal collection still binds literal quotations and saves source artifacts. Editor and eligible Location execution use the configured model. Before provider setup, the loader checks source order, unique destinations, captured roles, literal quotations and references within each role's evidence packet. These cases measure review of a fixed proposal and corpus; they do not measure Research or Reader quality.

Pipeline checks use dry-run changes. Match saved Editions by their declared key or year, and new Editions through writer references. A correct value already in the seed does not satisfy a required mutation. Check individual offer or link fields when other fields are outside the case boundary. Direct Location checks distinguish changed coordinates, preserved coordinates, point actions and unresolved questions. Completion and correction require an actual change; preservation requires the saved point and precision to stay unchanged.

Checks of a selected Edition's dates and year can resolve an omitted proposal from that exact saved Edition. An explicit proposal or clear takes precedence. This checks the selected value; it does not prove fresh source verification or satisfy a required mutation. A successful Location `keep` can retain the selected saved venue. Deliberate refusals can retain source summaries for inspection. Check the actual General result inside the provider response wrapper when checking its decision.

## Accept variation through explicit alternatives

Accept source-supported URL, address, classification and price alternatives. URL comparison normalizes the host and default port; a matching host does not make all paths or queries valid. Avoid fuzzy matching for dates, prices and URLs.

Link alternatives are choices. Extra or duplicate official links of a checked kind fail.

Each returned priced ticket offer in main must match an accepted amount and currency pair. Missing offers do not lower completeness. Labels, terms, availability and duplicate offers are normally unchecked. A case can explicitly accept a supported unpriced offer: Wacken accepts Loyalty, Faster and Harder tickets marked sold out with both amount and currency absent. Other unpriced offers still fail its price check. Full-programme base price is a separate additional fact. A case can accept both the displayed price and the total with mandatory fees when both are declared alternatives. Targeted regressions can check labels or availability for their specific task.

Main requires `scheduled` for its dated festival announcements. Ingestion uses `announced` without a complete programme date range and `scheduled` with one, including provisional dates. `dateState` records date certainty separately. Explicit cancellation or postponement takes priority. Saved Edition preservation no longer treats `announced` and `scheduled` as interchangeable.

## Keep the check boundary explicit

We do not require full coverage of additional data. Unlisted new fields are unchecked: they earn no credit and cannot establish that the model was correct. This limit keeps the scorer small; inspect outputs when investigating errors or extending coverage.

For saved Editions, populated fields remain protected unless a case declares a supported change. Empty optional fields without expectations can be filled without credit or failure. For an unclassified saved Edition, a supported subset of the explicitly allowed historical terms is valid; those optional additions do not become a completeness requirement. Required fields, identities, publication and coordinate rules stay protected. Keep stricter case conditions where needed: Glastonbury preserves its saved programme and draft Event; the blocked Afro Nation case preserves its whole Event.

## Use realistic, bounded fixtures

Prefer real pages read through the production reader. Preserve useful navigation, unrelated content and page controls. Keep source statuses (`ok`, `unsupported`, `failed`) and retrieval reasons. Map captured `partial` reads to `ok` with their retrieval reason and captured `blocked` reads to `failed`. Keep captured Markdown unchanged, including text cut by an earlier reader. Do not treat that text as a new projection cut or turn a failed response into a successful page. Replay keeps links in Markdown; it does not build a separate link list.

Main now uses `@mdream/js@2.0.3` output. Roskilde, Wacken, Sziget and Glastonbury History 2025 were captured through the production HTTP reader on 2026-10-30, with rendering disabled. Raw responses and reader results are kept locally in `data/main-fixtures-mdream-20261030/`. The three captured cases use that date as their fixed evaluation date. Their tasks, initial records, geocoding fixtures and scoring rules stay the same. Afro Nation keeps its empty blocked-source fixture.

The other ten Glastonbury pages retain the synthetic scenario below. Their saved scenario bodies were rebuilt as synthetic HTML and passed through the same production reader. The old page-title heading supplies the synthetic head title; region labels supply HTML landmarks. No extra metadata was invented. Their original scenario date stays fixed. Case provenance distinguishes these reconstructed inputs from real captures. Native Markdown line breaks and spacing remain in the saved output.

Refresh Markdown from HTML when the reader format changes. Do not pass captured Markdown back as if it were original HTML. If the original HTML is missing, record a new capture or mark reconstructed input as synthetic. A fixture refresh creates a new dataset revision; old runs do not establish a comparison on the new inputs.

Synthetic pages must state their origin and edits in provenance. When they represent a real site in a different state, retain its structure and normal content. Check body text, links and metadata for facts that contradict the scenario.

Glastonbury models an unannounced next festival, with an unedited official History 2025 capture. Its optional draft 2025 Edition earns additional credit for year, country GB with its historical ticket block preserved. Historical price extraction is outside ingestion scope. Current-or-next offer checks use amount and currency; new replacement offers must have no URL. Neither history page gives programme dates. Capacity 210,000 is not participant attendance and must not become `sizeEstimate`. Other new Editions, invented historical dates, and publication fail the case; the saved 2027 data stays protected.

Cover the assigned research path, not every possible link or query. Main source fixture misses are diagnostics only. Required omissions, wrong checked facts and failed task conditions still fail main. There is no live fallback or invented successful provider result.

In every eval group, an initial or agent geocoding request without a fixture returns `unavailable`. This is a simulated tool failure, not a captured provider response or an empty search result. It does not fail the case by itself; execution and case checks still determine success. Request details remain in observations. Exact recorded requests take priority. Forward replay also matches normalized case, accents, punctuation, word order and country names in English, Spanish, Portuguese, French and German against the same explicit country filter. Other place qualifiers stay in the comparison. Conflicting normalized responses and unknown qualifiers return `unavailable`; reverse coordinates still require an exact match. This does not show how the real provider would answer the query.

Add fixture coverage when it blocks a task we intend to measure. Do not add a response after every exploratory request merely to make diagnostics disappear.

## Isolated Reader cases

`--group regression/reader` runs three full-page inputs already used by the pipeline fixtures: the captured Sziget homepage, the captured Roskilde ticket page and the synthetic Harbor Echo venue confirmation. The existing source text, URLs, date and provenance are reused without copies or edits. The default command still selects five main cases. `--all` now selects 53 cases, including the three Reader cases.

Only Reader calls the configured model. Its production prompt, medium reasoning, page input bound, output allowance and literal binding stay in use. The input contains the normal requested name, fixed date, source metadata and full page. Case expectations never enter the prompt. The result includes the raw execution and accepted evidence; no source fetch, other agent, catalog write or model judge runs.

Requirements live in `src/ingestion/evals/reader/`, one file per page. Each requirement names a recipient and literal source passages that must reach that specialist together in one quotation and its context. Checks use the production `roleEvidenceTopics` routing. A passage can reach a role through any of its accepted topics; one exact topic label is not required. Longer quotations, boundary quotations and a different evidence order are accepted. The checks do not compare the whole JSON or infer final catalog values. Fixture loading rejects expected passages absent from the original source.

The current page URL comes from source metadata. Reader need not extract a link back to that same page. Links to other pages, checkout destinations and social accounts still need retained literal evidence. Roskilde's full-pass requirement accepts its explicit eight-day festival description without also requiring the commercial product name. Price, fee and year must stay together. Harbor Echo checks the venue's January confirmation and the complete rejection of the February headline separately. These are complete claims about one Event on one page, not unrelated facts combined across a packet. Main still checks the final ticket-overview choice and date-conflict result.

The three scores are `scenario-success`, `evidence-recall` (complete requirements divided by declared requirements) and `literal-validity` (accepted quotations divided by returned quotations, zero for an empty output). A scenario passes only when all requirements are available in accepted evidence and structural checks pass. Literal validity is diagnostic: discarding an extra quotation does not fail the scenario if accepted evidence still meets every requirement. A discarded required fact receives no recall credit. The readable fixtures require no model-reported extraction limitations or unsupported nonpublication claims and require nonempty navigation coverage.

Saved output retains all binding limitations. A passing Reader case establishes useful required evidence, not complete production processing. Production still marks a source limited after any binding failure and can report partial research. Full-flow evals check the effect on final quality and task outcomes. Reader does not gain a repair call or relaxed source matching.

CLI output also shows unique source characters covered and extracted characters including repeated context. These are diagnostics, not pass thresholds: copying a whole page is not evidence of efficient extraction. The checks cover only the named passages and metadata conditions. They do not establish exhaustive recall, semantic accuracy of the overview or coverage wording, absence of all irrelevant material, or downstream catalog quality.

## Review failures before changing expectations

Compare the actual value with the supplied source, expected alternatives and tool observations. Classify the cause before editing:

| Cause | Action |
| --- | --- |
| Agent error | Keep the failure; fix the agent or add a focused regression |
| Narrow or incorrect expectation | Correct it from source evidence |
| Missing or contradictory fixture | Fix the declared task inputs and provenance |
| Scorer error | Fix the comparison or condition and review the affected outputs |

Do not weaken a rule only because a model failed it. Do not demand an additional fact that the supplied pages cannot support.

There are no separate eval unit tests, model-substitute eval runs, or eval persistence tests. Run the eval CLI when checking model behavior or changed fixtures. Review its saved outputs.

## Compare models on the same revision

Use the same group, cases, inputs, expectations, scoring rules and repeat count.

Dataset identity uses a coarse hash of all case JSON/MD/TypeScript files, main evaluator/helper sources, the regression registries, fixture loading and execution helpers, and shared mutation, finding, tool-use and scoring helpers, plus group, selected case IDs, repeats and scorer version. Even whitespace or changes to unselected cases can create new datasets. Other scoring changes require an `EVAL_SCORER_VERSION` update.

Existing datasets are reused without content checks or source snapshots. Edit definitions in repository files; manual Studio changes are not detected or imported.

Experiment names identify the branch, group and model. Use `--label before` and `--label after` to compare code changes with the same model. To compare models, keep code and settings fixed. Other labels can describe prompt or limit changes. Git metadata records the commit, branch and dirty flag; it does not save uncommitted file contents. These fields and the model do not change dataset identity. See [Run evals](#run-evals) for naming details.

Compare the share of cases without checked errors, then required completeness, then additional completeness. Use duration and available native usage when quality is close. Keep N/A applicability visible and exclude incomplete runs. Do not use Studio's generic overall average as the model ranking.

Three repetitions per main case are recommended, not a statistical guarantee. Before replacing a model, run the full suite for both candidates and review new regression failures. A rescore of saved output can check a scorer correction, but it does not test model behavior on changed fixtures. Keep original experiment results intact.

Scorer revisions 8 and 9 add source-backed expected alternatives for the Wacken YouTube footer URL with a trailing slash and the Roskilde festival address with its venue label but no country suffix. These are the same factual destinations and address. Do not apply blanket URL or address normalization. Keep original experiment scores and show saved-output rescoring separately.

Scorer revision 7 removes historical price extraction and per-offer URL expectations. Compare common fact units separately from this scope change. At that revision, Editor handoff fixtures contain explicit domain role results while other assigned roles use the configured model. Current Editor fixtures also fix collection and Reader outputs as described above. Gold assertions never enter prompts. Native usage and duration comparisons must include all role calls and report missing coverage as unknown.

Scorer revision 13 moves all regression conditions from JSON to case code. It retains the declared mutation, source-check, tool-use and Location conditions. This changes the dataset revision. On 2026-11-02, local rescoring of one saved response for each of the 45 regression cases produced the same pass/fail decisions before and after migration. Pipeline mutation conditions were also compared separately, so a source-check failure could not hide a changed mutation result. Original experiments were not changed. This does not test current agent behavior or fix source and geocoding fixture gaps.

Scorer revision 14 corrects selected-value and refusal checks after the full regression run. It also corrects the recovered-website Editor case: captured roles have no completion findings, so it checks a completed Editor review and a non-failed workflow rather than requiring complete Research. The required website change remains. All seven Editor cases now use fixed input evidence. Two Location fixtures add explicit synthetic aliases for valid locality and venue queries; city responses do not become venue points. The cemetery correction case adds labelled synthetic evidence that the saved point is wrong. Original experiments remain unchanged.

Scorer revision 15 accepts partial Research with a failed catalog outcome in `current-identity-contradiction`, as selected by the owner. Useful collection can precede an Event identity refusal. No-write, technical-error, source-policy and identity-guidance checks remain. Other refusal cases retain failed Research when they have no usable evidence.

A comparison can span different coarse dataset hashes only after checking that every selected case input and its checks are identical. For example, adding page-coverage fields to unselected fixed Editor inputs changes the coarse hash but does not change main or pipeline case inputs. Record this check with the measurements; do not infer equal inputs from matching case IDs alone.

Scorer revision 16 removes the exact historical Edition key from the unfinished-history question check and requires historical context plus preservation of the saved historical record. Search counts remain case-specific: another targeted search is allowed for an unresolved permitted need within the shared budget, after useful known leads are used. Resolved needs and optional gaps do not authorize more searches. Geocoding replay uses the normalization above, and main requires `scheduled` for dated announcements. Earlier experiment scores stay unchanged.

Scorer revision 20 adds the isolated Reader group and hashes its case requirements and execution helpers. Existing pipeline, Editor and Location checks retain their meaning.

Scorer revision 21 assesses Reader passage groups through their actual recipient's topic routing and removes the redundant Roskilde link back to its source page. It retains literal binding, local year and condition context, and links to other destinations. Existing pipeline, Editor and Location checks stay unchanged.

Scorer revision 22 accepts complete product descriptions and separate complete confirmation and rejection claims. It treats discarded extra quotations as binding diagnostics while requiring every declared fact in accepted literal evidence. Production source statuses and all full-flow checks stay unchanged.

Scorer revision 23 accepts optional historical term subsets and Wacken's three supported sold-out categories without prices. The synthetic size-history page now explicitly states that its past Edition took place; a completed programme alone was ambiguous. These changes require new dataset experiments and do not overwrite earlier results.

Scorer revision 24 records the source-binding update. Identical boundaries, or a complete opening with the closing text as its exact suffix, can identify a full literal quotation. Code can restore an extra newline escape or doubled Markdown-punctuation backslash only when the original has no match and the entire restored text matches the original source exactly once. It does not change prices, years or words, choose the first ambiguous match, or add a model repair call.

Scorer revision 25 lets a case explicitly accept `exact` or `from` for its declared full-programme base amount. Wacken accepts those two kinds at EUR 364 or EUR 366, with unchanged currency, amount and coverage checks. It does not accept ranges, free admission or other amounts. The source price and mandatory fee remain in the offer terms. Original experiments stay unchanged when saved output is rescored.

The isolated saved-precision fixture supplies its locality meaning as explicit synthetic evidence, not only a source overview. The building-complex fixture uses one clear synthetic 2025 venue statement in place of three catalog field projections. Both retain their point and precision checks. Their provenance identifies the synthetic text; captured geocoding responses stay unchanged.

Scorer revision 26 limits `size-evidence` to a non-failed workflow and its strict participant-estimate, admission-count, date and target checks. A separate full-history case still requires complete research, and the unfinished-history case still requires a historical gap. This size-only case does not certify collection completeness. A saved output with correct size results and a false historical collection blocker changes from fail to pass; the blocker stays visible in its original report.
