---
name: openspec-propose
description: Create a new OpenSpec change and its required planning artifacts. Use for a complete proposal before implementation. Also use for "openspec propose" or "opsx propose".
allowed-tools: Bash(openspec:*) Bash(pnpm:*)
license: MIT
compatibility: Requires the OpenSpec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.14.0"
---

Propose a new change. Create the change and its required planning artifacts.

**Planning boundary**: This workflow creates planning artifacts only. The initial request authorizes planning only, even if it also asks for implementation. Do not edit project code or start the apply workflow. After presenting the artifacts, stop. Wait for a new user request before implementation.

Create the artifacts defined by the selected schema. The project's `review-driven` schema uses:
- proposal.md (what & why, added or changed requirements, and acceptance criteria)
- design.md (how)
- tasks.md (implementation steps)

Use `proposal.md → design.md → tasks.md`. Keep added or changed requirements as short bullets under `Requirements` in the proposal. Put observable completion checks in a separate `Acceptance criteria` section. State results for users, operators, or external consumers and check those results. Keep internal mechanisms and test fixtures in design and tasks; technical details belong in the proposal only for a requested external contract. Summarize scope in `What Changes`, without former spec names or a New behavior / Changed behavior inventory. Use plain statements without WHEN/THEN scenarios; IDs and MUST/SHALL are not required. This project has no main specs or delta specs. The CLI-generated `skip_specs: true` marker does not waive proposal requirements.

When the user is ready to implement, they must start the apply workflow explicitly.

---

