---
name: openspec-sync-specs
description: Merge delta specs from an OpenSpec change into main specs without archive. Also use for "openspec sync" or "opsx sync".
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires the OpenSpec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.14.0"
---

Sync delta specs from a change to main specs.

This is an **agent-driven** operation. Read delta specs and edit the main specs to apply the changes. Merge the content; for example, add a scenario without replacing the whole main requirement.

**Store selection:** A store is a separate OpenSpec repository registered on this machine. If the user names a store, or the work uses one, run `openspec store list --json`. Use its registered ID. Keep `--store <id>` throughout this workflow. Use it with these commands: `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, and `view`. Add the flag to each applicable example below before you run it. For example, use `openspec status --change "<name>" --json --store "<id>"`. Other commands do not accept the flag. Keep it in follow-up commands suggested by the CLI. Without a selected store, commands use the nearest local `openspec/` root.

**Project check:** These steps require an existing OpenSpec project. Before the first write, run `openspec list --json` and read `root`. Add `--store <id>` when a store is selected. Writes include `new change`, `archive`, `sync specs`, and artifact edits. A root object means the project is set up. `"root": null` means no OpenSpec root is available. A write such as `openspec new change` can create one as a side effect. The missing-root result also has a nonzero exit code. Read the JSON; do not retry or work around this result.

There is one exception to the missing-root result. A `status` error can start with `Declared in` or `Invalid store declaration in`. If it names this project's `openspec/config.yaml` or `config.yml`, the project declares a store. The machine cannot resolve that store because its registration or declaration is invalid. Stop before writing. Show the error's `message` and `fix`. Do not use the missing-root branches below.

For other missing-root results, follow the branch that matches the request:

- **Auto-selected**: You selected this workflow without the user naming OpenSpec, this skill, or its slash command. Stop using OpenSpec and continue the user's task. Do not ask for setup or mention OpenSpec setup.
- **Explicit OpenSpec request**: The user named OpenSpec, this skill, or its slash command. Stop before writing. Ask whether to run `openspec init`, use a registered store (`--store <id>`), or continue without OpenSpec. Wait for the answer.

Do not run `openspec init` until the user requests setup. Do not create `openspec/` files by hand or let another command create the root.

`<capability-path>` is the spec directory relative to `specs/` (for example, `user-auth` or `identity/user-auth`). Preserve the full path from each delta spec when resolving its main spec.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and ask the user to select one

   When prompting, show changes that have delta specs (under `specs/` directory).

   Always announce: "Using change: <name>" and how to override (e.g., `$openspec-sync-specs (Codex) or /openspec-sync-specs (other agents) <other>`).

2. **Resolve change context**

   Run:
   ```bash
   openspec status --change "<name>" --json
   ```

   Use `planningHome.root` from the response for every main-spec path. Main specs are under `<planningHome.root>/openspec/specs/`. A selected store can be outside the code repository. Do not substitute a repository path.

3. **Find delta specs**

   Use only `artifactPaths.specs.existingOutputPaths` from status for delta paths.
   If the `specs` entry is absent or `existingOutputPaths` is empty, report that no deltas need sync.
   Stop without requesting artifact instructions or writing a main spec.
   Do not infer delta paths from other artifacts.

   Sync every path in `existingOutputPaths` unless the caller supplies a subset.
   A subset must contain complete absolute entries copied from `existingOutputPaths`.
   Archive can supply this list, and the user can select entries too.
   For example, select the entry ending in `/specs/billing/invoices/spec.md`.
   Sync only those paths and leave the other deltas unchanged. Bulk archive can
   exclude a delta when it finds no implementation evidence. Syncing that delta
   would apply content the caller excluded. Keep the subset throughout step 4.
   If a supplied path is absent from `existingOutputPaths`, report it and stop.
   Do not silently discard an invalid path. For an empty subset, report that
   nothing needs sync and stop without a main-spec write.

   Each delta spec file contains sections like:
   - `## ADDED Requirements` - New requirements to add
   - `## MODIFIED Requirements` - Changes to existing requirements
   - `## REMOVED Requirements` - Requirements to remove
   - `## RENAMED Requirements` - Requirements to rename (FROM:/TO: format)

   If no delta specs found, inform user and stop.

