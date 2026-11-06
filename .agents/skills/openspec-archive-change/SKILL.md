---
name: openspec-archive-change
description: Archive a completed OpenSpec change after implementation. Also use for "openspec archive" or "opsx archive".
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires the OpenSpec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.14.0"
---

Archive a completed change in the experimental workflow.

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

   When prompting, show only active changes (not already archived).
   Include the schema used for each change if available.

   Always announce: "Using change: <name>" and how to override (e.g., `$openspec-archive-change (Codex) or /openspec-archive-change (other agents) <other>`).

   **Load current archive inputs before the existing archive checks:**

   After resolving the selected change and planning root, run:
   ```bash
   openspec instructions archive --change "<name>" --json
   ```
   Keep the same selected-root flags. This optional lookup supplies extra context
   and advice. It must not block archive. If it fails or returns invalid JSON,
   continue without context and operation guidance. For example, an older CLI
   may not support the command. Do not report an error or stop for this lookup.

   A successful response can omit both fields. When present, read `context` and
   apply relevant project facts, conventions, and constraints. Read every
   `operationGuidance` entry as optional advice. Follow advice only if it applies
   and agrees with the built-in archive workflow.

   Neither field replaces built-in steps, explicit user choices, resolved paths,
   CLI checks, or command contracts. Report a context conflict and keep the
   controlling value. Explain why you did not follow advice that conflicts or
   does not apply. Do not derive replacement paths, skipped prompts, or flags
   from either field. Do not copy these fields into specs, artifacts, or summaries
   unless the user separately requests that content. They guide agent behavior;
   they are not executable checks.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: List of artifacts with their status (`done`, `skipped`, or other)

   **If any artifacts are neither `done` nor `skipped`** (skipped artifacts satisfy the requirement - the change declares skip_specs):
   - Display warning listing incomplete artifacts
   - Ask the user to confirm they want to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Run `openspec list --json` with the same selected-root flags and find the
   entry in `changes` whose `name` exactly matches the selected change.
   Require exactly one match and nonnegative integer `totalTasks` and
   `completedTasks`, with `completedTasks <= totalTasks`. The CLI resolves
   the schema's tracked task files, including custom artifact names, output
   paths, and globs.
   Incomplete tasks = `totalTasks - completedTasks`.

   Do not infer task completion from artifact status or a missing top-level `tasks.md`.
   If the lookup, JSON, matching entry, or counts are invalid, report the problem.
   Stop before sync or archive. This includes an absent or duplicate change entry.
   The CLI counts only `x`/`X` checkbox markers as complete.
   Other markers, including unfamiliar ones, remain incomplete.

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Ask the user to confirm they want to proceed
   - Proceed if user confirms

   **If `totalTasks` is zero:** Proceed without a task-related warning.

