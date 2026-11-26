# Design

## TL;DR

- Maintain the curated terms and their assignment criteria in `src/catalog/taxonomy.json`. Add Wine and Beer as children of Food & drink.
- Add a nullable description column to SQLite. Run `taxonomy:sync` after migration to load descriptions and new terms. The command previews by default. Apply saves a validated change in one transaction. Komodo runs both steps before it starts the services.
- Ingestion loads the vocabulary once per run. Classification and Editor receive descriptions where the vocabulary supplies them. Most genres need only a slug and their existing hierarchy. Reader collects programme evidence with its Edition context.

See the [proposal](proposal.md) for the requirements.

## Contracts

Use the existing [facet keys](../../../src/catalog/domain/vocabulary.ts) and extend the [term table](../../../src/db/schema.ts). The JSON file contains an array of entries.

```ts
// Proposed repository entry.
type TaxonomyEntry = {
  facet: (typeof facets)[number];
  slug: string;
  name: string;
  parentSlug?: string;
  description?: string;
};

// Proposed addition to taxonomy_terms.
type TaxonomyTermDescription = { description: string | null };
```

`parentSlug` refers to an entry in the same facet in the file. Omit it for a root term. An omitted description sets the stored value to null for that entry. A term with a null description is valid and available for selection.

```sh
# Proposed commands. Both use the catalog selected by DATABASE_PATH.
pnpm run taxonomy:sync
pnpm run taxonomy:sync --apply
```

## Architecture

### Sync to SQLite

Use the [catalog database environment](../../../src/db/env.ts) and existing connection functions. Open an existing migrated catalog. Preview uses a read-only connection and one consistent view of the terms. Apply reads, validates, and writes in one write transaction. Both report additions, changed values, or no changes. Errors report the affected term and return a nonzero exit status.

The command loads the repository JSON and passes it to `catalog/write`. Validate the facet keys, slugs, nonempty names, and unique `(facet, slug)` keys. A supplied description must contain text. Resolve parents in the file, check for missing parents and cycles, and order new terms so that parents come first. Reuse [taxonomy domain validation](../../../src/catalog/domain/classification.ts) for the parent relationships. Both modes use the same plan. Apply builds it against the current database inside the write transaction. Report the stored and declared parent when they differ. Count only additions and updates as changes. A parent difference can still appear after an apply with zero writes.

Match existing terms by `(facet, slug)` and retain their IDs. Use the existing `catalog:term:<facet>:<slug>` ID convention for new terms. For matched rows, update names and descriptions. This preserves existing taxonomy relationships and Edition links. Git records edits to the curated definitions.

### Deployment

The [Studio command build](../../../scripts/build-studio-commands.mjs) bundles the repository JSON into `commands/sync-taxonomy.mjs`. For local setup, apply the vocabulary after migration and before starting ingestion.

Extend the Komodo `up` path in `self-hosted/remote-server/eventroam/compose.sh`. Keep the existing deployment lock. Stop `web` and `studio`, run `node commands/migrate.mjs`, then run `node commands/sync-taxonomy.mjs --apply`. Run both commands in one-off Studio containers with the same catalog volume. Call `up` only after both commands succeed. If either command fails, both services stay stopped.

For the first deploy, pause automatic Eventroam deploys. Make the app revision with the sync command and the wrapper revision that calls it available to Komodo. Run one deploy through the updated wrapper. Check the catalog and service health, then resume automatic deploys.

### Use descriptions in ingestion

Extend the [private vocabulary read](../../../src/catalog/read/research.ts) that supplies [run context](../../../src/ingestion/research/context.ts). Add non-null descriptions to the JSON vocabulary for both roles. [Classification receives slugs by facet](../../../src/ingestion/roles/classification/terms.ts). [Editor receives the vocabulary with term IDs](../../../src/ingestion/roles/editor/agent.ts) when it reviews classifications or festival descriptions. Both keep terms that have no description and omit the `description` field for those terms. Later review passes within the same run use the same definitions.

Ask both roles to use the definitions with source evidence for the selected Edition. Move term-specific assignment criteria from the [existing reference](../../../docs/proposals/festival-taxonomy-vocabulary.md) and prompts into the file. Keep shared rules in the prompts for facet limits, evidence, term reuse, and how to choose among supported terms, including the explicit festival preference. Update [Reader](../../../src/ingestion/roles/reader/prompt.ts) to retain passages that describe substantial programme activities and their Edition context. Update the versions of all three changed prompts.

For `format/openair`, put the name rule in the term's `description`. The words `Open Air` in the current official festival name are evidence that most of the main programme is outdoors. In the shared prompt, give direct evidence about where the current Edition's main programme takes place priority over evidence from the name. Apply the same format rules to Edition classification and to both festival descriptions.

Put the programme evidence requirements for `topic/wine` and `topic/beer` in their term descriptions. Apply these requirements to all new assignments for these topics, including when the festival name identifies the drink. Give examples such as tastings from several wineries or breweries and a dedicated wine or beer programme.

When Classification writes the full festival description, include a separate substantial culinary programme if the sources support it. Editor checks the description against that evidence. Reuse the existing ancestor rule for the topic set.

Test the gathering, open-air, and mixed-format definitions in the vocabulary supplied to both roles. Keep static prompt checks for shared rules. Store the descriptions used by model-backed checks in fixed eval fixtures so that changes to eval inputs change the dataset revision.

## Key decisions

- Use one JSON file for the full starter vocabulary. JSON needs no new parser dependency. Add a short description when a term has a specific assignment rule. Give most genres no description. Keep short notes for ambiguous terms such as `afrobeat` and `afrobeats`. Use the shared evidence rules for genres such as `jazz` and `rock`.
- Use an additive schema migration and load descriptions with the same command used for later edits. Keep the [original seed migration](../../../src/db/migrations/0001_starter_taxonomy.sql) as part of migration history. An explicit first sync also adds Wine and Beer. This keeps the current definitions in one editable file.
- Treat parent links as stable once a term exists. The original migration preserves imported terms with different parents. A parent change can make saved Edition assignments redundant. Use the stored parent for a matched term and the file parent for a new term. New terms can reference a parent added in the same sync. During rollout, check reported parent differences for any pre-existing Wine or Beer term.

## Risks and validation

- Verify the built sync command in the existing Compose smoke check with a temporary catalog. Verify the Komodo command order and the failed-sync path.
- Test fresh and upgraded catalogs, including a managed term with an imported ID, an existing Edition assignment, and an unmanaged term. Restore the schema and journal to the correct version in the historical migration tests.
- Run Reader on fixed source pages. Check the drink topic and description outcomes in the proposal. Retain coverage for existing type and format decisions.