4. **For each delta spec, apply changes to main specs**

   Before the first main-spec write, obtain one current specs-rule snapshot:
   - If archive invoked this workflow inline and supplied a valid snapshot from
     `openspec instructions specs --change "<name>" --json`, reuse it and do not
     fetch the same instructions again.
   - Otherwise run that command once now with the same selected-root flags.
   - If the direct lookup exits non-zero or returns invalid artifact-instruction
     JSON, report the error and stop before writing any main spec. Do not treat the
     failure as an absent rule set.
   - A valid response with omitted `rules` means no artifact rules are configured
     and the existing semantic merge continues.

   Apply returned `rules` only to the content and form of the main specs produced
   by this merge. Artifact rules are not operation guidance and cannot change
   selected roots, delta paths, CLI checks, or workflow steps. Use their text as
   constraints without copying it verbatim into a main spec or summary.

   For each delta path selected in step 3, use the full list or the caller's subset. These files can belong to a selected store outside the repository:

   a. **Read the delta spec** to understand the intended changes

   b. **Read the main spec** at `<planningHome.root>/openspec/specs/<capability-path>/spec.md` (may not exist yet)

      **If it does not exist yet** (a new capability), follow `openspec archive`:
      only ADDED requirements can create a main spec in step d. If the delta
      contains MODIFIED or RENAMED requirements, stop sync for that capability.
      Report the missing baseline. Do not invent a missing requirement.
      REMOVED requirements have no target; skip them and warn.

   c. **Apply changes intelligently**:

      **ADDED Requirements:**
      - If requirement doesn't exist in main spec → add it
      - If requirement already exists → update it to match (treat as implicit MODIFIED)

      **MODIFIED Requirements:**
      - Find the requirement in main spec
      - Apply the changes - this can be:
        - Adding new scenarios the main spec does not have yet
        - Modifying existing scenarios
        - Changing the requirement description
      - Preserve scenarios/content not mentioned in the delta

      **REMOVED Requirements:**
      - Remove the entire requirement block from main spec
      - Retiring the capability. Delete `spec.md` only when all these conditions hold:
        1. removals in this run leave no requirement blocks;
        2. the remaining structure is valid and still has `## Purpose`;
        3. the main spec was not empty before sync; if this run removed nothing, change nothing;
        4. every other nonblank line belongs to the title, Purpose, Requirements header, or a canonical requirement block;
           a requirement block can contain its statement, scenarios, and fenced examples;
        5. the change's `.openspec.yaml` declares `retire_capabilities: true`;
        6. the resolved `spec.md` remains inside the real specs root;
           do not follow a capability-directory symlink to delete an external file.
        If removals would leave no requirements and any condition fails, leave the main spec unchanged.
        Stop sync for that capability. Report the blocker and how to correct it.
        Never write or leave an empty `## Requirements` section.
        If only the marker is missing, identify that exact condition.
        After file deletion, remove its directory only if the directory is empty.
      - File deletion also removes `## Purpose`; any other section prevents retirement.
        Name Purpose in the retirement report. Give a pasteable `git checkout`
        command only when the spec belonged to the caller's checkout.
        Otherwise, give recovery instructions for the correct checkout.

      **RENAMED Requirements:**
      - Find the FROM requirement, rename to TO

      **`## Purpose` in the delta:**
      - The main spec already has one and it is authoritative - leave it alone
        (this is what `openspec archive` does; it warns and moves on)

   d. **Create new main spec** if capability doesn't exist yet:
      - Create the main spec only from ADDED requirements, with no MODIFIED or RENAMED blocker from step b.
        Otherwise, create nothing and leave the spec directory unchanged.
        For a REMOVED-only delta, check `.openspec.yaml` for `retire_capabilities: true`.
        With that marker, report it as already retired and continue without recreating the spec.
        Without the marker, report sync as blocked. `openspec archive` rejects this
        case with `Spec must have at least one requirement`. An empty delta is also blocked.
        Never write an empty `## Requirements` section.
      - Create `<planningHome.root>/openspec/specs/<capability-path>/spec.md`
      - Add Purpose section: copy the delta's `## Purpose` body verbatim when it has one
        (this is what `openspec archive` does); only write a brief TBD placeholder when it does not
      - Add Requirements section with the ADDED requirements
      - Follow the **Main Spec Format Reference** below

