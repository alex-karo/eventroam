# Proposal

## Why

Maintaining main specs and change deltas duplicates work. The owner wants requirements to stay with each change, without a second collection of current product specs.

## What Changes

- Use `proposal.md → design.md → tasks.md` for full changes.
- Put short added or changed requirements and a separate Acceptance criteria section in each proposal.
- Delete main specs and archived specs, including the older legacy specs. Keep other change history.
- Adapt project skills, checks, CI, and archive. Keep fast track and the existing skill structure.

## Requirements

- Keep change requirements in the proposal as short observable results for users, operators, or external consumers, with separate acceptance criteria and no WHEN/THEN scenarios or required IDs.
- Keep implementation choices in design and tasks. Summarize scope without an inventory of former specs.
- Require proposal, design, and tasks in that order; retain fast track for clear local changes with low risk.
- Validate proposal lists and required documents. CI permits a complete planning prefix; normal validation permits unfinished implementation tasks.
- Archive valid changes with completed tracked tasks, preserving all three documents and metadata without spec synchronization.
- Remove main, active, archived, and legacy spec files and separate PRDs. Retain active change scope, other history, and lasting development, data, and privacy rules.

## Acceptance criteria

- Native status, instructions, and apply expose proposal, design, and tasks in order.
- Missing or empty required documents, proposal lists, or predecessors fail validation; comments and code examples do not supply requirements.
- A new empty scaffold passes draft validation, and a valid plan can retain pending implementation tasks.
- Archive rejects invalid plans, absent or unfinished tasks, and destination collisions without moving the active change.
- Successful archive preserves the proposal and metadata, creates no spec files, and retains requirements and acceptance criteria.
- Current skills keep their original sections and steps, use observable proposal requirements, and contain no links to removed requirement files or inventories of former specs.

## Impact

This changes the development workflow and planning files. Product behavior and stored application data stay the same. Code, tests, and current guides describe the implemented system; archived proposals record past changes.
