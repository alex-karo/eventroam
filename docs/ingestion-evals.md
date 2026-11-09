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

`pnpm run catalog:eval --help` lists options. The default runs five main cases once. Main runs the complete ingestion flow in a fresh in-memory catalog. Workflow regressions use dry runs. Isolated Location, Reader, and Classification cases use fixed inputs. Pages, searches, date, taxonomy, and geocoding come from fixed fixtures. Only model calls use the network and can incur charges. Run the model-backed cases through the CLI. CI runs automated tests and excludes eval sources and the eval CLI from application coverage.

Set `OPENROUTER_API_KEY` for the default agent model. The Classification group and `--all` also need this key for the separate description scorer, even when another provider runs the agents. With another agent provider, main runs can use the key to include description format scores.

If the eval records logs or traces, check the [DuckDB prerequisites](#usage-and-storage-failures) before you run it.

```sh
pnpm run catalog:eval
pnpm run catalog:eval --all
pnpm run catalog:eval --group regression/pipeline
pnpm run catalog:eval --case wacken-add
pnpm run catalog:eval --editor-only
pnpm run catalog:eval --location-only
pnpm run catalog:eval --group regression/reader
pnpm run catalog:eval --group regression/classification
pnpm run catalog:eval --case sziget --repeat 3 --model openai/gpt-6-luna
pnpm run catalog:eval --label before
pnpm run catalog:eval --label after
```

Cases form six separate experiment groups. Use CLI help for the current selection:

| Group | Purpose |
| --- | --- |
| `main/pipeline` | Catalog quality and scenario success |
| `regression/pipeline` | Targeted workflow behavior |
| `regression/editor` | Captured Editor handoffs and eligible Location |
| `regression/location` | Direct Location execution |
| `regression/reader` | Full-page extraction, literal binding and evidence context |
| `regression/classification` | Direct Edition classification and both festival descriptions |

Use repeated `--group GROUP` or `--case ID` flags for a selection. A case selection without a mode flag can span groups. Use one of `--all`, `--group`, `--editor-only`, or `--location-only`; an incompatible case selection fails before provider setup. `--repeat N` accepts 1–20 and applies equally to all selected cases. Location retains separate completion, correction, and preservation summaries. Its positive cases require the declared changes; keep-only output cannot pass them. The provider adapter tests cover raw Geoapify parsing; eval fixtures cover normalized client responses.

### Model settings

`--model X` selects X for all eight agents, including direct Location, and overrides `CATALOG_LOCATION_MODEL`. Without it, Research and Editor use `OPENROUTER_MODEL` or the default; Location uses `CATALOG_LOCATION_MODEL` or falls back to the same model. Experiments save resolved stage models, prompt versions, workflow revision, reasoning effort, service tier, and limits. Reader uses medium reasoning effort for literal extraction. Tickets, Classification and Links use the configured effort. Research, General, Editor and Location use medium when the configured effort is low; other explicit settings stay unchanged. Native call logs retain the effective settings. Injected handoffs do not claim Research usage.

To run all selected agents through OpenCode Go, set `OPENCODE_GO_KEY` and use
`--model opencode-go/gpt-6-luna`. For example:

```sh
pnpm run catalog:eval --case reader-date-correction --model opencode-go/gpt-6-luna
```

This Reader case uses the Go key for all model calls. For other cases, check whether the selection also uses the OpenRouter description scorer. The model flag overrides the Location model. Searches and page reads use the eval fixtures.

### Results and failures

Results are saved as Mastra datasets, experiments, and scores. The eval command writes no separate JSON report. Each workflow result contains one current ingestion report in `output.report`; main also retains `before`, `after`, and `quality`. Direct Location retains its actual execution, observations, run ID, and available trace ID without a fabricated workflow report. A returned failure report is scored against the case.

Unexpected task errors have null output and a bounded diagnostic; scorer errors remain distinct from intentional N/A. Other cases and groups continue.

Failed scenarios, task/scorer errors, or missing required scores cause exit code 1. Mastra task completion counts are not quality pass counts.

### Experiment names

Experiment names use `<branch> · <group> · <model>` and append `--label` when supplied. For example, `feature/location · main/pipeline · openai/gpt-6-luna · before`. The isolated Location group uses its resolved model. Detached HEAD uses the first eight commit characters instead of a branch. Each experiment saves the full commit, branch, dirty flag and label in metadata. The dirty flag includes tracked and untracked files. It does not save their contents. Names can repeat; IDs stay unique. Branch, commit, dirty state, label and model do not change dataset identity.

The CLI shows counts, metrics, N/A applicability, failed checks, experiment IDs, and duration. For each main pipeline result, it also shows the proposal, Editor decision, any rejection reason, and catalog result for each festival description.

Main eval sends the stored texts and a fixed case reference for the current festival format to PPLX Decider in one request. It saves the model ID and the probability of a match for each text in `output.descriptionFormat`. The CLI shows each probability beside the Editor decision. Each numeric result counts as one required fact. A result of 80% or higher satisfies the fact. A result below 80% counts as missing and fails the case without adding a factual error.

Empty texts are `missing`. Cases without a reference are `not_applicable`. If the OpenRouter key is absent or the request fails, the affected decisions are `unavailable`. These statuses do not contribute to required completeness. Use the [score definitions](#keep-completeness-and-errors-separate) to interpret the scores.

Edit cases and checks in the [source locations below](#define-what-the-sources-can-support). Review source identity, Edition identity, venue versus office addresses, and ticket links versus signup forms when refreshing captures. Follow the [revision rules](#compare-models-on-the-same-revision) before comparing results.

### Inspect and compare in Studio

Start `pnpm run catalog:studio`, open `http://127.0.0.1:4111`, and choose **Experiments**. Open an experiment to inspect item outputs and per-scorer values. Select **Compare**, choose two runs of the same group and dataset revision, then select **Compare Experiments**. Stable item IDs align repetitions. Run new experiments from the CLI; the Studio inline target is not an executable eval entry point. Use each dimension, not Studio's generic overall average. N/A appears as a dash; inspect saved quality counts or the CLI summary for applicability. Do not rank failed or incomplete runs by partial means. Changed cases, inputs, expectations, scorer rules, or repeat counts require fresh runs for both models.

### Usage and storage failures

Duration is separate from quality. Set `CATALOG_TRACING=true` to collect native tokens and cost. Eval traces and metrics carry the experiment ID, and saved result rows link to their real trace. Concurrent cases share one DuckDB store for the full CLI run; the CLI closes it after all cases finish. Studio shows the native Tokens/Cost summary when metrics are available; evals add no usage totals or metric queries.

If logging or tracing is enabled and the CLI uses Studio's DuckDB file, close Studio before the eval run. Reopen it after the CLI finishes. To inspect the diagnostics, point Studio's `CATALOG_OBSERVABILITY_DATABASE_PATH` at the file used by the CLI. See [execution metrics](ingestion-process.md#execution-metrics) for how to read the data. Missing metrics are unknown.

Experiment storage write failures retain Mastra's native errors or warnings; no custom retry, recovery, post-run storage check, or JSON fallback is added. For this exceptional case, scores can be incomplete and the exit code might not indicate failure.

## Local eval storage

Mastra datasets, experiment results, and scores use `CATALOG_EVAL_DATABASE_PATH`, which defaults to `data/mastra-evals.sqlite`. This file is separate from the catalog and DuckDB observability. Relative paths resolve from the project root. `pnpm run catalog:studio` passes the same absolute path to Studio; set it explicitly for `studio:start` if you use a custom path. Studio can inspect saved datasets and experiments without model credentials. Keep eval execution in the CLI.

The [archived `SQLITE_BUSY_SNAPSHOT` issue](archive/known-issues/2026-10-27-mastra-sqlite-busy-snapshot.md) records earlier incomplete score writes and experiment update failures. Use its storage diagnostics when an experiment has incomplete scores.

## Separate case purpose from source origin

Main cases measure the final catalog after the full Research → General → specialists, including Location → Editor → writer flow. Each attempt starts from a fresh disposable catalog. Regression cases check a specific behavior through the pipeline, an Editor handoff, or direct Location, Reader, or Classification execution. Keep their results separate; do not combine them into one quality average.

Source origin is a different property. Both main and regression cases can use captured or synthetic sources. Fill, verify and correct are separate tasks, even when they use the same pages. A blocked-source case can pass by returning the expected failure and preserving the catalog.

Add a case for a distinct task or an observed failure. Reuse pages when useful, but avoid cases that repeat the same input and checks without adding coverage. Use the CLI group selection to see the current cases.

## Define what the sources can support

Each case needs a clear task, fixed date, source origin and provenance. Workflow cases also need an initial catalog. Supply the page, search and geocoding responses needed for the task. Keep evaluator expectations out of model input.

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

Editor handoff fixtures use schema version 5. Each fixture fixes the ordered page reads, Reader outputs, collection result and proposals from General, Tickets, Classification and Links. Normal collection still binds literal quotations and saves source artifacts. Editor and eligible Location execution use the configured model. Editor returns decisions by path. A group can return only when its owner has a live conversation. The scorer fails an unexpected return during a fixed handoff. Controlled workflow tests cover native specialist continuation and malformed first replies. Before provider setup, the loader checks source order, unique destinations, captured roles, literal quotations and references within each role's evidence packet.

Pipeline checks use dry-run changes. Match saved Editions by their declared key or year, and new Editions through writer references. A correct value already in the seed does not satisfy a required mutation. Check individual offer or link fields when other fields are outside the case boundary. Direct Location checks distinguish changed coordinates, preserved coordinates, point actions and unresolved questions. Completion and correction require an actual change; preservation requires the saved point and precision to stay unchanged.

Checks of a selected Edition's dates and year can resolve an omitted proposal from that exact saved Edition. An explicit proposal or clear takes precedence. This checks the selected value; it does not prove fresh source verification or satisfy a required mutation. A successful Location `keep` can retain the selected saved venue. Deliberate refusals can retain source summaries for inspection. Check the actual General result inside the provider response wrapper when checking its decision.

## Accept variation through explicit alternatives

Accept source-supported URL, address, classification and price alternatives. URL comparison normalizes the host and default port; a matching host does not make all paths or queries valid. Avoid fuzzy matching for dates, prices and URLs.

Link alternatives are choices. Extra or duplicate official links of a checked kind fail.

Each returned priced ticket offer in main must match a declared amount and currency pair. Missing offers do not lower completeness. Labels, terms, availability and duplicate offers are normally unchecked. A case can explicitly accept an unpriced offer with source-supported availability; otherwise an offer without a price fails its price check. Full-programme base price is a separate additional fact. A case can declare supported alternatives for its price kind and amount, including a displayed price and a total with mandatory admission fees. Keep exact values and case-specific conditions in the [main evaluators](../src/ingestion/evals/main/). Targeted regressions can check labels or availability for their specific task.

Main requires `scheduled` for its dated festival announcements. Ingestion uses `announced` without a complete programme date range and `scheduled` with one, including provisional dates. `dateState` records date certainty separately. Explicit cancellation or postponement takes priority. Saved Edition preservation no longer treats `announced` and `scheduled` as interchangeable.

## Keep the check boundary explicit

We do not require full coverage of additional data. Unlisted new fields are unchecked: they earn no credit and cannot establish that the model was correct. This limit keeps the scorer small; inspect outputs when investigating errors or extending coverage.

For saved Editions, populated fields remain protected unless a case declares a supported change. Empty optional fields without expectations can be filled without credit or failure. For an unclassified saved Edition, a supported subset of the explicitly allowed historical terms is valid; those optional additions do not become a completeness requirement. Required fields, identities, publication and coordinate rules stay protected. Keep stricter case conditions where needed: Glastonbury preserves its saved programme and draft Event; the blocked Afro Nation case preserves its whole Event.

A useful collection can have partial Research and a failed catalog outcome after General refuses Event identity. Keep the no-write, source-policy and identity-guidance checks. A size-only case does not certify collection completeness. Historical-gap checks need historical context and preservation of the unchecked record, not an exact Edition key.

## Use realistic, bounded fixtures

Prefer real pages read through the production reader. Preserve useful navigation, unrelated content and page controls. Keep source statuses (`ok`, `unsupported`, `failed`) and retrieval reasons. Map captured `partial` reads to `ok` with their retrieval reason and captured `blocked` reads to `failed`. Keep captured Markdown unchanged, including text cut by an earlier reader. Do not treat that text as a new projection cut or turn a failed response into a successful page. Replay keeps links in Markdown; it does not build a separate link list.

Use the provenance in each [case definition](../src/ingestion/evals/cases/) for capture dates, converter versions, raw input paths, and synthetic inputs. Glastonbury combines a real history page with reconstructed scenario pages. Sziget adds a synthetic search result for a captured travel page.

Refresh Markdown from HTML when the reader format changes. Do not pass captured Markdown back as if it were original HTML. If the original HTML is missing, record a new capture or mark reconstructed input as synthetic. A fixture refresh creates a new dataset revision; old runs do not establish a comparison on the new inputs.

Synthetic pages must state their origin and edits in provenance. When they represent a real site in a different state, retain its structure and normal content. Check body text, links and metadata for facts that contradict the scenario.

Glastonbury models an unannounced next festival, with an unedited official History 2025 capture. Its optional draft 2025 Edition earns additional credit for year, country GB with its historical ticket block preserved. Historical price extraction is outside ingestion scope. Current-or-next offer checks use amount and currency; new replacement offers must have no URL. Neither history page gives programme dates. Capacity 210,000 is not participant attendance and must not become `sizeEstimate`. Other new Editions, invented historical dates, and publication fail the case; the saved 2027 data stays protected.

Cover the assigned research path, not every possible link or query. Main source fixture misses are diagnostics only. Required omissions, wrong checked facts and failed task conditions still fail main. There is no live fallback or invented successful provider result.

In every eval group, an initial or agent geocoding request without a fixture returns `unavailable`. This is a simulated tool failure, not a captured provider response or an empty search result. It does not fail the case by itself; execution and case checks still determine success. Request details remain in observations. Exact recorded requests take priority. Forward replay also matches normalized case, accents, punctuation, word order and country names in English, Spanish, Portuguese, French and German against the same explicit country filter. Other place qualifiers stay in the comparison. Conflicting normalized responses and unknown qualifiers return `unavailable`; reverse coordinates still require an exact match. This does not show how the real provider would answer the query.

Add fixture coverage when it blocks a task we intend to measure. Do not add a response after every exploratory request merely to make diagnostics disappear.

## Add from free text

`--case wacken-add` runs the complete add flow as a dry run in `regression/pipeline`. It reuses the Wacken pages, geocoding responses and fixed date without copies or edits. Its synthetic multiline note includes a name, website, incorrect dates and an unconfirmed map pin in Hamburg. It does not name a country. An unrelated control Event is the only initial record; Wacken must be created as a new Event.

The case checks writer changes and references for the new Event and its 2027 Edition. It requires source dates, country `DE`, the confirmed Wacken locality point with `locality` precision, rejection of the note's pin and preservation of the control Event. These checks cover add with a confirmed city fallback. They do not cover pin-only input, duplicate detection, batch tools or the Studio conversation.

## Isolated Reader cases

`--group regression/reader` runs three full-page inputs already used by the pipeline fixtures: the captured Sziget homepage, the captured Roskilde ticket page and the synthetic Harbor Echo venue confirmation. The existing source text, URLs, date and provenance are reused without copies or edits.

Only Reader calls the configured model. Its production prompt, medium reasoning, page input bound, output allowance and literal binding stay in use. The input contains the normal requested name, fixed date, source metadata and full page. Case expectations never enter the prompt. The result includes the raw execution and accepted evidence; no source fetch, other agent, catalog write or model judge runs.

Requirements live in `src/ingestion/evals/reader/`, one file per page. Each requirement names a recipient and literal source passages that must reach that specialist together in one quotation and its context. Checks use the production `roleEvidenceTopics` routing. A passage can reach a role through any of its accepted topics; one exact topic label is not required. Longer quotations, boundary quotations and a different evidence order are accepted. The checks do not compare the whole JSON or infer final catalog values. Fixture loading rejects expected passages absent from the original source.

The current page URL comes from source metadata. Reader need not extract a link back to that same page. Links to other pages, checkout destinations and social accounts still need retained literal evidence. Roskilde's full-pass requirement accepts its explicit eight-day festival description without also requiring the commercial product name. Price, fee and year must stay together. Harbor Echo checks the venue's January confirmation and the complete rejection of the February headline separately. These are complete claims about one Event on one page, not unrelated facts combined across a packet. Main still checks the final ticket-overview choice and date-conflict result.

The three scores are `scenario-success`, `evidence-recall` (complete requirements divided by declared requirements) and `literal-validity` (accepted quotations divided by returned quotations, zero for an empty output). A scenario passes only when all requirements are available in accepted evidence and structural checks pass. Literal validity is diagnostic: discarding an extra quotation does not fail the scenario if accepted evidence still meets every requirement. A discarded required fact receives no recall credit. The readable fixtures require no model-reported extraction limitations or unsupported nonpublication claims and require nonempty navigation coverage.

Saved output retains all binding limitations. A passing Reader case establishes that the required evidence is available. Production marks a source limited after a binding failure and can report partial research. Full-flow evals check the effect on final quality and task outcomes. The isolated cases use the production schema correction and Reader call allowance. Identical boundaries, or a complete opening with its exact closing suffix, can identify a full quotation. Extra wire escapes can be restored only when the supplied text has no match and the complete restored text matches the source exactly once. Code discards untagged quotations, changed facts, ambiguous matches, and invalid ranges.

CLI output also shows unique source characters covered and extracted characters including repeated context. These are diagnostics, not pass thresholds: copying a whole page is not evidence of efficient extraction. The checks cover only the named passages and metadata conditions. They do not establish exhaustive recall, semantic accuracy of the overview or coverage wording, absence of all irrelevant material, or downstream catalog quality.

## Isolated Classification cases

Set `OPENROUTER_API_KEY` for the separate description format scorer. Then run `pnpm run catalog:eval --group regression/classification`. The case uses fixed Edition targets, bound evidence, saved context, and vocabulary. It reuses the River Festival announcement from `narrow-current-changed`, uses full scope, and seeds both descriptions with the former format.

To run Classification through OpenCode Go, also set `OPENCODE_GO_KEY` and add `--model opencode-go/gpt-6-luna` to the command.

The case requires the expected category IDs in any order without extra or duplicate IDs. Both replacement texts must omit the festival name. The detailed text must have three to five sentences and the short text one or two. Each must score at least 80% against the current format in PPLX Decider. A missing text or unavailable decision fails this case. The CLI prints the categories and both results. The experiment stores the Classification execution and checks. Research, Reader, Editor, and the catalog writer do not run.

## Review failures before changing expectations

Compare the actual value with the supplied source, expected alternatives and tool observations. Classify the cause before editing:

| Cause | Action |
| --- | --- |
| Agent error | Keep the failure; fix the agent or add a focused regression |
| Narrow or incorrect expectation | Correct it from source evidence |
| Missing or contradictory fixture | Fix the declared task inputs and provenance |
| Scorer error | Fix the comparison or condition and review the affected outputs |

Do not weaken a rule only because a model failed it. Do not demand an additional fact that the supplied pages cannot support.

Run the eval CLI when checking model behavior or changed fixtures. Review its saved outputs.

## Compare models on the same revision

Use the same group, cases, inputs, expectations, scoring rules and repeat count.

Dataset identity uses a coarse hash of all case JSON/MD/TypeScript files, main evaluator/helper sources, the regression registries, fixture loading and execution helpers, and shared mutation, finding, tool-use and scoring helpers, plus group, selected case IDs, repeats and scorer version. Even whitespace or changes to unselected cases can create new datasets. Other scoring changes require an `EVAL_SCORER_VERSION` update.

Existing datasets are reused without content checks or source snapshots. Edit definitions in repository files; manual Studio changes are not detected or imported.

Experiment names identify the branch, group and model. Use `--label before` and `--label after` to compare code changes with the same model. To compare models, keep code and settings fixed. Other labels can describe prompt or limit changes. Git metadata records the commit, branch and dirty flag; it does not save uncommitted file contents. These fields and the model do not change dataset identity. See [Run evals](#run-evals) for naming details.

Compare the share of cases without checked errors, then required completeness, then additional completeness. Use duration and available native usage when quality is close. Keep N/A applicability visible and exclude incomplete runs. Do not use Studio's generic overall average as the model ranking.

Three repetitions per main case are recommended, not a statistical guarantee. Before replacing a model, run the full suite for both candidates and review new regression failures. A rescore of saved output can check a scorer correction, but it does not test model behavior on changed fixtures. Keep original experiment results intact.

A comparison can span different coarse dataset hashes only after checking that every selected case input and its checks are identical. Record this check with the experiment; matching case IDs alone do not prove equal inputs. Native usage comparisons must include all executed roles and treat missing metrics as unknown.