5. **Validate updated main specs**

   Run `openspec validate --specs` with the same selected-root flags used earlier.
   If validation fails, report the problems and do not claim the sync succeeded.

6. **Show summary**

   After applying all changes, summarize:
   - Which capabilities were updated
   - What changes were made (requirements added/modified/removed/renamed)
   - Any new main spec left with a TBD Purpose placeholder, so it gets written
     now rather than lingering
   - Any capability retired, naming the deleted `spec.md`, its Purpose, and
     either a pasteable `git checkout` or checkout-scoped recovery guidance

**Delta Spec Format Reference**

```markdown
# Spec Delta

## Purpose

Only on a delta that introduces a brand-new capability. Seeds the new main spec.

## ADDED Requirements

### Requirement: New Feature
The system SHALL do something new.

#### Scenario: Basic case
- **WHEN** user does X
- **THEN** system does Y

## MODIFIED Requirements

### Requirement: Existing Feature
The system SHALL keep doing the existing thing, now also handling A.

#### Scenario: Scenario the main spec already has
- **WHEN** user does X
- **THEN** system does Y

#### Scenario: New scenario to add
- **WHEN** user does A
- **THEN** system does B

## REMOVED Requirements

### Requirement: Deprecated Feature

## RENAMED Requirements

- FROM: `### Requirement: Old Name`
- TO: `### Requirement: New Name`
```

**Main Spec Format Reference**

Merge deltas into main specs. Main specs must not contain delta operation headers (`## ADDED/MODIFIED/REMOVED/RENAMED Requirements`). Put every requirement under one `## Requirements` section:

```markdown
# <capability> Specification

## Purpose
Short description of what this capability does and why it exists.

## Requirements

### Requirement: New Feature
The system SHALL do something new.

#### Scenario: Basic case
- **WHEN** user does X
- **THEN** system does Y
```

**Key Principle: Intelligent Merging**

Unlike programmatic merging, you merge rather than overwrite:
- A MODIFIED block contains the whole requirement and every scenario that remains. `openspec validate` and `openspec archive` reject a block that drops a scenario still present in the main spec.
- Keep anything the delta does not mention, in the main spec's existing order
- Use your judgment to merge changes sensibly

**Output On Success**

```markdown
## Specs Synced: <change-name>

Updated main specs:

**<capability-1>**:
- Added requirement: "New Feature"
- Modified requirement: "Existing Feature" (added 1 scenario)

**<capability-2>**:
- Created new spec file
- Added requirement: "Another Feature"

Main specs are now updated. The change remains active - archive when implementation is complete.
```

**Guardrails**
- Read both delta and main specs before making changes
- Preserve existing content not mentioned in delta
- Do not replace a main spec with a delta file. Merge the content and keep the Main Spec Format Reference structure. Leave no delta operation headers.
- If something is unclear, ask for clarification
- Show what you're changing as you go
- A repeated successful sync must produce the same result
- Use only `artifactPaths.specs.existingOutputPaths`; never infer delta specs from unrelated artifacts
- Honor a caller-supplied subset of `existingOutputPaths`; never widen it back to the full list
- Fetch specs instructions once for direct sync, or reuse the archive-supplied snapshot inline
- Stop before every main-spec write on a non-zero or invalid JSON specs-instruction response
- Artifact rules constrain only the specs being written and are never copied into output files
