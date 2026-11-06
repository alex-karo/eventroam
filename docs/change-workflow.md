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

Specifications describe only behavior that a user, operator, or another system can observe. This includes public interfaces and operational results, not only UI. Keep internal choices, such as folder names, storage layout, prompt wording, and agent handoffs, in design or implementation documentation. An internal change that preserves external behavior does not need a new specification requirement.

Before handoff, run focused tests and applicable checks, then report the result and remaining uncertainty. Run `docs:check` for documentation edits and `openspec:validate` for OpenSpec edits.

## Plan a behavior change

New changes use the project-local [review-driven schema](../openspec/schemas/review-driven/schema.yaml), forked from OpenSpec 1.14.0's `spec-driven` schema. It keeps the proposal/specs/design/tasks workflow and requires a design for every change. Match design and task detail to risk and uncertainty. Do not add a change-size label or assessment.

Use each artifact for its own task:

| Artifact | Guidance |
| --- | --- |
| Proposal | Show Before and After for each Modified Capability. Base Before on the main spec; note known implementation differences. |
| Delta specs | Define observable rules and concrete scenarios. Keep implementation choices out. |
| Design | Give the overview in `TL;DR`, then explain the details. Show changed contracts as code and useful architecture views in Mermaid. Omit sections that add no useful information. |
| Tasks | Describe reviewable outcomes and checks. Refer to the design instead of copying it. |

Keep `TL;DR` first in the design. Write or revise it after the detailed design so it reflects the complete solution. Make it a compact, structured overview that makes sense on its own:

- State the intended result and core idea.
- Show the main flow or responsibilities.
- Include only constraints or trade-offs needed to understand the solution.

Use labeled bullets, short paragraphs, or a small Mermaid diagram. Combine text and a diagram when useful. Choose the structure that fits the change; there are no fixed labels or sentence counts. Put supporting evidence, exact contracts, and decision details in the sections below. A simple design can end after `TL;DR` if no further detail is needed. When the design changes, update the overview to match.

Code owns exact data shapes and signatures. In design's `Contracts` section, use short fenced code blocks with a language tag for proposed changes. Mark proposed code and link to existing source definitions. Add prose only for meaning that code cannot express; do not repeat fields or full schemas. Specs own observable validation rules, errors, and value meaning.

Use Mermaid in design when a diagram makes component boundaries, data flow, or ownership easier to understand. Use a sequence diagram when order matters. Keep diagrams small and label interactions. Explain only what the diagram does not show.

Use one observable rule per new requirement and consistent domain terms. Give each scenario a concrete trigger and result. Include failure and boundary cases when they define different behavior. Require exact UI text only when that text is part of the contract. When modifying an existing requirement, preserve its full block and scenarios except for the intended behavior change.

Before handoff, remove text that does not help a reader assess or implement the design. Keep necessary reasons and constraints. Use direct wording instead of dense shorthand.

Use ASD-STE100 Simplified Technical English for plans, whether they live in chat, a design document, or OpenSpec. Keep required headings, keywords, and technical names exact. Explain the observable change and main flow before implementation details. Identify what existing code or dependencies already do and what the application must add. Distinguish requested outcomes, accepted contracts, and newly proposed guarantees; writing a guarantee into a spec does not establish its acceptance. For significant additional mechanisms, explain the concrete consumer/scenario and why existing capabilities are insufficient.

Compare the smallest credible solution with the proposed design. Discuss useful alternatives beside the choice in `Key decisions`; omit them when none are useful. Consider removing mechanisms as well as reorganizing them. When a simpler option reduces scope, name the lost behavior, affected consumers, and implementation/test burden avoided; changing an accepted guarantee still needs agreement. Check that a reader can explain the idea, flow, ownership and key trade-offs from the plan alone. Rewrite missing explanations in their owning sections rather than adding a separate summary document.

Keep each design coherent by folding corrections into the relevant sections. Proposed tests must detect meaningful failures that existing checks do not cover. Do not repeat dependency algorithm tests without a concrete application integration risk. Existing changes retain the schema recorded in their `.openspec.yaml`. The writing rules in [project configuration](../openspec/config.yaml) also apply when editing artifacts that use another schema. Apply these rules to new or revised text; do not rewrite historical artifacts only to match a template.

After editing the custom schema or templates, run `pnpm exec openspec schema validate review-driven` as well as the documentation and OpenSpec checks. The local fork does not automatically inherit future upstream schema changes.

## Review plans and code

Use the repository's [plan-review skill](../.agents/skills/plan-review/SKILL.md) with `$plan-review <plan or change-name>` before implementation or after material planning changes. The review-driven schema calls for review before a substantive plan is presented as ready. Apply supported improvements within the authorized planning scope and report material scope decisions. The skill owns the review procedure and reporting rules. Use `openspec-verify-change` for completed implementation.

Use the project-local [code-review skill](../.agents/skills/code-review/SKILL.md) with `$code-review` to review changes and fix clear bugs and simple improvements. Use `$complex-code-review` for review only. The linked skills define delegation, finding outcomes, and repeat-review conditions.

After spec implementation, use the project-local [project-cleanup skill](../.agents/skills/project-cleanup/SKILL.md) with `$project-cleanup <change-name>` before final verification and archive. The agent finds and applies safe cleanup, removes unnecessary code and tests, and compares custom mechanisms with framework features. Substantial changes and changes to requirements need user confirmation. After cleanup, verify the final implementation against the specs.

Use the project-local [docs-refactor skill](../.agents/skills/docs-refactor/SKILL.md) for substantive documentation reviews or cleanup. Select `review` for findings only or `refactor` for edits.

## Product reference

Eventmap is a read-only product reference. Do not modify it or copy its implementation wholesale. Follow this project's specs and dependency choices.
