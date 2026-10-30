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

`pnpm run catalog:eval --help` lists options. The default runs five main cases once. Main applies the normal Research → Editor → Location → writer flow in a fresh in-memory catalog. Workflow regressions use dry runs; isolated Location cases use complete inputs without a catalog or writer. The owner's catalog stays untouched. Pages, searches, date, taxonomy, and geocoding come from fixed fixtures. Only model calls use the network and can incur charges. CI does not run evals or tests of the eval code, and application coverage excludes eval code and its CLI. Run evals through the CLI when needed.

```sh
pnpm run catalog:eval
pnpm run catalog:eval --all
pnpm run catalog:eval --group regression/pipeline
pnpm run catalog:eval --editor-only
pnpm run catalog:eval --location-only
pnpm run catalog:eval --case sziget --repeat 3 --model openai/gpt-6-luna
pnpm run catalog:eval --label before
pnpm run catalog:eval --label after
```

Cases form four separate experiment groups. Use CLI help for the current selection:

| Group | Purpose |
| --- | --- |
| `main/pipeline` | Catalog quality and scenario success |
| `regression/pipeline` | Targeted workflow behavior |
| `regression/editor` | Captured Editor handoffs and eligible Location |
| `regression/location` | Direct Location execution |

Use repeated `--group GROUP` or `--case ID` flags for a selection. A case selection without a mode flag can span groups. Use one of `--all`, `--group`, `--editor-only`, or `--location-only`; an incompatible case selection fails before provider setup. `--repeat N` accepts 1–20 and applies equally to all selected cases. Location retains separate completion, correction, and preservation summaries. Its positive cases require the declared changes; keep-only output cannot pass them. The provider adapter tests cover raw Geoapify parsing; eval fixtures cover normalized client responses.

### Model settings

`--model X` selects X for all three agents, including direct Location, and overrides `CATALOG_LOCATION_MODEL`. Without it, Research and Editor use `OPENROUTER_MODEL` or the default; Location uses `CATALOG_LOCATION_MODEL` or falls back to the same model. Experiments save resolved stage models, prompt versions, workflow revision, reasoning effort, service tier, and limits. Injected handoffs do not claim Research usage.

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

Known issue: [intermittent `SQLITE_BUSY_SNAPSHOT` failures](known-issues/2026-10-27-mastra-sqlite-busy-snapshot.md) can leave saved scores incomplete or fail an experiment update.

## Separate case purpose from source origin

Main cases measure the final catalog after the full Research → Editor → Location → writer flow. Each attempt starts from a fresh disposable catalog. Regression cases check a specific behavior through the pipeline, an Editor handoff, or direct Location execution. Keep their results separate; do not combine them into one quality average.

Source origin is a different property. Both main and regression cases can use captured or synthetic sources. Fill, verify and correct are separate tasks, even when they use the same pages. A blocked-source case can pass by returning the expected failure and preserving the catalog.

Add a case for a distinct task or an observed failure. Reuse pages when useful, but avoid cases that repeat the same input and checks without adding coverage. Use the CLI group selection to see the current cases.

## Define what the sources can support

Each case needs a clear task, initial catalog, fixed date, source origin and provenance. Supply the page, search and geocoding responses needed for that task. Keep evaluator expectations out of model input.

Define expected facts from the supplied evidence, independently of a model answer or production validation. A structurally valid date can still be false. Check Event and Edition identity, the programme year, venue versus office addresses, and admission products versus unrelated purchases.

Use explicit TypeScript main evaluators with shared helpers. Keep expected alternatives and source comments close to the checks. Do not add a general rule engine or require a policy for every possible field.

Case inputs and source files live in [`src/ingestion/evals/cases/`](../src/ingestion/evals/cases/). Main checks live in [`src/ingestion/evals/main/`](../src/ingestion/evals/main/). Regression Research checks live in adjacent `checks.ts` files under `cases/`; [`case-research.ts`](../src/ingestion/evals/case-research.ts) registers them. Register a new case in the suite manifest and its evaluator registry.

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

Regressions use the same pass/fail check format as main conditions. They expose one `scenario-success`: all checks must pass. Their saved output contains `checks` and `passed`, without intermediate percentages or separate diagnostic categories. The CLI and Mastra reason show failed-check messages. Keep mutation, tool-use and Location expectations in JSON. Define Research statuses, returned facts, omitted fields and deliberate refusals in each case function, using small helpers from `research.ts`. There is no `expectations.research` schema or shared interpreter. Keep dry-run change checks, partial-object and collection matching, and Location preservation rules. A correct value already in the seed does not satisfy a required mutation.

