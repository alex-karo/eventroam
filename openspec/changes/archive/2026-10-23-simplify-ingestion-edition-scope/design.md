# Design

## Change size

Medium. Research, editor output, preparation, and report readers change together.
The database schema and dependencies stay the same.

## Approach

1. Research selects Editions from inspected evidence.
2. The editor accepts, corrects, or declines each selected Edition.
3. Preparation checks targets and fields, normalizes classification, and builds catalog operations.
4. The existing writer validates and applies the item atomically.

| Mode           | Assignment                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `add` / `full` | Event summary and shared links, latest completed Edition, ongoing or nearest announced future Edition |
| `current`      | Ongoing or nearest announced future Edition only                                                      |

Other saved Editions remain context for matching, country checks, and classification reuse.
Duplicate add still skips editing and writes.

## Contracts

Replace model result arrays with two required nullable fields:

```ts
type EditionSlots<T> = {
  previousEdition: T | null;
  currentOrNextEdition: T | null;
};
```

Research slots contain keyed findings. Editor slots contain keyed field actions.
Saved context and catalog operations can remain arrays.

- Current always returns `previousEdition:null`.
- An editor slot must be null or match the key in the same research slot, including keep-only actions.
- The same key cannot occupy both roles.
- A null research slot means absent or unresolved. Existing status and questions distinguish these cases.
- A null editor slot preserves that Edition and skips its publication evaluation.
- Field omission and field `value:null` keep their existing meanings.

Provider adapters must preserve required null slots and reject missing slots or old arrays.
For rejected editor output, remove empty transport placeholders before local validation; retain only status and reason.

## Implementation

### Selection and scope

Export the shared Edition finding schema from `research/contracts.ts` for the editor and both provider adapters.
Research and editor use the same frozen `currentDate`, saved time zones, and UTC fallback.
Research owns temporal selection; the host checks structure, targets, and countries.

Previous means the latest actually completed Edition. Uncertain selection stays null with a question.
For several programme periods of one realization, research and editor instructions require one key, the first start date, and the last end date.
Existing inclusive date behavior applies throughout that range.

Remove obsolete count guards from `workflow.ts`, `research/guards.ts`, and `editor/prepare.ts`.
The two slots define the result size and permit two creations.
Keep budget limits, all saved country checks, field support, and existing publication rules.

### Classification

After resolving accept/set actions, `editor/prepare.ts` reads taxonomy ancestry through the catalog layer.
Validate unknown IDs, duplicates, and facet counts before removing selected ancestors with selected descendants.
Reuse `validateTermAssignments` for facet limits. A small helper follows `parentId` links to remove selected ancestors.
Keep siblings and broad-only terms. Keep/omitted classification stays unchanged.
The writer retains its direct-write validation.

Explain normalization through existing changed-field reasons, including previews.
Preserve raw model responses. A normalized no-op creates no synthetic change or extra report field.

### Instructions

Build research instructions for add, full, and current from one shared Edition-selection text block and a block for each mode.
The shared block covers the reference date, role selection, saved keys, completion evidence, and uncertainty.
Each mode's block defines its field checks and duplicate-add handling where applicable.

Research, editor, and vocabulary guidance use the same general main-programme format definitions.
Mixed format takes precedence when both settings carry substantial programme content.

Research instructions and the search-tool description use the same search conditions.
Essential missing facts about an evidenced Edition can justify targeted search after known links and prior results.
An empty next-Edition slot alone cannot. Keep current identity and source-recovery restrictions.

### Reports and readers

Use report version 6 because retained model output changes shape.
Count non-null research slots and expose `currentDate` for add and refresh.
Keep historical JSON unchanged; active readers reject unsupported versions.

Update direct result readers in `report.ts`, `workflow-logging.ts`, and eval code.
Trace labels use saved context and committed changes; Studio summary uses report counts.
Verify these paths through existing suites.

## Validation

Local tests check shared instructions and model inputs. Tests with injected results check host behavior; they do not prove the model's choices.
Update existing fixtures where the contract changes.
Verify range storage in existing ingestion tests.

- Check required null slots, provider rejection output, wrong keys, swapped roles, and null-slot publication.
- Replace obsolete count-rejection tests with workflow success cases for two creations and more than twenty saved Editions.
- Check instructions and context for completion order, local date boundaries, programme gaps, format, and search conditions.
- Check ancestry normalization, invalid lists, unchanged raw output, reports, and atomic failure.

Run affected suites, type checks, lint, OpenSpec validation, and documentation checks.

In existing scope eval fixtures, replace unordered Edition-key expectations with an expected key or null for each slot.
The scorer checks each role directly and retains checks for new keys and years where applicable.
Check that swapped research roles fail scoring even when the editor follows them.

Run the existing pipeline and editor-only evals with live models and fixed source fixtures:

```sh
CATALOG_CAPTURE_TOOL_OUTPUTS=true npm run catalog:eval
npm run catalog:eval -- --editor-only
```

Keep the reports in `data/catalog-evals/` and pipeline tool results in `data/catalog-debug/<runId>/`.
Use each case's report `runId` to find its initial-source, `readPage`, and `searchWeb` results where used.
Verify capture files exist for those responses. Missing capture makes this verification incomplete.
Review failed scores with the saved results and record remaining failures.
Editor-only evals inject research and produce no research tool capture.
These evals test model behavior on the fixtures. New specific-festival checks and live ingestion remain separate later work.
