# Proposal

## Why

Current evals mix representative examples with regressions and score selected mutations. This makes it hard to compare models or distinguish missing useful data from incorrect publication facts.

## What Changes

- Use explicit TypeScript evaluators and shared helpers for five main cases (four captured, one synthetic). Remove Tomorrowland until one festival identity can be tested. Remove the old scorer, gold schema, and gold files.
- Keep the other 45 cases in `regression` with their current check meanings. Keep mutation, tool-use and Location expectations in JSON; define Research conditions in explicit case functions with shared helpers. Use one list of pass/fail checks and one `scenario-success` score, without intermediate percentages or duplicate diagnostics. Report pipeline, editor, and Location results separately. Keep Location completion, correction, and preservation summaries.
- Score main cases after isolated apply. Separate required completeness, additional completeness, checked-data errors, and scenario success.
- Check returned ticket URL, amount, and currency combinations with explicit alternatives. Score base price as one additional fact; offer extraction has no completeness obligation. Missing optional data lowers completeness; wrong optional data fails the scenario.
- Run the five main cases by default; use `--all` for all 50 cases. Save results in Mastra Experiments and compare models in Studio, without an overall score across groups.
- Run main cases through Research, Editor, and Location with fixed geocoding responses. Retain run and available trace IDs for native token and cost inspection; do not rebuild usage totals.
- Apply explicit `--model X` to Research, Editor, and Location in every eval mode. Without this option, retain environment-based model selection.
- Name experiments by branch, group, model and optional `--label`. Save commit and dirty state separately from dataset identity.
- Use a coarse file hash for dataset identity. Reuse saved datasets without content checks or source snapshots; edit definitions in repository files only.
- Document model selection: prioritize factual accuracy, then completeness; use repeated main runs and check all regressions before replacing a model. Limit conclusions to the tested scenarios.
- Keep fill, verify, and correct as distinct cases.
- Remove tests of eval code and their unused helpers from CI. Keep all five main and 45 regression eval cases, fixtures, scoring, and commands.
- **BREAKING**: Replace the main scoring contract. Remove eval JSON report files and the eval `--report` option. Use saved Mastra results and CLI summaries. Keep regression checks as an active test contract, without old report readers.

Production ingestion and publication rules stay unchanged. Complex ticket matching, offline rescoring, custom comparison commands, and launching evals from Studio are deferred. Live evals, LLM judges, automatic URL discovery, a general assertion language, significance analysis, and custom handling of experiment storage failures are outside this change.

## Capabilities

### New Capabilities

- `operations/ingestion-evaluation`: Separate quality and regression experiments with stored results for model comparison.

### Modified Capabilities

- `operations/ingestion-diagnostics`:
  - **Before**: Eval artifacts retain workflow or Location output and are written before failure exit.
  - **After**: Mastra stores that evidence without a separate eval file. Location checks and subgroup results remain; experiment storage failures use native Mastra behavior.

## Impact

Changes affect `src/ingestion/evals/`, `commands/catalog-eval.ts`, Studio storage wiring, and eval documentation. Add a compatible `@mastra/libsql` dependency for local datasets, experiments, and scores. Existing catalog readers, validators, and writers remain in use; the catalog schema does not change.

See [design](design.md) for boundaries and [tasks](tasks.md) for delivery. Old reports are not comparable with the new main scores.
