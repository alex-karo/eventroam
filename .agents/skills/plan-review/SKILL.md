---
name: plan-review
description: >-
  Review a plan for a clear purpose, necessary complexity, and implementation readiness.
  Use before coding or after important plan changes. Accept chat, Markdown, issues, or
  OpenSpec. Do not audit completed code or rewrite the plan.
---

# Plan review

Check whether the plan delivers the requested result and what can be simpler.
A ready plan can still contain unnecessary work.

## Inputs

Use the plan and original request from the user or conversation.
If the target is unclear, ask which plan to review.
Accept its format. Do not require a repository, framework, or extra documents.
For OpenSpec, use [the adapter](references/openspec.md).

Separate requested outcomes and accepted contracts from proposed guarantees and implementation choices.
New spec text does not prove acceptance.
An unknown requirement source does not authorize its removal.

## Review the plan

Check that the plan explains the observable change, main flow, and ownership.
Separate information in the plan from conclusions you draw from code.
Identify important missing explanations in the sections that should contain them.

Check that the reader can understand the core idea without reading code.
Use ASD-STE100 Simplified Technical English and consistent domain terms.
For repeated rules, suggest a link to the source that owns the rule.
Do not request sections or diagrams that add no useful information.
Keep necessary reasons and constraints.

Compare scope, behavior, affected consumers, task dependencies, and verifiable outcomes with relevant code and accepted contracts.
Identify unresolved decisions that could change the solution.
For each test gap, name the failure that existing or planned checks would miss.
Explain why those checks would miss it.
Do not invent compatibility or migration requirements.
Report missing evidence. Do not treat unimplemented planned work as a defect.

## Check for simpler solutions

For a substantive plan, ask one independent subagent:

> What can be simpler in this plan? Check the code.
> Propose specific removals, combinations, or replacements. State what each suggestion would remove or lose.
> If no useful simplification exists, report none.

Give it the original request, accepted constraints, plan, and relevant source locations in fresh context.
Do not provide the author's reasoning or earlier review conclusions.
The subagent must not edit or delegate.
Perform the ordinary review yourself.

For a small direct plan, answer the same question yourself.
If delegation is unavailable, perform both checks and report that the review was not independent.

## Check findings and report

Check each suggestion against the sources before including it.
Determine whether the proposed removal affects a real consumer or failure condition.
Check whether existing code or tests already provide that protection.
Separate changes that preserve behavior from changes to accepted scope that need a decision.
A useful check does not automatically require a new test.
If evidence is incomplete, keep the uncertainty explicit.
Do not invent findings or repeat the review as a debate.

Keep the report short.

- Give the readiness verdict and its main reason. Use ready, ready with improvements, or not ready.
- Report material findings and supported simplifications. Give the location, consequence, evidence, and proposed correction for each finding.
- List applicable checks you could not complete and give the reason. State any limit on review independence.

Separate decisions that block implementation from wording and structure improvements.
Optional scope reductions, wording preferences, or missing optional diagrams alone do not make a sound plan unready.

Do not edit artifacts, mark tasks complete, or start implementation during review.
If the user also requested fixes, present findings before the separate authorized edit step.
After revisions, recheck affected decisions once.
Then report unresolved issues.
Readiness is advice, not authorization to implement.