## Accept variation through explicit alternatives

Accept source-supported URL, address, classification and price alternatives. URL comparison normalizes the host and default port; a matching host does not make all paths or queries valid. Avoid fuzzy matching for dates, prices and URLs.

Link alternatives are choices. Extra or duplicate official links of a checked kind fail.

Each returned ticket offer must match an accepted product URL, amount and currency combination. Missing offers do not lower completeness. Labels, terms, availability and duplicate offers are unchecked. Full-programme base price is a separate additional fact. A case can accept both the displayed price and the total with mandatory fees when both are declared alternatives.

Main currently accepts both `announced` and `scheduled`, including saved Edition preservation. TODO: define deterministic agent behavior and narrow this exception. `cancelled` and `postponed` remain distinct.

## Keep the check boundary explicit

We do not require full coverage of additional data. Unlisted new fields are unchecked: they earn no credit and cannot establish that the model was correct. This limit keeps the scorer small; inspect outputs when investigating errors or extending coverage.

For saved Editions, populated fields remain protected unless a case declares a supported change. Empty optional fields without expectations can be filled without credit or failure. Required fields, identities, publication and coordinate rules stay protected. Keep stricter case conditions where needed: Glastonbury preserves its saved programme and draft Event; the blocked Afro Nation case preserves its whole Event.

## Use realistic, bounded fixtures

Prefer real pages read through the production reader. Preserve useful navigation, unrelated content and page controls. Keep source statuses (`ok`, `unsupported`, `failed`) and retrieval reasons. Map captured `partial` reads to `ok` with their retrieval reason and captured `blocked` reads to `failed`. Keep captured Markdown unchanged, including text cut by an earlier reader. Do not treat that text as a new projection cut or turn a failed response into a successful page. Replay keeps links in Markdown; it does not build a separate link list.

Synthetic pages must state their origin and edits in provenance. When they represent a real site in a different state, retain its structure and normal content. Check body text, links and metadata for facts that contradict the scenario.

Glastonbury models an unannounced next festival, with an unedited official History 2025 capture. Its optional draft 2025 Edition earns additional credit for year, country GB and the GBP 378.50 base price. Returned offer prices must match that amount and currency. This historical case does not check offer URLs because the page provides no admission product URL; other main ticket checks still require URL, amount and currency. Neither history page gives programme dates. Capacity 210,000 is not participant attendance and must not become `sizeEstimate`. Other new Editions, invented historical dates, and publication fail the case; the saved 2027 data stays protected.

Cover the assigned research path, not every possible link or query. Main source fixture misses are diagnostics only. Required omissions, wrong checked facts and failed task conditions still fail main. There is no live fallback or invented successful provider result.

In every eval group, an initial or agent geocoding request without a fixture returns `unavailable`. This is a simulated tool failure, not a captured provider response or an empty search result. It does not fail the case by itself; execution and case checks still determine success. Request details remain in observations. This does not show how the real provider would answer the query.

Add fixture coverage when it blocks a task we intend to measure. Do not add a response after every exploratory request merely to make diagnostics disappear.

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

Dataset identity uses a coarse hash of all case JSON/MD/TypeScript files, main evaluator/helper sources, `case-research.ts` and `research.ts`, plus group, selected case IDs, repeats and scorer version. Even whitespace or changes to unselected cases can create new datasets. Other scoring changes require an `EVAL_SCORER_VERSION` update.

Existing datasets are reused without content checks or source snapshots. Edit definitions in repository files; manual Studio changes are not detected or imported.

Experiment names identify the branch, group and model. Use `--label before` and `--label after` to compare code changes with the same model. To compare models, keep code and settings fixed. Other labels can describe prompt or limit changes. Git metadata records the commit, branch and dirty flag; it does not save uncommitted file contents. These fields and the model do not change dataset identity. See [Run evals](#run-evals) for naming details.

Compare the share of cases without checked errors, then required completeness, then additional completeness. Use duration and available native usage when quality is close. Keep N/A applicability visible and exclude incomplete runs. Do not use Studio's generic overall average as the model ranking.

Three repetitions per main case are recommended, not a statistical guarantee. Before replacing a model, run the full suite for both candidates and review new regression failures. A rescore of saved output can check a scorer correction, but it does not test model behavior on changed fixtures. Keep original experiment results intact.
