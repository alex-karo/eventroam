# Tasks

## 1. Studio approval path

- [ ] 1.1 Verify the [card approval path](design.md#risks-and-validation) in the built-in Browser with a fixture tool that cannot write to the catalog. Check the full proposal, audit mode, and result shown in chat. Verify that approval from the old card fails, approval from the new card runs only its own call, and a new proposal cannot reuse a closed pair. Reject requests missing either ID.

## 2. Catalog writes

- [ ] 2.1 Add the [approved edit path](design.md#contracts) to the writer. Check receipt replay after the current record changes, mode conflicts, and audit rows. Run the existing ingestion report checks for the default path.
- [ ] 2.2 Apply approved fields per target. Check changes made since preview, independent description updates, a valid Edition country correction, and preservation of links outside the edit. Replay a URL edit that replaced the stored link ID. Check partial success when a link is missing. Verify public redirects for a slug edit with audit omission.

## 3. Studio catalog edits

- [ ] 3.1 Connect the edit tool to the catalog assistant. Check that an oversized or incomplete proposal cannot reach approval and that the default mode records the change. Check approve, decline, bypass attempts, changed arguments, and replay at the Studio API. Verify that a revised proposal needs new approval.
- [ ] 3.2 Enable OpenRouter web search for the catalog assistant. Check tool availability for both provider paths. Run one live search in Studio to check source links. Verify that a search alone starts no jobs and that a proposed correction requires approval.
- [ ] 3.3 Update the [Studio chat guide](../../../docs/ingestion-tools.md#studio-catalog-assistant) and assistant instructions. Check that a direct correction asks for approval and a refresh request keeps its existing mode. Show a correction with a source link, an edit without an audit entry, and a batch with a failed target.

## 4. Integration checks

- [ ] 4.1 Run the focused catalog writer and Studio assistant tests, then run `pnpm run openspec:validate` and `pnpm run docs:check`. Record the results and the approval flow verified in Studio.
