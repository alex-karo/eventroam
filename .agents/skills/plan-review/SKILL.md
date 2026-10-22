---
name: plan-review
description: Review an implementation plan for understandable intent, necessary complexity, and readiness before coding or after material planning changes. Accepts chat, Markdown, issues, or OpenSpec. Does not audit completed implementation or rewrite the plan.
---

# Plan Review

Assess whether the proposed solution is understandable, justified, and ready to
implement. Agreement between plan documents does not establish design quality.

## Scope and evidence

Use the plan and original request identified by the user or context; ask if the
target is ambiguous. Accept its format without requiring a repository, framework,
or extra documents. For OpenSpec only, use [the adapter](references/openspec.md).

Read applicable instructions and relevant contracts, decisions, code, callers,
tests, and dependency capabilities. Distinguish requested outcomes and accepted
contracts from newly proposed guarantees and implementation choices. New spec
wording alone does not establish acceptance; unknown provenance is not permission
to discard a requirement. Tests establish behavior, not necessarily its necessity.

Partial plans can receive useful feedback. Note missing evidence, but do not treat
unimplemented work or unchecked tasks as defects. Structural validation does not
prove readiness.

## Compare with a minimal approach

For substantive designs, sketch the smallest credible approach from the original
request, existing contracts, and system capabilities before reading the proposed
solution in detail. Identify what existing code or dependencies already own,
then compare the plan with that baseline.

When independent review is requested or useful, use one fresh reviewer for both
steps. Supply the request, existing contracts and artifact locations without the
author's rationale or previous review conclusions. If the design is already in
context, disclose that the comparison is not blind. Small direct changes need
only a brief comparison, not delegation.

For each consequential mechanism, establish its consumer and need, why existing
capabilities are insufficient, and what changes if it disappears across callers.
Check application-owned copies of dependency rules or data even when small.
Trace real entry paths and safeguards: an available API or synthetic test does
not establish application support, and dependency ownership does not prove a
wrapper or protection redundant.

Compare removing a mechanism with reorganizing it. Preserve accepted guarantees;
report scope reductions separately with the lost capability, affected consumers,
implementation/test burden avoided, and decision needed. A newly drafted spec
requiring the mechanism is not a reason to omit an alternative. If necessity is
unproven, name the evidence needed rather than endorse or demand removal.

## Check understanding and execution

Explain from the plan the observable change, main flow, ownership, and reasons
for consequential mechanisms. Distinguish what the plan explains from what you
inferred from code. Recommend filling important gaps in their owning sections,
not adding a parallel summary document.

Check that scope, behavior and tasks agree; significant before/after contracts,
errors and affected consumers are clear; and tasks have sensible dependencies
and verifiable outcomes. Do not invent compatibility or migration obligations.
Surface unresolved decisions that could change the approach before coding.

Each proposed test scenario should detect a meaningful failure not already
adequately covered. Distinguish application integration checks from re-testing
dependency algorithms. Do not impose headings, word counts or task quotas.

## Findings and result

Lead with readiness and its reason: ready, ready with improvements, or not ready.
Include the brief explanation of the solution, material findings, reviewed scope,
evidence gaps, and whether the baseline was independent. For each finding give
its location, consequence, evidence and proposed correction.

Distinguish verified contradictions, behavior-preserving improvements and options
requiring a scope decision. State which consequential mechanisms remain unproven
or required inference to understand. An optional reduction alone does not make a
sound plan unready; no blockers alone does not endorse simplicity. Keep a clean
review short and avoid stylistic findings.

Do not edit artifacts, mark tasks complete or start implementation during review.
If fixes were also requested, present findings before a separate authorized
editing step and recheck affected decisions. Readiness is advice, not approval
to implement.
