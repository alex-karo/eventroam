---
name: openspec-verify-change
description: Check that an implementation matches its OpenSpec artifacts before archive. Use to check completion, correctness, and design agreement. Also use for "openspec verify" or "opsx verify".
allowed-tools: Bash(openspec:*) Bash(pnpm:*)
license: MIT
compatibility: Requires the OpenSpec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.14.0"
---

Verify that an implementation matches the change artifacts (proposal, tasks, design).

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

   When prompting, show all active changes returned by the list, including changes with `status: "no-tasks"`.
   Include the schema used for each change if available.
   Mark changes with incomplete tasks as "(In Progress)".

   Always announce: "Using change: <name>" and how to override (e.g., `$openspec-verify-change (Codex) or /openspec-verify-change (other agents) <other>`).

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "review-driven")
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - Which artifacts exist for this change

3. **Get planning context and load artifacts**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   The response includes the change directory, `contextFiles`, `taskTrackingConfigured`, and top-level `tasks` and `progress`. `contextFiles` maps artifact IDs to arrays of concrete paths. `tasks` and `progress` combine readable files selected by the schema's `apply.tracks` value. Read every available artifact from `contextFiles`.

   Treat apply `state` and `instruction` as context, not a verification verdict. Do not implement tasks or archive the change during verification.

4. **Initialize verification report structure**

   Create a report structure with three dimensions:
   - **Completeness**: Track tasks and requirement coverage
   - **Correctness**: Track requirement implementation and acceptance criteria coverage
   - **Coherence**: Track design adherence and pattern consistency

   Each dimension can have CRITICAL, WARNING, or SUGGESTION issues.

   Verification gives advice. Respect optional artifacts and schemas without task tracking. In `review-driven`, proposal, design, and tasks are required. The CLI-generated `skip_specs: true` marker does not waive proposal checks. Do not require intentionally omitted or optional artifacts to obtain a clean report. `Not verified` describes missing evidence, not a new archive prerequisite. Archive retains its own checks and confirmation rules.

   Use **Not applicable** for checks absent from the schema or intentionally skipped by artifact status. Exclude these checks from skipped-check counts and the readiness assessment. Use **Not verified** when a check applies but evidence is missing or unusable.

   If only task evidence is available, check task completion only. Mark all other applicable checks, including **Code Pattern Consistency**, as not verified. Use the reason "Only task evidence available".

   If artifacts are unreadable or unusable, mark the affected checks as not verified and give the reason. Check what the remaining evidence supports. Do not report a partially checked input set as fully verified. Missing requirements affect Requirement Coverage and Requirement Implementation Mapping. Missing acceptance criteria affect Acceptance Criteria Coverage; missing design decisions affect Design Adherence.

5. **Verify Completeness**

   **Task Completion**:
   - If `taskTrackingConfigured` is false, report **Task Completion** as not applicable. Do not treat empty `tasks` as missing evidence.
   - Otherwise, use top-level `tasks` and `progress`. They combine readable files selected by `apply.tracks`, regardless of artifact ID. Do not infer tracking from a `contextFiles` key.
   - If `unavailableTrackingFiles` is nonempty, report **Task Completion** as not verified. List every unavailable path and reason. Use readable evidence, but do not infer full completion from partial `tasks` and `progress`.
   - If tracking is configured but `tasks` is empty, report **Task Completion** as not verified. Use the reason from apply `state` and `instruction`. Nonzero totals do not provide usable task descriptions.
   - Report complete vs total tasks from `progress`.
   - If `progress.remaining` is greater than 0:
     - Add a CRITICAL issue for each listed incomplete task. Compare `progress.remaining` with the number of listed tasks where `done` is false. If `progress.remaining` is greater, also report incomplete checkboxes without descriptions. Recommend descriptions and completion for those tasks. Do not infer full completion from the listed tasks alone.
     - Recommendation: "Complete task: <description>" or "Mark as done if already implemented"

   **Requirement Coverage**:
   - For `review-driven`, read requirements and acceptance criteria from the proposal even when `.openspec.yaml` declares `skip_specs: true`. There is no separate requirements artifact.
   - Use the active schema's artifact IDs in `contextFiles`. If `contextFiles.proposal` is absent, empty, unreadable, or unusable, three checks are not verified: **Requirement Coverage**, **Requirement Implementation Mapping**, and **Acceptance Criteria Coverage**. Do not report these checks as passed.
   - Run `pnpm run openspec:validate -- "<name>"`. Report structural failures separately from implementation findings. Use `--draft` only to inspect an incomplete planning prefix; it does not prove readiness.
   - Read the short requirement bullets under `## Requirements` and the separate `## Acceptance criteria` list in the proposal. Check observable results for users, operators, or external consumers; use design for internal mechanisms. Report misplaced implementation details separately from missing behavior. Do not require IDs, MUST/SHALL, or WHEN/THEN scenarios.
   - For each requirement:
     - Search the codebase for related behavior and assess whether implementation exists.
     - Check the required result after a removal or rename, as stated in the proposal. Do not recommend restoring behavior that the proposal removes.
     - If the required result appears unimplemented:
       - Add CRITICAL issue: "Requirement not found: <text and location>"
       - Recommendation: "Implement requirement: <description>"

