# Proposal

## Why

The queue infers the operation from empty fields. A saved job needs an explicit operation and one field for its input.

## What Changes

- Store the operation as `mode` and the operation data as JSON in `input`.
- Use SQLite column changes to preserve jobs and their run links during migration.
- Share the job target format with the Studio workflow.
- Give Studio agents ready SQL queries for batch counts and job details.

## Capabilities

### Modified Capabilities

- `catalog/ingestion-tasks`
  - **Before** — Catalog SQL exposes the saved target and settings.
  - **After** — Catalog SQL exposes the saved mode and input. The Studio queue uses the saved mode to select the operation. The spec matches restart behavior.

- `catalog/ingestion-workflow`
  - **Before** — The Studio workflow reads refresh fields beside the mode.
  - **After** — The Studio workflow reads the target from `input` for both modes.

## Impact

Queue storage, Studio workflow input, and catalog SQL for batch inspection.
