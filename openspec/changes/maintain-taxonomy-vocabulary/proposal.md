# Proposal

## Why

Adding a taxonomy term currently needs a SQL migration. The criteria for assigning terms are in documentation and prompts. An editor needs one place to add a term and define when it applies.

## What Changes

- Keep the curated taxonomy and its term descriptions in a repository file. Provide a command to preview and apply changes to a catalog database.
- Apply the vocabulary during Komodo deployments before the services start.
- Store the term descriptions in SQLite. Use them when ingestion proposes and reviews Edition classifications.
- Add `topic/wine` and `topic/beer` under `topic/food-and-drink`.

## Requirements

- An operator can preview and apply term additions and changes to names and descriptions in the selected database without a new SQL migration for each change.
- Sync preserves existing term IDs, parent links, Edition assignments, and terms outside the repository file. It reports differences between stored and declared parent links.
- Komodo starts the web and Studio services only after migration and taxonomy sync succeed.
- Classification and Editor use the same optional term descriptions for a run. Terms without a description remain available. A later run uses updated descriptions from the catalog.
- Assign `wine` or `beer` when an official source describes a substantial programme for that drink in the selected Edition. A title, ordinary bar, sponsor mention, or incidental tasting alone is insufficient evidence.
- When ingestion writes the full festival description, describe a substantial culinary programme alongside the wine or beer programme if official sources support both. Keep the supported child topics under the existing parent rule.

## Acceptance criteria

- An operator can apply the same file to a fresh or an upgraded catalog. Preview and an invalid file leave the catalog unchanged.
- Sync updates an imported term's name and description and preserves its ID, parent, and Edition assignments. A second apply reports zero additions and updates and still shows the difference between the stored and declared parents.
- A Komodo deployment applies the vocabulary after migration and before it starts either service. A failed sync leaves both services stopped.
- Sync creates Wine and Beer under Food & drink in a catalog with the starter terms. The existing classification rules keep the supported child terms when a proposal also includes the parent.
- The vocabulary sent to both roles includes the descriptions for Wine and Beer. A genre such as Jazz remains available with no description field.
- Ingestion uses a term description changed in the database. Reader retains evidence of wine and beer programmes with their Edition context. Ingestion assigns each supported term. It leaves a new drink topic unset if the only evidence is an official name and dates, ordinary bar service, a sponsor mention, an incidental tasting, or a programme from another Edition.
- For an Edition with chef-led workshops and winery tastings, ingestion keeps `topic/wine` and removes a redundant `topic/food-and-drink`. The festival description includes the culinary programme.

## Impact

Catalog editors review vocabulary changes in Git. Local sync and Komodo deployments use the same vocabulary. Existing Edition classifications remain in place until the catalog changes them through its normal write operations.