6. **Verify Correctness**

   **Requirement Implementation Mapping**:
   - For each requirement in the proposal, use the checks below:
     - Search codebase for implementation evidence
     - If found, note file paths and line ranges
     - Assess if implementation matches requirement intent
     - If divergence detected:
       - Add WARNING: "Implementation may diverge from proposal: <details>"
       - Recommendation: "Review <file>:<lines> against requirement X"

   **Acceptance Criteria Coverage**:
   - For each bullet in the proposal's separate `## Acceptance criteria` section:
     - Check if conditions are handled in code
     - Check if tests or other checks cover the acceptance criterion
     - If an acceptance criterion appears uncovered:
       - Add WARNING: "Acceptance criterion not covered: <text and location>"
       - Recommendation: "Add test or implementation for acceptance criterion: <description>"

7. **Verify Coherence**

   **Design Adherence**:
   - If the schema defines no design artifact, report **Design Adherence** as not applicable.
   - If `contextFiles.design` exists:
     - Read decisions throughout the document, including `TL;DR`, `Key decisions`, and `Architecture`. Do not depend on section names.
     - Verify implementation follows those decisions
     - If contradiction detected:
       - Add WARNING: "Design decision not followed: <decision>"
       - Recommendation: "Update implementation or revise design.md to match reality"
   - If applicable design evidence is absent, empty, or unusable, report **Design Adherence** as not verified. Continue **Code Pattern Consistency** when other evidence supports it. The task-only case remains limited to task completion.

   **Code Pattern Consistency**:
   - If implementation changes cannot be identified, mark **Code Pattern Consistency** as not verified and explain the missing evidence.
   - Otherwise, review new code for consistency with project patterns
   - Check file naming, directory structure, coding style
   - If significant deviations found:
     - Add SUGGESTION: "Code pattern deviation: <details>"
     - Recommendation: "Consider following project pattern: <example>"

8. **Generate Verification Report**

   **Summary Scorecard**:
   ```markdown
   ## Verification Report: <change-name>

   ### Summary
   | Dimension    | Status           |
   |--------------|------------------|
   | Completeness | X/Y tasks, N reqs|
   | Correctness  | M/N reqs covered |
   | Coherence    | Followed/Issues  |
   ```

   In each Status cell, report completed checks and `Not verified (<reason>)` for each skipped check. If all applicable checks in a dimension were skipped, start with `Not verified`. Do not count a skipped or partially verified check as passed. Count the proposal requirements in N. Identify requirements and acceptance criteria by their text and source location when reporting coverage and missing evidence.

   **Issues by Priority**:

   1. **CRITICAL** (Must fix before archive):
      - Incomplete tasks
      - Missing requirement implementations
      - Each with specific, actionable recommendation

   2. **WARNING** (Should fix):
      - Proposal/design divergences
      - Missing acceptance criteria coverage
      - Each with specific recommendation

   3. **SUGGESTION** (Nice to fix):
      - Pattern inconsistencies
      - Minor improvements
      - Each with specific recommendation

   **Final Assessment**:
   - If CRITICAL issues: "X critical issue(s) found. Fix before archiving." If any check was skipped, also name every skipped check and its reason.
   - If no CRITICAL issues, one or more warnings, and no checks were skipped: "No critical issues. Y warning(s) to consider. Ready for archive (with noted improvements)."
   - If only suggestions and no checks were skipped: "No critical issues or warnings. Z suggestion(s) to consider. Ready for archive (with noted improvements)."
   - If no issues and no checks were skipped: "All checks passed. Ready for archive."
   - If any check was skipped and there are no CRITICAL issues: do not claim readiness. Say "No critical issues found in the checks that ran. <check(s)> not verified: <reason>." Include the warning count when nonzero.
   - Include the suggestion count when nonzero in every final assessment.

**Verification Heuristics**

- **Completeness**: Focus on objective checklist items (checkboxes, requirements list)
- **Correctness**: Use keyword search, file path analysis, reasonable inference - don't require perfect certainty
- **Coherence**: Focus on significant differences. Do not report wording or style preferences.
- **False Positives**: When uncertain, prefer SUGGESTION over WARNING, WARNING over CRITICAL
- **Actionability**: Give each issue a specific correction and file/line references where available.

**Output Format**

Use clear markdown with:
- Table for summary scorecard
- Grouped lists for issues (CRITICAL/WARNING/SUGGESTION)
- Code references in format: `file.ts:123`
- Specific, actionable recommendations
- No vague suggestions like "consider reviewing"