4. **Assess delta spec sync state**

   Use `artifactPaths.specs.existingOutputPaths` from status JSON as the only
   delta-spec source. If the `specs` entry is missing or
   `existingOutputPaths` is empty, proceed without a sync prompt and do not infer
   delta specs from other artifacts.

   **If delta specs exist:**
   - Compare each delta with its main spec at `<planningHome.root>/openspec/specs/<capability-path>/spec.md`. Use the store-aware `planningHome.root` from step 2, not a fixed repository path.
   - A missing main spec is **not automatically** "already synced". For a new capability, sync creates that file. Use the first matching case below:
     - If the delta has MODIFIED or RENAMED requirements, mark the capability as sync-blocked. Report that only ADDED requirements can create a main spec. Do not invent a missing requirement.
     - Otherwise, if only REMOVED requirements exist and `.openspec.yaml` declares `retire_capabilities: true`, report the capability as already retired. Count it as already synced and warn that nothing remains to remove. Do not recreate the main spec. Use this rule also when checking a completed sync.
     - Otherwise, if no ADDED requirements remain, mark the capability as sync-blocked. For a REMOVED-only delta, warn that no main spec exists and leave the spec tree unchanged. `openspec archive` rejects the unmarked case with `Spec must have at least one requirement`.
     - Otherwise, mark the capability as needing sync: `<capability-path>: new main spec will be created`. If REMOVED requirements also exist, warn that sync will ignore them because no main spec exists. A selected sync creates it from ADDED requirements only, as `openspec archive` does.
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Continue assessing the remaining capabilities even when one is sync-blocked. Show a combined summary before prompting.

   **Prompt options:**
   - If any capability is sync-blocked: explain why and offer only "Archive without syncing", "Cancel"
   - Otherwise, if changes needed: "Sync now (recommended)", "Archive without syncing"
   - Otherwise, if already synced: "Archive now", "Sync anyway", "Cancel"

   Route on the answer:
   - "Cancel" — stop, do not archive
   - "Archive without syncing" or "Archive now" — proceed to archive
   - "Sync now" or "Sync anyway" — sync, then verify (below). Do not start any sync while a capability is sync-blocked; explain the blocker and repeat the available choices.
   - Anything else — ask again rather than archiving

   Before a selected sync writes any main spec, run
   `openspec instructions specs --change "<name>" --json` once with the selected-root flags.
   Require a zero exit code and valid artifact-instruction JSON.
   If the lookup fails or returns invalid JSON, report the error.
   Stop before any main-spec write or change move.
   A valid response without `rules` means that no artifact rules are configured.
   Apply returned rules only to the content and form of merged main specs.
   Do not use them as archive guidance or to change CLI behavior.
   Do not copy rule text into output files.

   Then run the `openspec-sync-specs` workflow inline for change '<name>'. Pass the delta analysis and fetched specs-rule snapshot. Wait until sync finishes. It must reuse the snapshot without another `specs` instructions lookup. Do not run it as a background task. Step 5 would move `changeRoot` while sync still reads it, leaving main specs unchanged. If delegation is the only available method, wait for the delegated result before continuing.

   If the sync reports any stop or blocking condition, treat the sync as failed.
   Stop the archive immediately. Do not perform the post-sync content comparison and do not move its `changeRoot`.
   Nothing has moved, so the user can fix the blocking condition or re-run the sync.

   After the sync writes each main spec, verify its structure against the canonical sync contract:
   - A new main spec starts with a `# <capability> Specification` title. An existing main spec keeps its title exactly as it is.
   - Preserve existing `## Purpose` sections completely untouched for established main specs.
   - For a new main spec, copy the delta `## Purpose` verbatim. Warn if its text is shorter than standard validation expects. Do not rewrite an existing Purpose. If no usable Purpose exists, use the sync workflow's TBD placeholder and warning.
   - Check that no delta operation headers remain: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements`. Follow the sync workflow's format rules.
   - New or changed blocks use `### Requirement:` and `#### Scenario:` under `## Requirements`. Leave content not mentioned by the delta unchanged.

   Repeat the comparison for every delta path in `artifactPaths.specs.existingOutputPaths`, not only files reported as changed. Include the already-retired, missing-spec case. After successful sync, each capability must be already synced:
   - ADDED requirements present
   - MODIFIED requirements carrying the scenario and description changes named in the delta, with their other scenarios intact
   - REMOVED requirements are absent. If sync retired the last requirement, the main spec is deleted rather than empty.
   - RENAMED requirements present under the new name and absent under the old one

   If sync failed or any capability differs, report the mismatch and stop. Do not archive. `changeRoot` remains in place so the user can correct the problem or run sync and archive again.

5. **Perform the archive**

   Create an `archive` directory under `planningHome.changesDir` if it doesn't exist:
   ```bash
   mkdir -p "<planningHome.changesDir>/archive"
   ```

   If the change name already starts with `YYYY-MM-DD-`, use it unchanged. Otherwise, prepend the current date as `YYYY-MM-DD-<change-name>`. Do not add a second date prefix; this matches `openspec archive`.

   **Check if target already exists:**
   - If yes: Fail with error, suggest renaming existing archive or using different date
   - If no: Move `changeRoot` to the archive directory

   ```bash
   mv "<changeRoot>" "<planningHome.changesDir>/archive/<target-name>"
   ```

6. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Whether specs were synced (if applicable)
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

```markdown
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/<target-name>/
**Specs:** <"✓ Synced to main specs" only if the step 4 verification passed; otherwise "No delta specs" or "Sync skipped">

<"All artifacts complete. All tasks complete." — or, if archived with warnings, list them instead (e.g. "Archived with 2 incomplete tasks")>
```

**Guardrails**
- Announce the selected change; prompt for selection when it is ambiguous
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- If sync is requested, run the `openspec-sync-specs` workflow inline (agent-driven)
- Wait for sync and verify main specs before moving `changeRoot`. Never run archive concurrently with sync.
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
- Apply relevant runtime context and report conflicts; operation guidance remains advisory
- Consider every guidance entry and explain any inapplicable or conflicting advice
- Existing CLI checks, resolved paths, prompts, and command contracts are unchanged
- Artifact rules constrain only the specs being written and are never operation guidance
- Never copy runtime context, operation guidance, or artifact-rule text verbatim into output files
