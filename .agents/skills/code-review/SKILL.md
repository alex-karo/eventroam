---
name: code-review
description: Review project changes with an Astra subagent, fix clear bugs and simple improvements, and bring all remaining findings to the user for a decision. Use for review with fixes; use complex-code-review for review only.
---

# Code Review

Use [complex-code-review](../complex-code-review/SKILL.md) in an Astra subagent.
The parent agent owns fixes, checks, and the final report. Review agents do not
edit files. A request to use this skill includes the fixes described below.
An explicit user limit, such as review only, takes precedence.

## Set the scope and start the review

Read repository instructions and establish the requested base and target. Record
commit IDs, or the base and staged, unstaged, and relevant untracked changes.
Preserve unrelated work. Do not edit the review target while the review runs.

Start a fresh subagent with `model: "gpt-6-astra"` and `fork_turns: "none"`.
Give it the absolute path to the project-local `complex-code-review/SKILL.md`,
the review scope, original requested result, accepted requirements and decisions,
relevant paths, and checks already run. Tell it to use that skill, including its
specialist and verifier agents. Those agents follow its role and dispatch rules.
Wait for its completed report before making fixes.

Ask the review coordinator to return all candidate and proposal IDs, including
merged aliases and dismissed candidates with reasons. This compact record is
needed to account for every observation. It does not need a separate file.

If Astra or delegation is unavailable, report that limit. Do not silently use
another model or call a self-review an Astra review. Continue checks and clear
fixes supported by available evidence; bring the missing review to the user.

## Account for every finding

Read the source and evidence for each returned finding before choosing an action.
Keep its ID and assign one of these outcomes:

- **Fixed:** state the change and the check that supports it.
- **Discussion needed:** state the evidence, impact, proposed action, cost or
  uncertainty, and the concrete decision needed from the user.
- **Refuted:** record decisive source or test evidence. If the evidence is
  uncertain, use discussion needed. A preference or low priority is not a refutation.
- **Duplicate:** link the canonical ID. It must have one of the other outcomes.

Include dismissed candidates in this record with their evidence. Reopen them if
the evidence does not hold. Do not silently drop a finding, improvement, design
proposal, test gap, or unresolved risk. A supported finding must be fixed or
brought to discussion, even if it does not block acceptance. Refuted claims and
duplicates remain visible but do not require a needless code change.

## Apply clear fixes

Fix confirmed bugs when the required behavior and a narrow correction are clear.
Apply small corrections and clear simplifications when they preserve accepted
behavior, have a clear net benefit, and can be checked with focused validation.
Severity alone does not make a fix safe to apply without discussion.

Bring high-effort changes and uncertain improvements to discussion. Consider the
affected modules and consumers, data changes, coupling, regression risk, and
validation cost. Line count alone does not measure effort. State a preferred
option and its trade-offs so the user can make a concrete decision.

Always discuss simplifications that remove or change requirements, guarantees,
validation, or user-visible scope. Do not rewrite specs or weaken tests to make
a finding disappear. Use the project's OpenSpec workflow when an agreed fix
changes a contract. A correction that restores an accepted contract does not
itself authorize a new requirement.

Complete independent, clear fixes before asking for decisions. Keep changes
local to the reviewed work. Do not commit, push, publish comments, or merge as
part of this skill unless the user also requested that action.

## Validate and decide on a second review

Run checks suited to the fixes. Add a regression test when it detects a meaningful
failure that existing checks miss. Do not add tests that only repeat the
implementation. Apply repository checks for changed docs and OpenSpec artifacts.
Record failures and material limits; do not mark an unverified fix as verified.

Count unique findings in the first report after merging duplicates and removing
claims refuted with evidence. Include improvements, design proposals, and
unresolved risks. When this count is **4 or more** and fixes were made, run one
more review with `complex-code-review` in a fresh Astra subagent after checks.
Also run it for fewer findings if fixes change a shared contract, transaction,
security boundary, or another flow with substantial regression risk.

Review the full updated scope, including the fixes. Give the agent the original
goal and accepted constraints. Ask it to form findings before reconciling the
prior issue record, then check fix completeness and regressions. Prefix IDs with
the pass number, such as `R1/COR1` and `R2/COR1`, and map repeated findings to
their original IDs. This prevents ID collisions and duplicate counting.

Handle every second-pass finding by the same rules. Run focused checks after any
further fixes, then stop. Do not start a third automatic review. Report remaining
risks and decisions. If no fixes were made, explain why the second pass was not
needed or could not proceed.

## Report

Lead with the current result: fixes complete, decisions needed, or review/checks
incomplete. Separate the final state from the first review's verdict.

Give a compact outcome record for all IDs, grouping duplicates and refuted claims
when useful. Include checks and results, review pass count, scope, and any drift
or missing coverage. State user decisions as concrete options with a recommended
choice and consequences. Do not claim completion while a supported finding has
no fix or explicit discussion item.
