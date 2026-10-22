---
name: plan-review
description: Review an implementation plan for understandable intent, necessary complexity, and readiness before coding or after material planning changes. Accepts chat, Markdown, issues, or OpenSpec. Does not audit completed implementation or rewrite the plan.
---

# Plan Review

Review whether the plan delivers the requested result and what can be simplified.
A ready plan may still contain unnecessary work.

## Inputs

Use the plan and original request identified by the user or context; ask if the
target is ambiguous. Accept its format without requiring a repository, framework,
or extra documents. For OpenSpec only, use [the adapter](references/openspec.md).

Distinguish requested outcomes and accepted contracts from newly proposed
guarantees and implementation choices. New spec wording alone does not establish
acceptance; unknown provenance is not permission to discard a requirement.

## Review

Explain the observable change, main flow and ownership from the plan. Distinguish
what it explains from what you inferred from code; flag important missing
explanations in their owning sections.

Check scope, behavior, affected consumers, task dependencies and verifiable
outcomes against relevant code and existing contracts. Surface unresolved
decisions that could change the approach. For test gaps, name the failure and why
existing or planned checks would miss it. Do not invent compatibility or migration
obligations. Note missing evidence without treating unimplemented work as a defect;
structural validation does not prove readiness.

For substantive plans, also send one independent subagent this question:

> What can be simplified in this plan? Check against the code. Propose concrete
> removals, combinations or replacements, and state what we would lose. Do not
> invent suggestions if there are no useful simplifications.

Give it the original request, accepted constraints, plan and relevant source
locations in fresh context, without the author's reasoning or prior review
conclusions. It reviews without editing or delegating. Do the ordinary review
yourself; no additional dispatcher or prescribed alternative plan is needed.
For small direct plans, ask the same question yourself. If delegation is
unavailable, do both checks and disclose the lack of independence.

## Check suggestions and report

Verify suggestions against the sources before including them. Check whether
removed work protects a real consumer or failure mode and whether existing code
or tests already provide that protection. Distinguish behavior-preserving
simplifications from changes to accepted scope that require a decision. A useful
check is not automatically a necessary new test. Retain uncertainty where the
evidence does not settle it; do not force a finding or start a debate loop.

Report readiness (ready, ready with improvements, or not ready, and why), a brief
explanation of the solution, and supported simplifications or none substantiated.
Give material findings a plan location, consequence, evidence and proposed
correction. Include reviewed scope and material evidence or independence limits.
Optional scope reductions alone do not make a sound plan unready.

Do not edit artifacts, mark tasks complete or start implementation during review.
If fixes were also requested, present findings before a separate authorized
editing step. Recheck only affected decisions once after revisions, then report
unresolved issues. Readiness is advice, not approval to implement.
