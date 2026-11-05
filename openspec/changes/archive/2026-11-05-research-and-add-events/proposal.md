# Proposal

## Why

An owner can have a map pin, a link, or a note before they know the festival name. Today they must supply a name to start ingestion and cannot submit a list of new events from Studio chat.

## What Changes

- **BREAKING** Replace the add CLI flag `--name` with `--input` and the workflow field `name` with `input`. A name alone remains valid input. The former 500-character name limit does not apply to notes.
- Use all supplied text, including coordinates, as leads. Ingestion must check sources before it writes facts.
- When independent evidence establishes the place, use a matching selected geocoding result to fill its absent country.
- Add a separate Studio agent, `catalog-researcher`. It can search with Exa through OpenRouter, submit one or more add jobs, and read their status by batch ID.
- **BREAKING** Rename the catalog assistant tool `cancel_refresh` to `cancel_batch`. It cancels pending jobs in an add or refresh batch.

## Capabilities

### Modified Capabilities

- `catalog/ingestion-workflow`
  - **Before** CLI and Studio form add one Event by name.
  - **After** Both preserve a full note about one possible Event, including map links and other search leads.
- `catalog/studio-assistant`
  - **Before** The catalog assistant selects existing Events and requests refresh jobs.
  - **After** The researcher finds candidates, submits add jobs, and distinguishes proposed, applied, and skipped results. The catalog assistant handles cancellation for either batch type.
- `catalog/ingestion-tasks`
  - **Before** A batch targets existing Event IDs. The main spec describes a separate worker. The current Studio server hosts the queue processor.
  - **After** Add and refresh share one batch contract. Add takes ordered descriptions and refresh takes existing Event IDs.

## Impact

The change affects the catalog CLI, workflow form, ingestion prompts and history, Studio tools, and the SQLite job schema. It reuses the existing search provider and job processor.
