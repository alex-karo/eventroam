---
name: plan-review
description: Review an implementation plan for understandable intent, necessary complexity, and readiness before coding or after material planning changes. Accepts chat, Markdown, issues, or OpenSpec. Does not audit completed implementation or rewrite the plan.
---

# Plan Review

Assess readiness and opportunities to simplify separately. A sound overall
approach does not establish that every task, test or document change is needed.

## Scope and dispatch

Use the plan and original request identified by the user or context; ask if the
target is ambiguous. Accept its format without requiring a repository, framework,
or extra documents. For OpenSpec only, use [the adapter](references/openspec.md).

For substantive plans involving coupled changes, competing approaches or material
risks, run two independent subagents: **Correctness and readiness** and **Necessity
and simplicity**, using the role instructions below. Small direct plans need one
pass covering both lenses; use one fresh reviewer if independent review was
requested. If delegation is unavailable, apply both lenses yourself and disclose
that the review was not independent.

The coordinator sends each reviewer its role, the shared evidence/output rules,
original request, accepted constraints, reviewed version or scope, and artifact
locations. Use fresh context, not the author's conversation or previous reviews.
Reviewers may inspect relevant code, tests and dependencies. They must not edit,
delegate or consult each other's conclusions. Run each role once; the coordinator
owns shared validation commands and reconciles results. Invoke this workflow
directly rather than adding an intermediary review agent that repeats dispatch.

## Shared evidence and output rules

Distinguish requested outcomes and accepted contracts from newly proposed
guarantees and implementation choices. New spec wording alone does not establish
acceptance; unknown provenance is not permission to discard a requirement.
Tests establish behavior, not necessarily its necessity.

Partial plans can receive useful feedback. Note missing evidence, but do not treat
unimplemented work or unchecked tasks as defects. Structural validation does not
prove readiness. Do not invent compatibility or migration obligations.

Return concise findings with plan location, consequence, evidence and proposed
correction, plus coverage and material gaps. Separate verified problems from
unproven assumptions and optional scope changes. No finding quota or stylistic
requirements; a clean role report may be short.

## Correctness and readiness

Can the plan deliver the requested behavior without unresolved material risks?

Explain from the plan the observable change, main flow and ownership. Distinguish
what it explains from what you inferred from code; identify important missing
explanations in their owning sections rather than ask for a parallel summary.

Check agreement between scope, behavior and tasks; before/after contracts, errors
and affected consumers; task dependencies and verifiable outcomes. Use relevant
code, callers and existing contracts to test assumptions. Surface unresolved
decisions that could change the approach before coding. For a test gap, name a
meaningful failure and why existing or planned checks would miss it.

Report readiness with its reason. Leave systematic removal of unnecessary work
to the other role; do not equate a useful check with a necessary new test.

## Necessity and simplicity

Which work can disappear or become simpler while preserving the requested result?

Before reading the proposed solution, sketch the smallest credible approach from
the original request, existing contracts and system capabilities. Then compare
it with both the architecture and the substantial tasks, tests and documentation
work in the plan. If the design was already in context, disclose that limitation.

For consequential work, establish its consumer and need, why existing capabilities
are insufficient, and what changes if it is omitted across the affected flow.
Check application-owned copies of dependency rules or data even when small.
Trace real entry paths and safeguards: an available API or synthetic test does
not establish application support, and dependency ownership does not prove a
wrapper or protection redundant.

For proposed tests, compare failure modes and existing coverage. An unchanged
algorithm does not make a new integration check redundant; a meaningful property
does not by itself justify another test. For documentation, check who needs the
information and whether its existing owner already covers it.

Propose concrete removals or simpler replacements, stating the work avoided, what
would be lost, and where necessary behavior and protection remain. Distinguish
behavior-preserving reductions from scope options requiring a decision. Do not
omit an alternative merely because a newly drafted spec requires the mechanism,
or force a reduction when evidence does not support one.

## Reconcile and report

The coordinator checks findings against their sources, merges overlaps and
resolves factual disagreements with focused inspection. Do not decide by votes
or start a debate loop. Retain material uncertainty when evidence cannot settle
it; optional scope reductions alone do not make an otherwise sound plan unready.

Report both **readiness** (ready, ready with improvements, or not ready, and why)
and **simplification** (supported reductions or none substantiated, with evidence
limits). Include the brief explanation of the solution, material findings,
reviewed scope, roles run and independence limits. Do not turn no blockers into
an endorsement of every planned task.

Do not edit artifacts, mark tasks complete or start implementation during review.
If fixes were also requested, present findings before a separate authorized
editing step. Recheck only affected decisions/roles once after revisions, then
report unresolved issues. Readiness is advice, not approval to implement.
