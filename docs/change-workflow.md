---
type: Guide
title: Change workflow
description: Plan, implement, and review project changes.
status: stable
tags: [development]
---

# Change workflow

Read the relevant spec, nearby tests, and configuration before editing. Inspect the working tree and preserve unrelated changes. Follow the [module boundaries](project-structure.md#boundaries), validate external input at runtime, and review generated migrations. Keep code, tests, specs, and documentation aligned when changing a contract.

For behavior changes, use the standard OpenSpec workflow: explore or propose, define testable delta specs, add design and tasks, implement, verify, synchronize main specs, and archive. In Codex, use the corresponding `$openspec-*` skills; use `pnpm exec openspec` for the project-local CLI. Group capabilities under `catalog/`, `website/`, or `operations/`, with matching main and delta paths. Keep unresolved choices in [draft proposals](proposals/) and lasting technology decisions in ADRs.

Before handoff, run focused tests and applicable checks, then report the result and remaining uncertainty. Run `docs:check` for documentation edits and `openspec:validate` for OpenSpec edits.

## Plan a behavior change

New changes use the project-local [review-driven schema](../openspec/schemas/review-driven/schema.yaml), forked from OpenSpec 1.14.0's `spec-driven` schema. It keeps the proposal/specs/design/tasks workflow and requires a design for every change. Start with Small, Medium, or Large and a short reason based on coupling, risk, and verification effort. Scale design and tasks to that assessment; small changes can use a few paragraphs and focused steps.

Use each artifact for its own task:

| Artifact | Guidance |
| --- | --- |
| Proposal | Show Before and After for each Modified Capability. Base Before on the main spec; note known implementation differences. |
| Delta specs | Define detailed, testable conditions. |
| Design | State each choice, reason, and material trade-off once. Usually 2–3 sentences per decision are enough; add detail for concrete risk or complexity. |
| Tasks | Describe reviewable outcomes and checks. Refer to the design instead of copying it. |

Before handoff, remove text that does not help a reader assess or implement the design. Keep necessary reasons and constraints. Use direct wording instead of dense shorthand.

Write plans in plain English, whether they live in chat, a design document, or OpenSpec. Explain the observable change and main flow before implementation details. Identify what existing code or dependencies already do and what the application must add. Distinguish requested outcomes, accepted contracts, and newly proposed guarantees; writing a guarantee into a spec does not establish its acceptance. For significant additional mechanisms, explain the concrete consumer/scenario and why existing capabilities are insufficient.

Compare the smallest credible solution with the proposed design. Consider removing mechanisms as well as reorganizing them. When a simpler option reduces scope, name the lost behavior, affected consumers, and implementation/test burden avoided; changing an accepted guarantee still needs agreement. Check that a reader can explain the idea, flow, ownership and key trade-offs from the plan alone. Rewrite missing explanations in their owning sections rather than adding a separate summary document.

Keep each design coherent by folding corrections into the relevant sections. Proposed tests must detect meaningful failures that existing checks do not cover. Do not repeat dependency algorithm tests without a concrete application integration risk. Existing changes retain the schema recorded in their `.openspec.yaml`.

After editing the custom schema or templates, run `pnpm exec openspec schema validate review-driven` as well as the documentation and OpenSpec checks. The local fork does not automatically inherit future upstream schema changes.

## Review plans and code

Use the repository's [plan-review skill](../.agents/skills/plan-review/SKILL.md) with `$plan-review <plan or change-name>` before implementation or after material planning changes. The review-driven schema calls for review before a substantive plan is presented as ready. Apply supported improvements within the authorized planning scope and report material scope decisions. The skill owns the review procedure and reporting rules. Use `openspec-verify-change` for completed implementation.

Use the project-local [code-review skill](../.agents/skills/code-review/SKILL.md) with `$code-review` to review changes and fix clear bugs and simple improvements. Use `$complex-code-review` for review only. The linked skills define delegation, finding outcomes, and repeat-review conditions.

After spec implementation, use the project-local [project-cleanup skill](../.agents/skills/project-cleanup/SKILL.md) with `$project-cleanup <change-name>` before final verification and archive. The agent finds and applies safe cleanup, removes unnecessary code and tests, and compares custom mechanisms with framework features. Substantial changes and changes to requirements need user confirmation. After cleanup, verify the final implementation against the specs.

Use the project-local [docs-refactor skill](../.agents/skills/docs-refactor/SKILL.md) for substantive documentation reviews or cleanup. Select `review` for findings only or `refactor` for edits.

## Product reference

Eventmap is a read-only product reference. Do not modify it or copy its implementation wholesale. Follow this project's specs and dependency choices.
