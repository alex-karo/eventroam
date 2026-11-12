---
name: openspec-update-change
description: Revise existing OpenSpec planning artifacts and keep them consistent. Use for "openspec update change" or "opsx update". For the openspec update CLI command, run that command instead. Do not edit code.
allowed-tools: Bash(openspec:*) Bash(pnpm:*)
license: MIT
compatibility: Requires the OpenSpec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.14.0"
---

Revise a change's existing planning artifacts and keep them consistent. Do not edit code.

**Store selection:** A store is a separate OpenSpec repository registered on this machine. If the user names a store, or the work uses one, run `openspec store list --json`. Use its registered ID. Keep `--store <id>` throughout this workflow. Use it with these commands: `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, and `view`. Add the flag to each applicable example below before you run it. For example, use `openspec status --change "<name>" --json --store "<id>"`. Other commands do not accept the flag. Keep it in follow-up commands suggested by the CLI. Without a selected store, commands use the nearest local `openspec/` root.

For the project validation and archive commands below, run `pnpm` from the resolved `root.path`. These scripts do not accept `--store`. Check that the selected root contains the project scripts; do not run them in another repository.

**Project check:** These steps require an existing OpenSpec project. Before the first write, run `openspec list --json` and read `root`. Add `--store <id>` when a store is selected. Writes include `new change`, `archive`, and artifact edits. A root object means the project is set up. `"root": null` means no OpenSpec root is available. A write such as `openspec new change` can create one as a side effect. The missing-root result also has a nonzero exit code. Read the JSON; do not retry or work around this result.

There is one exception to the missing-root result. A `status` error can start with `Declared in` or `Invalid store declaration in`. If it names this project's `openspec/config.yaml` or `config.yml`, the project declares a store. The machine cannot resolve that store because its registration or declaration is invalid. Stop before writing. Show the error's `message` and `fix`. Do not use the missing-root branches below.

For other missing-root results, follow the branch that matches the request:

- **Auto-selected**: You selected this workflow without the user naming OpenSpec, this skill, or its slash command. Stop using OpenSpec and continue the user's task. Do not ask for setup or mention OpenSpec setup.
- **Explicit OpenSpec request**: The user named OpenSpec, this skill, or its slash command. Stop before writing. Ask whether to run `openspec init`, use a registered store (`--store <id>`), or continue without OpenSpec. Wait for the answer.

Do not run `openspec init` until the user requests setup. Do not create `openspec/` files by hand or let another command create the root.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

This workflow revises existing artifacts. Step 4 permits a new file only within a partially populated glob artifact. For an artifact with no files, `openspec status --change "<name>" --json` identifies the next artifact. Use `openspec instructions "<artifact-id>" --change "<name>" --json` for its creation instructions.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes sorted by most recently modified, and ask the user to select one

   When prompting, present the top 3-4 most recently modified changes as options, showing:
   - Change name
   - Status (e.g., "0/5 tasks", "complete", "no tasks")
   - How recently it was modified (from `lastModified` field)

   Mark the most recently modified change as "(Recommended)" since it's likely what the user wants to update.

   Always announce: "Using change: <name>" and how to override (e.g., `$openspec-update-change (Codex) or /openspec-update-change (other agents) <other>`).

2. **Get the change's artifacts**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand current state. The response includes:
   - `schemaName`: The workflow schema being used (e.g., "review-driven")
   - `artifacts`: Array of artifacts with their status ("done", "skipped", "ready", "blocked")
   - `isPlanningComplete`: Boolean indicating if all planning artifacts are complete. Older CLI versions expose the same value as `isComplete`.
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context. Use these instead of assuming repo-local paths.

   Use the artifact IDs and paths from the active schema. Do not assume names or special-case a schema. Custom schemas must work unchanged.

   Edit files from `artifactPaths.<id>.existingOutputPaths`. The CLI expands globs, such as `notes/**/*.md`, into concrete paths there. Do not write to a glob `resolvedOutputPath`; it is a pattern, not a file.

3. **Understand the request**
   - If the user asked for a specific revision ("the design now uses X"), that is the starting edit.
   - For a general "update" or "make this coherent" request, compare existing artifacts for conflicts, gaps, and repeated content.

4. **Read and reconcile**
   - Read the artifact(s) the request touches and the change's other existing artifacts.
   - Draft the requested edit in the conversation. Do not write files yet; step 5 controls every write. Check every other artifact against the draft. A change to a later artifact can require a change to an earlier artifact. Dependency order can help you choose a reading order. It does not restrict which artifacts you can revise.
   - For `review-driven`, reconcile proposal, design, and tasks. Keep added or changed requirements as short observable results for users, operators, or external consumers, with a separate Acceptance criteria section and no WHEN/THEN scenarios. Move internal mechanisms and test fixtures to design or tasks, preserving accepted behavior. Remove former spec inventories; summarize scope in What Changes. The CLI-generated `skip_specs: true` marker does not waive proposal requirements.
   - Note everything that is now inconsistent, missing, or contradictory.
   - Propose revisions to files in `existingOutputPaths`. For an artifact with no files and status `ready` or `blocked`, report that it is missing. Point to `openspec instructions "<artifact-id>" --change "<name>" --json` for creation instructions. Leave `skipped` artifacts unchanged. Do not call them missing or send them to the continue workflow.
   - A glob artifact, such as `notes/**/*.md`, becomes `done` when at least one file matches. The continue workflow handles only `ready` artifacts. To add a missing file to a glob artifact with nonempty `existingOutputPaths`:
     1. Run `openspec instructions "<artifact-id>" --change "<name>" --json`. Use `instruction` and `template`. Apply `context` and `rules` without copying them into the file. If the response says `skipped: true`, do not create it. Read current dependency files from disk. If a required non-skipped dependency is missing, stop and ask the user to restore it.
     2. Choose a new concrete path inside `changeRoot` that matches `artifactPaths.<id>.outputPath`. Resolve symlinks in parent directories. Check that the target remains inside `changeRoot` and does not exist. Do not use the glob `resolvedOutputPath` as a target.
     3. Include the new file in step 5's proposed revisions and create it only after the user confirms.
     4. Immediately before creation, refresh status and instructions. Check that the artifact remains in scope, not skipped, and partially populated. Repeat the path and existence checks.
     5. Use a create operation that fails if the file already exists. If `instruction` delegates creation, use that skill or command only if it can obey the confirmed path and conditions. Otherwise, stop. If any check fails or the confirmed draft is no longer valid, stop and discuss it with the user. Do not replace existing content or choose another path without agreement.
   - If the change is already coherent, say so and propose no revisions.

5. **Confirm and apply, one artifact at a time**
   - This step performs every artifact write in this workflow; no earlier step edits an artifact.
   - Show each proposed revision and why - including the requested edit drafted in step 4. Write only after the user confirms.
   - If the user rejects a revision, do not write it - leave that artifact unchanged.
   - When a substantial rewrite is needed, get that artifact's rules and template first:
     ```bash
     openspec instructions "<artifact-id>" --change "<name>" --json
     ```

6. **Review material planning changes**
   - If requirements or the solution changed before implementation, use the repository's `plan-review` skill before reporting readiness. Routine wording edits need no separate review.
   - Apply review corrections through step 5 within the authorized scope. Recheck affected decisions once, then report unresolved decisions. Do not repeat review cycles, create a review artifact, or start implementation.
   - Run `pnpm run openspec:validate -- "<name>"` after the revisions. Add `--draft` only for an incomplete planning prefix. Report structural failures separately from review findings.

7. **Point to the next step (guidance only - NEVER act on it)**
   - For an artifact with empty `existingOutputPaths` and status `ready` or `blocked`, run `openspec status --change "<name>" --json`. Identify the next artifact and point to `openspec instructions "<artifact-id>" --change "<name>" --json` for creation instructions.
   - Change already implemented (tasks checked off / already applied) -> the code may no longer match the revised plan; suggest `$openspec-apply-change (Codex) or /openspec-apply-change (other agents)` to carry the delta into code.
   - Everything done and implemented -> suggest `$openspec-archive-change (Codex) or /openspec-archive-change (other agents)`.

**Output**

After each invocation, show:
- Which artifacts were revised (and which proposed revisions were rejected)
- Any file created under a glob artifact that was already partially populated
- Anything deferred because it does not exist yet (artifacts with no files and status `ready` or `blocked`, never `skipped` artifacts)
- Where the change stands and the recommended next command

**Guardrails**
- Planning artifacts only - NEVER edit implementation code. If the revised plan implies code changes, stop and point to `$openspec-apply-change (Codex) or /openspec-apply-change (other agents)`.
- Use the artifact ids and paths reported by `openspec status`; never branch on hardcoded artifact names.
- Edit only the concrete files in `existingOutputPaths`; never write to a glob `resolvedOutputPath`.
- Do not create an artifact with empty `existingOutputPaths` and status `ready` or `blocked`. That requires a separate workflow. Leave `skipped` artifacts unchanged. New files require confirmed concrete paths within glob artifacts that already have output files.
- Confirm every edit with the user before writing.
- If the request changes the purpose of the change, ask for a different unused name. Recommend `openspec new change "<new-change-name>"`. Use this workflow to refine the plan within its original purpose (the "Update vs. Start Fresh" rule).
