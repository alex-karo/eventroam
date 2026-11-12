---
type: Guide
title: Change workflow
description: Plan, implement, and review project changes.
status: stable
tags: [development]
---

# Change workflow

Read the affected code, tests, current guides, and configuration before editing. Inspect the working tree and preserve unrelated changes. Follow the [module boundaries](project-structure.md#boundaries), validate external input at runtime, and review generated migrations.

Before handoff, run focused tests and applicable checks, then report the result and remaining uncertainty. Run `pnpm run docs:check` for documentation edits and `pnpm run openspec:validate` for OpenSpec edits.

## Choose a workflow

Use fast track for changes with a clear result, local scope, and low risk. Examples include bug fixes that restore specified behavior, internal refactors, test and documentation edits, and small UI changes. Implement the change directly. Update current guides when their steps or lasting rules change. Fast track requires no OpenSpec change folder, planning artifacts, or separate plan review.

Use the full OpenSpec workflow when the user asks for it or when the work:

- Adds a capability or changes a contract that users, operators, or other systems rely on in a material way.
- Has a material risk to stored data, security, or privacy.
- Needs a product decision or a design decision that affects several components and is still open.

If a fast track task reveals one of these conditions, use OpenSpec for the affected work before you implement it.

For full OpenSpec, use `proposal.md → design.md → tasks.md`, then implement, review, clean up, verify, and archive. In Codex, use the corresponding `$openspec-*` skills. Keep unresolved choices in [draft proposals](proposals/).

## Update documentation

Correct statements that the change makes incorrect. Update a guide when the change affects steps that readers follow. Add information only when it helps a reader perform a specific task or understand a lasting rule or decision. Put the information in the document that owns it. Link to that source when other documents need to refer to it. Leave documentation unchanged when none of these conditions apply.

- A change proposal defines its added or changed requirements and acceptance criteria. It does not describe the whole product. Archived proposals record history and can become outdated.
- Code, tests, and current guides describe implemented behavior. Check the code for exact contracts.
- Guides explain how to use, develop, operate, or diagnose the system.
- Code defines implementation details. Use a comment or design note if a reader needs a reason that the code does not show.
- Put results of checks and temporary notes about the change in the PR or handoff.

## Plan a behavior change

New OpenSpec changes use the project-local [review-driven schema](../openspec/schemas/review-driven/schema.yaml). It requires proposal, design, and tasks in that dependency order. Match design and task detail to risk and uncertainty. Do not add a change-size label or assessment.

Use each artifact for its own task:

| Artifact | Guidance |
| --- | --- |
| Proposal | Explain the problem, scope, and impact. Add short requirements for users, operators, or external consumers and a separate Acceptance criteria list. Keep implementation choices out. |
| Design | Give the overview in `TL;DR`, then explain the details. Show changed contracts as code and useful architecture views in Mermaid. Omit sections that add no useful information. |
| Tasks | Describe reviewable outcomes and checks. Refer to the design instead of copying it. |

Keep `TL;DR` first in the design. Write or revise it after the detailed design so it reflects the complete solution. Make it a compact, structured overview that makes sense on its own:

- State the intended result and core idea.
- Show the main flow or responsibilities.
- Include only constraints or trade-offs needed to understand the solution.

Use labeled bullets, short paragraphs, or a small Mermaid diagram. Combine text and a diagram when useful. Choose the structure that fits the change; there are no fixed labels or sentence counts. Put supporting evidence, exact contracts, and decision details in the sections below. A simple design can end after `TL;DR` if no further detail is needed. When the design changes, update the overview to match.

Code owns exact data shapes and signatures. In design's `Contracts` section, use short fenced code blocks with a language tag for proposed changes. Mark proposed code and link to existing source definitions. Add prose only for meaning that code cannot express; do not repeat fields or full schemas. The proposal owns observable validation rules, errors, and value meaning for the change.

Use Mermaid in design when a diagram makes component boundaries, data flow, or ownership easier to understand. Use a sequence diagram when order matters. Keep diagrams small and label interactions. Explain only what the diagram does not show.

Keep added or changed requirements short and use consistent domain terms. State the result for a user, operator, or external consumer. Put checks of those observable results in a separate `Acceptance criteria` section. Keep internal data structures, execution steps, and test fixtures in design or tasks. A technical detail belongs in the proposal only when it defines a requested external contract. For example, a reader keeps access through an old public URL; design explains how an alias is stored.

Use plain bullet statements without WHEN/THEN scenarios; IDs and MUST/SHALL are not required. Summarize scope in `What Changes`, without a `New behavior` / `Changed behavior` inventory or former spec names and paths. Include failure and boundary cases only when they define distinct behavior. Require exact UI text only when it is part of the contract. Preserve behavior outside the approved change and refer to current sources instead of restating the whole product.

Before handoff, remove text that does not help a reader assess or implement the design. Keep necessary reasons and constraints. Use direct wording instead of dense shorthand.

Use ASD-STE100 Simplified Technical English for plans, whether they live in chat, a design document, or OpenSpec. Keep required headings, keywords, and technical names exact. Explain the observable change and main flow before implementation details. Identify what existing code or dependencies already do and what the application must add. Distinguish requested outcomes, accepted contracts, and newly proposed guarantees; writing a guarantee into a proposal does not establish its acceptance. For significant additional mechanisms, explain the concrete consumer/scenario and why existing capabilities are insufficient.

Compare the smallest credible solution with the proposed design. Discuss useful alternatives beside the choice in `Key decisions`; omit them when none are useful. Consider removing mechanisms as well as reorganizing them. When a simpler option reduces scope, name the lost behavior, affected consumers, and implementation/test burden avoided; changing an accepted guarantee still needs agreement. Check that a reader can explain the idea, flow, ownership and key trade-offs from the plan alone. Rewrite missing explanations in their owning sections rather than adding a separate summary document.

Keep each design coherent by folding corrections into the relevant sections. Proposed tests must detect meaningful failures that existing checks do not cover. Do not repeat dependency algorithm tests without a concrete application integration risk. Active changes use `review-driven` in their `.openspec.yaml`. The writing rules in [project configuration](../openspec/config.yaml) apply to new or revised text. Do not rewrite historical artifacts only to match a template.

After editing the custom schema or templates, run `pnpm exec openspec schema validate review-driven` as well as the documentation and OpenSpec checks. The local schema does not automatically inherit upstream changes.

## Validate and archive changes

Use native OpenSpec for creation, status, and instructions:

```sh
pnpm exec openspec new change <name>
pnpm exec openspec status --change <name> --json
pnpm exec openspec instructions proposal --change <name> --json
pnpm exec openspec instructions apply --change <name> --json
```

Get instructions for each document before writing it. Read its dependencies.
Artifact status shows file presence; it does not prove content quality or implementation.
Apply requires all three documents.

In `proposal.md`, use non-empty bullet lists under `## Requirements` and
`## Acceptance criteria`. Describe only added or changed results for users,
operators, or external consumers and checks that show completion. Keep them short,
without implementation steps, scenario blocks, or mandatory IDs.
Code examples and comments do not count. Use the
[proposal template](../openspec/schemas/review-driven/templates/proposal.md).

```sh
pnpm run openspec:validate -- <name>
pnpm run openspec:validate
pnpm run openspec:validate -- --draft
pnpm run test:openspec
pnpm run openspec:archive -- <name>
```

Full validation checks the local schema and all three documents for the selected
change, or every active change when no name is supplied. It checks proposal structure;
review and verification check meaning and implementation. Unfinished implementation
tasks do not fail normal validation. CI uses draft mode: a change can have any
complete prefix of the chain, including a new empty scaffold. Existing documents
must be valid and cannot omit a predecessor.

The project archive command requires full validation and native apply state
`all_done`, including at least one tracked task. Native OpenSpec then supplies date
naming, collision checks, and the move. The command preserves all three documents
and metadata. It uses native `--skip-specs --no-validate --yes` after project checks;
upstream delta validation cannot validate this proposal format. Do not call native archive directly
or move a change by hand. There is no spec synchronization step.

Native creation can add an empty specs directory and `skip_specs: true`. The marker
means there are no upstream deltas; it does not mean behavior is unchanged and does
not waive proposal checks. No main spec or separate PRD files are maintained.
Active changes with a leftover `prd.md` fail validation so requirements cannot be ignored.
Older archives retain their other artifacts without new planning documents. Project validation checks
active changes; archive checks its input before the move, not later history edits.

## Review plans and code

For full OpenSpec changes, use the repository's [plan-review skill](../.agents/skills/plan-review/SKILL.md) with `$plan-review <plan or change-name>` before implementation or after material planning changes. The review-driven schema calls for review before a substantive plan is presented as ready. Apply supported improvements within the authorized planning scope and report material scope decisions. The skill owns the review procedure and reporting rules. Use `openspec-verify-change` for completed OpenSpec changes.

Use the project-local [code-review skill](../.agents/skills/code-review/SKILL.md) with `$code-review` to review changes and fix clear bugs and simple improvements. Use `$complex-code-review` for review only. The linked skills define delegation, finding outcomes, and repeat-review conditions.

After implementation of a full OpenSpec change, use the project-local [project-cleanup skill](../.agents/skills/project-cleanup/SKILL.md) with `$project-cleanup <change-name>` before final verification and archive. The agent finds and applies safe cleanup, removes unnecessary code and tests, and compares custom mechanisms with framework features. Substantial changes and changes to requirements need user confirmation. After cleanup, verify the final implementation against the proposal requirements and acceptance criteria.

Use the project-local [docs-refactor skill](../.agents/skills/docs-refactor/SKILL.md) for substantive documentation reviews or cleanup. Select `review` for findings only or `refactor` for edits.

## Product reference

Eventmap is a read-only product reference. Do not modify it or copy its implementation wholesale. Follow this project's accepted requirements and dependency choices.
