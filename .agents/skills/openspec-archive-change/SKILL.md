---
name: openspec-archive-change
description: Archive a completed OpenSpec change after implementation. Also use for "openspec archive" or "opsx archive".
allowed-tools: Bash(openspec:*) Bash(pnpm:*)
license: MIT
compatibility: Requires the OpenSpec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.14.0"
---

Archive a completed change in the experimental workflow.

**Store selection:** A store is a separate OpenSpec repository registered on this machine. If the user names a store, or the work uses one, run `openspec store list --json`. Use its registered ID. Keep `--store <id>` throughout this workflow. Use it with these commands: `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, and `view`. Add the flag to each applicable example below before you run it. For example, use `openspec status --change "<name>" --json --store "<id>"`. Other commands do not accept the flag. Keep it in follow-up commands suggested by the CLI. Without a selected store, commands use the nearest local `openspec/` root.

For the project validation and archive commands below, run `pnpm` from the resolved `root.path`. These scripts do not accept `--store`. Check that the selected root contains the project scripts; do not run them in another repository.

**Project check:** These steps require an existing OpenSpec project. Before the first write, run `openspec list --json` and read `root`. Add `--store <id>` when a store is selected. Writes include `new change`, `archive`, and artifact edits. A root object means the project is set up. `"root": null` means no OpenSpec root is available. A write such as `openspec new change` can create one as a side effect. The missing-root result also has a nonzero exit code. Read the JSON; do not retry or work around this result.

There is one exception to the missing-root result. A `status` error can start with `Declared in` or `Invalid store declaration in`. If it names this project's `openspec/config.yaml` or `config.yml`, the project declares a store. The machine cannot resolve that store because its registration or declaration is invalid. Stop before writing. Show the error's `message` and `fix`. Do not use the missing-root branches below.

For other missing-root results, follow the branch that matches the request:

- **Auto-selected**: You selected this workflow without the user naming OpenSpec, this skill, or its slash command. Stop using OpenSpec and continue the user's task. Do not ask for setup or mention OpenSpec setup.
- **Explicit OpenSpec request**: The user named OpenSpec, this skill, or its slash command. Stop before writing. Ask whether to run `openspec init`, use a registered store (`--store <id>`), or continue without OpenSpec. Wait for the answer.

Do not run `openspec init` until the user requests setup. Do not create `openspec/` files by hand or let another command create the root.

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
   from either field. Do not copy these fields into artifacts or summaries
   unless the user separately requests that content. They guide agent behavior;
   they are not executable checks.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: List of artifacts with their status (`done`, `skipped`, or other)

   **If any required artifacts are neither `done` nor `skipped`**:
   - List the incomplete artifacts and stop before archive.
   - For `review-driven`, all three artifacts are required. The CLI-generated `skip_specs: true` marker does not waive proposal requirements.

   Run `pnpm run openspec:validate -- "<name>"`. If validation fails, report the errors and leave the change active.

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
   Stop before archive. This includes an absent or duplicate change entry.
   The CLI counts only `x`/`X` checkbox markers as complete.
   Other markers, including unfamiliar ones, remain incomplete.

   **If incomplete tasks are found:** Show their count and stop before archive.

   Get `openspec instructions apply --change "<name>" --json` with the same selected-root flags. Require `state: "all_done"`. A zero task count or unusable task evidence does not prove completion.

4. **Perform the archive**

   This project has no main specs or delta-spec synchronization. Keep proposal requirements and acceptance criteria in the archived change.

   Run the project archive command from the resolved project root:
   ```bash
   pnpm run openspec:archive -- "<name>"
   ```

   The command validates the proposal and native task completion before it calls native archive with `--skip-specs --no-validate --yes`. These flags skip only upstream delta-spec checks and synchronization. They do not waive project proposal or task checks.

   Native archive creates the archive directory, preserves an existing date prefix or adds the current date, checks destination collisions, and moves the whole change with `.openspec.yaml`. If the target exists, report the collision and leave both directories unchanged.

5. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Proposal preservation and completion checks

**Output On Success**

```markdown
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/<target-name>/
**Proposal:** Preserved in the archived change

All artifacts complete. All tasks complete.
```

**Guardrails**
- Announce the selected change; prompt for selection when it is ambiguous
- Use artifact graph (openspec status --json) for completion checking
- Do not archive an invalid proposal or incomplete tasks; use the project archive command
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- Preserve the proposal as change history; do not create or synchronize main specs
- Apply relevant runtime context and report conflicts; operation guidance remains advisory
- Consider every guidance entry and explain any inapplicable or conflicting advice
- Existing CLI checks, resolved paths, prompts, and command contracts are unchanged
- Never copy runtime context, operation guidance, or artifact-rule text verbatim into output files
