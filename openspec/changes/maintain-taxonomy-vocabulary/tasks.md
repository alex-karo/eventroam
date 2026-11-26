# Tasks

## 1. Vocabulary and catalog sync

- [x] 1.1 Add the nullable term description in a schema migration. Add a test helper that restores the pre-description schema and journal. Reuse it before the existing historical schema restores. Run the migration tests and verify that the upgrade preserves terms and Edition assignments.
- [x] 1.2 Add the repository vocabulary from the starter terms. Use short descriptions for specific assignment rules and omit descriptions for most genres. Include Wine and Beer as children of Food & drink. Verify that the file covers every starter key and that both new terms have the expected parent and descriptions.
- [x] 1.3 Implement the preview and apply command in the catalog tools. Test the stored parent IDs for Wine and Beer on first sync. Test updates to an imported term with a different parent. Check that both apply runs report its stored and declared parents and that the second apply reports zero additions and updates. Verify preservation of IDs, parent links, unmanaged terms, and Edition assignments. Check that preview and invalid input leave the data unchanged.
- [x] 1.4 Bundle the sync command and vocabulary in the Studio image. Add the explicit sync step to the [infrastructure guide](../../../docs/infrastructure.md) and the local ingestion setup. Update the [vocabulary reference](../../../docs/proposals/festival-taxonomy-vocabulary.md) to point to the maintained definitions. Run the documented command against the temporary catalog in the existing Compose smoke check.
- [x] 1.5 Update the Komodo wrapper in `self-hosted/remote-server/eventroam/compose.sh` and document the first deploy in the self-hosted guide. Check the order of stop, migrate, sync with `--apply`, and `up`. Verify that a failed sync prevents `up`.

## 2. Ingestion

- [x] 2.1 Load term descriptions with the run vocabulary. Update Classification and Editor to use them. Move the gathering, open-air, and mixed-format assertions from static prompt checks to the vocabulary supplied to both roles. Keep static tests for shared rules. Verify that terms without descriptions remain available with no `description` field and that a later run sees an updated description.
- [x] 2.2 Update Reader to collect evidence for substantial programme activities with their Edition context. Update the Reader, Classification, and Editor prompt versions. Add both drink topics and their descriptions to the fixed eval fixtures. Run model-backed checks on fixed official pages through Reader. Use the [acceptance criteria](proposal.md#acceptance-criteria) to check drink topic assignments and the description of a separate culinary programme. Run the existing ancestor normalization, festival type, and format checks.
- [x] 2.3 Move the official name rule into `format/openair.description`. Check that both roles receive it in the vocabulary. Use fixed evidence to check that the official name can support the open-air term and both festival descriptions. Check that conflicting direct evidence about the current Edition's main programme takes priority for the term and both texts.

## 3. Integration checks

- [x] 3.1 Run the focused database and ingestion checks together. Run `pnpm run docs:check` and `pnpm run openspec:validate`.
