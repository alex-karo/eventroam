# Tasks

## 1. Queue contract

- [x] 1.1 Add migration 0005. Verify that upgrades from 0003 and 0004 keep saved job data, indexes, and run links.
- [x] 1.2 Write and validate the explicit mode and JSON input. Verify dispatch and run persistence for both modes and rejection of invalid saved input.

## 2. Inspection

- [x] 2.1 Update the catalog SQL examples and ingestion guide. Verify that batch details still expose refresh Event IDs and bounded add excerpts.

- [x] 2.2 Move batch counts and details into shared SQL references. Verify the queries with long notes, refresh IDs, and repeated attempts.
- [x] 2.3 Use the saved target shape in the Studio workflow. Verify both modes, default refresh scope, and invalid inputs. Align the queue restart contract with Studio.
