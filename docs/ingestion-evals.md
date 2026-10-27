---
type: Guide
title: Ingestion evals
description: The approach, scoring rules, and requirements for ingestion evaluation cases.
status: stable
tags: [catalog, ingestion, evals]
---

# Ingestion evals

Evals measure catalog quality and protect specific workflow behavior. They use fixed inputs so that model comparisons can separate model changes from changes to source websites. This guide explains how to design and maintain cases. See the [development guide](development.md#catalog-evals) for commands, model settings, storage and Studio, and the [evaluation spec](../openspec/specs/operations/ingestion-evaluation/spec.md) for the current contract.

## Separate case purpose from source origin

Main cases measure the final catalog after the full Research → Editor → Location → writer flow. Each attempt starts from a fresh disposable catalog. Regression cases check a specific behavior through the pipeline, an Editor handoff, or direct Location execution. Keep their results separate; do not combine them into one quality average.

Source origin is a different property. Both main and regression cases can use captured or synthetic sources. Fill, verify and correct are separate tasks, even when they use the same pages. A blocked-source case can pass by returning the expected failure and preserving the catalog.

Add a case for a distinct task or an observed failure. Reuse pages when useful, but avoid cases that repeat the same input and checks without adding coverage. The current suite has five main cases and 45 regression cases.

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

Prefer real pages read through the production reader. Preserve useful navigation, unrelated content and page controls. Keep actual partial, truncated, unsupported and failed outcomes; do not turn a failed response into a successful page.

Synthetic pages must state their origin and edits in provenance. When they represent a real site in a different state, retain its structure and normal content. Check body text, links and metadata for facts that contradict the scenario. Glastonbury models an unannounced next festival; its archive years remain navigation only, without readable historical programme pages.

Cover the assigned research path, not every possible link or query. Main source and geocoding fixture misses are diagnostics only. Required omissions, wrong checked facts and failed task conditions still fail main. Regression fixture-miss rules stay strict. There is no live fallback, wildcard response or invented provider result. An explicit provider no-match is different from a missing fixture.

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

There are no separate eval unit tests, model-substitute eval runs, or eval persistence tests. CI does not run evals, and application coverage excludes the eval code and CLI. Run the eval CLI when checking model behavior or changed fixtures and review its saved outputs. The five main cases and all 45 regression cases remain available.

## Compare models on the same revision

Use the same group, cases, inputs, expectations, scoring rules and repeat count. Dataset identity uses a coarse hash of all case JSON/MD/TypeScript files, main evaluator/helper sources, `case-research.ts` and `research.ts`, plus group, selected case IDs, repeats and scorer version. Even whitespace or changes to unselected cases can create new datasets. Other scoring changes require an `EVAL_SCORER_VERSION` update. Existing datasets are reused without content checks or source snapshots. Edit definitions in repository files; manual Studio changes are not detected or imported.

Experiment names identify the branch, group and model. Use `--label before` and `--label after` to compare code changes with the same model. To compare models, keep code and settings fixed. Other labels can describe prompt or limit changes. Git metadata records the commit, branch and dirty flag; it does not save uncommitted file contents. These fields and the model do not change dataset identity. See the [CLI guide](development.md#catalog-evals) for naming details.

Compare the share of cases without checked errors, then required completeness, then additional completeness. Use duration and available native usage when quality is close. Keep N/A applicability visible and exclude incomplete runs. Do not use Studio's generic overall average as the model ranking.

Three repetitions per main case are recommended, not a statistical guarantee. Before replacing a model, run the full suite for both candidates and review new regression failures. A rescore of saved output can check a scorer correction, but it does not test model behavior on changed fixtures. Keep original experiment results intact.
