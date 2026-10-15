---
name: plan-review
description: Review an implementation plan for engineering soundness, simplicity, and readiness before coding or after material planning changes. Use for review of OpenSpec proposal, design, specs, and tasks. Does not verify completed implementation or rewrite the plan.
---

# Plan Review

Assess whether the proposed work is clear, coherent, and ready to implement.
Review the plan against repository evidence, not just its own wording.
Keep the review proportionate to the change and its risks.

## Scope and evidence

- Use the change or plan named by the user or established in the conversation.
  If the target is ambiguous, list active changes with
  `npm exec -- openspec list --json` and ask which one to review.
- Read the repository instructions and documentation index, then only the
  documents relevant to the plan.
- For an OpenSpec change, run
  `npm exec -- openspec status --change "<name>" --json`.
  Read its available proposal, design, delta specs, and tasks from the resolved
  artifact paths. Use its selected schema and instructions; do not impose the
  current default schema on an older change.
- Read the relevant main specs, including scenarios, and inspect the code,
  types, tests, and configuration needed to verify material assumptions.
  Follow references to existing components before recommending new ones.
- A partial plan can still receive useful feedback. State what is missing and
  limit the readiness assessment. Do not invent missing artifacts or demand
  artifacts that the selected schema legitimately skips.
- When formal validation is useful, run
  `npm exec -- openspec validate "<name>" --type change --strict`.
  Distinguish structural errors from engineering findings. CLI validation
  does not establish design quality or implementation readiness.

This is a review, not an implementation audit. Unchecked tasks and code that
does not yet implement the proposed behavior are expected before implementation.
Use existing code to test the plan's assumptions, not to report planned work as
missing implementation. Completed-code verification belongs to
`openspec-verify-change`.

## Review criteria

Apply the criteria that matter to the change. They are prompts for judgment,
not required report sections or a quota of findings.

- **Consistency:** Proposal scope, spec behavior, design choices, and tasks
  agree. Tasks cover the important outcomes, including removals and changed
  behavior. Distinguish current behavior from approved future work and drafts.
- **Contracts:** Important before/after inputs, outputs, and types are clear.
  Check value semantics, errors, validation boundaries, and affected consumers
  where relevant. Data transitions must fit the project's actual preservation
  needs. Do not invent backward-compatibility requirements.
- **Architecture:** Execution flow, module boundaries, and ownership of rules
  and data are clear. Key decisions have reasons. Proposed abstractions solve
  a concrete need. Identify duplicate rules or parallel obsolete paths.
- **Simplicity:** Look for a smaller solution using existing capabilities.
  Separate simplifications that preserve requirements from options that remove
  or defer a capability. Name the requirement affected by each scope reduction;
  treat it as an option requiring agreement, not as a defect in the plan.
- **Proportion:** Check whether the stated change size fits coupling, risk,
  uncertainty, and verification effort. Detail should address real decisions,
  without prescribing every function. Do not enforce task counts, word quotas,
  or missing optional headings as engineering requirements.
- **Execution:** Tasks have reviewable outcomes, sensible dependencies, and
  ways to check completion. Relevant tests and docs accompany their work;
  integration checks may span groups. Avoid giant checkboxes that conceal
  independent outcomes and trivial tasks that add no tracking value.
- **Risk and decisions:** Material risks have credible checks. Questions that
  can change requirements, approach, or task breakdown are resolved before
  implementation. Leave harmless implementation choices to the implementer.
- **Readability:** Descriptions use clear, simple English and exact technical
  terms. Each artifact has a purpose; repeated details and appended corrections
  should not hide the current decision. Flag wording only when it affects
  understanding, review, or execution.

## Findings and result

Use one reviewer by default. Do not require subagents or a separate review
workflow for every small change.

Report only actionable findings supported by evidence. For each finding, give
a precise artifact location, the concrete consequence, and a proposed correction.
Include code references when the claim depends on existing implementation.
Distinguish a verified contradiction from an assumption that still needs checking.
Do not present a stylistic preference as a correctness issue, or inflate an
uncertain concern into a blocker.

Return a short report in this order:

1. **Blocking issues:** Decisions or contradictions that prevent a reliable
   implementation. Omit the section when there are none.
2. **Useful improvements:** Non-blocking fixes and worthwhile simplifications,
   clearly labeling options that change requirements. Omit empty sections.
3. **Readiness:** Ready, ready with non-blocking improvements, or not ready,
   with the reason. If material evidence is unavailable, say readiness is not
   established and name the missing evidence. State the reviewed scope and any
   significant limitations. A clean review may be only a few sentences.

Do not rewrite artifacts, change requirements, mark tasks complete, or start
implementation as part of review. Return recommendations in the conversation.
If the user also requests fixes, treat those as a separate authorized editing
step after presenting the findings; preserve the agreed scope and recheck the
affected decisions. Review readiness is advice, not approval to implement.