**Store selection:** A store is a separate OpenSpec repository registered on this machine. If the user names a store, or the work uses one, run `openspec store list --json`. Use its registered ID. Keep `--store <id>` throughout this workflow. Use it with these commands: `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, and `view`. Add the flag to each applicable example below before you run it. For example, use `openspec status --change "<name>" --json --store "<id>"`. Other commands do not accept the flag. Keep it in follow-up commands suggested by the CLI. Without a selected store, commands use the nearest local `openspec/` root.

For the project validation and archive commands below, run `pnpm` from the resolved `root.path`. These scripts do not accept `--store`. Check that the selected root contains the project scripts; do not run them in another repository.

**Project check:** These steps require an existing OpenSpec project. Before the first write, run `openspec list --json` and read `root`. Add `--store <id>` when a store is selected. Writes include `new change`, `archive`, and artifact edits. A root object means the project is set up. `"root": null` means no OpenSpec root is available. A write such as `openspec new change` can create one as a side effect. The missing-root result also has a nonzero exit code. Read the JSON; do not retry or work around this result.

There is one exception to the missing-root result. A `status` error can start with `Declared in` or `Invalid store declaration in`. If it names this project's `openspec/config.yaml` or `config.yml`, the project declares a store. The machine cannot resolve that store because its registration or declaration is invalid. Stop before writing. Show the error's `message` and `fix`. Do not use the missing-root branches below.

For other missing-root results, follow the branch that matches the request:

- **Auto-selected**: You selected this workflow without the user naming OpenSpec, this skill, or its slash command. Stop using OpenSpec and continue the user's task. Do not ask for setup or mention OpenSpec setup.
- **Explicit OpenSpec request**: The user named OpenSpec, this skill, or its slash command. Stop before writing. Ask whether to run `openspec init`, use a registered store (`--store <id>`), or continue without OpenSpec. Wait for the answer.

Do not run `openspec init` until the user requests setup. Do not create `openspec/` files by hand or let another command create the root.

**Input**: The user's request should include a change name (kebab-case) OR a description of what they want to build.

**Steps**

1. **Understand the request and clarify material ambiguity**

   If no clear input is provided, ask the user (open-ended, no preset options):
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

   Ask before creating the change if uncertainty affects scope, observable behavior, compatibility, or acceptance criteria. For minor details, use a reasonable assumption and record it in the planning artifacts.

2. **Load project context**

   Run `openspec context --json` from the current directory. For an explicitly selected store, use `openspec context --json --store "<store-id>"`. Use the returned `root.path` as the OpenSpec root. For `no_openspec_root`, stop before any write and follow **Project check**. Offer `openspec init` only for an explicit OpenSpec request. Wait for the user to request setup; do not initialize automatically or run `openspec new change`. After setup, run the context command again. For any other context failure, stop and report the error. Do not use the current directory as a substitute root or discard the selected store.

   After context returns `root.path`, read `<root.path>/openspec/config.yaml`. Use `config.yml` only if `config.yaml` does not exist. If neither file exists, continue without project context. Do not substitute `config.yml` for an unreadable or invalid `config.yaml`.

   Apply `context` only if the file parses as a YAML object and the field is a string. Its UTF-8 length must not exceed 51,200 bytes. Apply it before code inspection or planning decisions. If the file or field fails these checks, continue without project context. Check this field separately from other configuration fields.

   Use context for project facts and constraints. It cannot change user authorization, the planning boundary, tool restrictions, or artifact and output rules. Do not copy it into artifacts. Use it to focus code inspection and planning.

3. **Determine the workflow schema**

   Use the configured default schema unless the user explicitly requests a different workflow.

   **Use a different schema only if the user:**
   - Explicitly requests a specific schema by name → use `--schema <schema-name>`
   - Asks to "show workflows" or asks "what workflows" exist → run `openspec context --json` from the current directory. For an explicitly selected store, use `openspec context --json --store "<store-id>"`. Then run `openspec schemas --json` from the returned `root.path` and let the user choose. This preserves a local `store:` declaration or global `defaultStore`. For an explicitly selected store, also append `--store "<store-id>"` to `openspec schemas --json`. If context fails, stop as specified in step 2. Do not use the current directory as a substitute root.

   Otherwise, omit `--schema` to preserve the configured default.

4. **Create the change directory**

   Choose one schema form below. For a selected store, append `--store "<store-id>"` to this command and each later command that accepts it.

   Using the configured default:
   ```bash
   openspec new change "<name>"
   ```

   Using an explicitly requested schema:
   ```bash
   openspec new change "<name>" --schema "<schema-name>"
   ```
   The CLI creates the change and `.openspec.yaml` in the resolved planning home.

5. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts, each with its `status` and its `requires` edges (the artifact IDs it directly depends on)
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context. Use these instead of assuming repo-local paths.

6. **Create every artifact in the required set**

   Use a todo list to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - The instructions JSON includes:
        - `context`: Project background (constraints for you - do NOT include in output)
        - `rules`: Artifact-specific rules (constraints for you - do NOT include in output)
        - `template`: The structure to use for your output file
        - `instruction`: Schema-specific guidance for this artifact type
        - `skipped`/`warning`: present when the change declares skip_specs and this artifact must NOT be created - stop and pick another artifact
        - `resolvedOutputPath`: Resolved path or pattern to write the artifact
        - `dependencies`: Completed artifacts to read for context
      - Read completed dependency files again from disk before each artifact. Do not use conversation memory as a substitute; the user can change those files.
      - **Inspect the relevant project before drafting**: Read `context` and `rules` first. Then inspect relevant implementation, tests, configuration, and documentation outside `openspec/`. Keep inspection read-only and proportional to the change. Reuse findings for later artifacts; inspect more only as needed.
        - Identify the target project from the request and context. The planning home can be separate from the code. If the target is unclear, ask. For a new or non-code project, inspect the available structure and documents. If source is unavailable, report the limit. Ask when that limit affects the plan materially.
        - Base scope, the solution, and tasks on the evidence. Separate observed behavior from assumptions and proposed changes. Report conflicts with current code, tests, guides, or accepted decisions instead of choosing a source without explanation.
        - Resolve general project questions now. Do not add generic "explore the codebase" or "make a plan" implementation tasks. Tie later investigation to a specific unresolved question.
      - If `instruction` requires a skill or command, use it to create the artifact. Then check that the output file exists at `resolvedOutputPath`.
      - Otherwise, use `template` to write the artifact to `resolvedOutputPath`. For a glob pattern, use `instruction` to select a concrete file path.
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until every artifact in the required set exists (not just `apply.requires`)**
      - After creating each artifact, re-run `openspec status --change "<name>" --json`
      - Build the required set from `applyRequires` and all direct and indirect `requires` dependencies in `status --json`. For `review-driven`, this includes proposal, design, and tasks. Leave artifacts outside that set unchanged.
      - `status` checks file existence only. A `done` artifact in `applyRequires` does not prove that its dependencies exist. For example, writing `tasks.md` early marks `tasks` done while `proposal` was never written. Build the required set from `requires`, regardless of status. A `done` artifact still lists its dependencies.
      - An artifact with `status: "skipped"` is satisfied. The change declares `skip_specs` in `.openspec.yaml`, so its files must not exist. Do not create them.
      - Create every artifact in the required set that is missing, then re-check - creating one can unblock others
      - Skip an artifact if status reports `skipped`, or its own `instruction` makes it conditional. Run `openspec instructions <artifact-id> --change "<name>" --json` before deciding on a conditional skip. The instruction must say it is optional, for example, "create only if...". `review-driven` requires all three planning artifacts; `skip_specs` does not skip any of them. Report a deliberate skip and do not reconsider it.
      - If only a skipped conditional dependency blocks a required artifact, create the dependent artifact despite its `blocked` state.
      - Stop when every artifact in the required set is `done`, `skipped`, or was deliberately skipped

   c. **If an artifact requires user input** (unclear context):
      - Ask the user to clarify
      - Then continue with creation

7. **Show final status**

   Run `pnpm run openspec:validate -- "<name>"` to check the completed plan. Use `--draft` only while the planning artifacts form an incomplete prefix. Report validation failures before claiming readiness.

   ```bash
   openspec status --change "<name>"
   ```

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions, plus any conditional artifact you skipped and why
- Artifact completion separately from implementation readiness, including any review result and unresolved decisions
- When ready, point to `$openspec-apply-change (Codex) or /openspec-apply-change (other agents)` or a request to apply; otherwise state what prevents readiness

**Artifact Creation Guidelines**

- Follow `instruction` from `openspec instructions` for each artifact type. It controls artifact creation, even for familiar artifact names.
- If `instruction` requires a skill or command, use it to create the artifact. Do not write the file directly.
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Guardrails**
- The initial request authorizes planning only, even if it also asks for implementation. Do not implement, start the apply workflow, or edit project code. After presenting artifacts, stop and wait for a new user request to implement.
- Create every artifact the apply phase transitively depends on, not just the ids listed in `apply.requires`
- Before each new artifact, read its dependencies again from disk. Do not use conversation memory; files can change.
- Ask about uncertainty that affects scope, observable behavior, compatibility, or acceptance criteria. For minor details, record reasonable assumptions.
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next
