---
name: plan-review
description: Review a proposed implementation for understandable intent, necessary complexity, engineering soundness, and readiness before coding or after material planning changes. Accepts plans in chat, Markdown, issues, or OpenSpec. Does not audit completed implementation or rewrite the plan.
---

# Plan Review

Assess whether a reader can understand the proposed solution, whether its
mechanisms are necessary, and whether it is ready to implement. Agreement
between plan documents does not establish that the chosen approach is justified.

## Scope and evidence

Use the plan and original request named by the user or established in context.
Accept the existing format; do not require a planning framework, repository, or
extra documents. If the target is ambiguous, ask which plan to review.
For an OpenSpec change only, use [the OpenSpec adapter](references/openspec.md).

Read applicable instructions and the relevant existing contracts, decisions,
code, callers, tests, and dependency capabilities. Separate:

- User-requested outcomes and explicitly accepted decisions.
- Existing contracts that must be preserved unless a change is agreed.
- New guarantees, assumptions, and implementation choices proposed by the author.

New proposal/spec wording alone is not evidence that the user requested or
accepted an additional guarantee. Unknown provenance is uncertainty, not
permission to discard a requirement. Tests establish current behavior and
dependencies, not necessarily the need to preserve every mechanism.

State the reviewed version or scope and material evidence gaps. Partial plans
can receive useful feedback. Do not invent missing artifacts or require optional
sections. Structural validation does not establish design quality.

This is a plan review. Unimplemented work and unchecked tasks are expected.
Use existing code to test assumptions, not to report planned work as missing.

## Form a baseline before evaluating the design

For substantive logic, integrations, or competing approaches, start with the
original request, existing contracts, and relevant system/library capabilities.
Before reading the author's proposed solution in detail, sketch the smallest
credible approach that meets those outcomes. Identify responsibilities already
owned by existing code or dependencies and those the application must retain.
Then compare the proposal with this baseline.

Use a fresh reviewer with only that context when independent review is requested
or useful for a substantive design. The reviewer performs both steps; do not
start a second reviewer just for the comparison. Avoid passing the author's
rationale, preferred answer, or earlier review conclusions in the initial brief.
If the design is already in context, disclose that the comparison is not blind;
still construct an alternative rather than pretending to reset that knowledge.
Small direct changes need only a brief comparison, not delegation.

For significant added mechanisms, trace the necessity:

- Which concrete scenario and consumer need it? Where does that need come from?
- What happens if the mechanism is removed across its callers?
- Could an existing component or dependency own the responsibility already?
- Would removal preserve required behavior, or change a guarantee?

Inspect the real dependency path before calling a wrapper or validation redundant.
Pay particular attention to new application-owned copies of dependency data or
rules, even when they are small. Compare using native fields/operations directly
with maintaining a local catalog, normalization or fallback. Distinguish current
observed values from an intentionally closed contract, and grouping identity
from presentation; one needed property does not justify every transformation.
For protective layers, identify the input source, trust boundary, relevant failure
or disclosure, and existing safeguards. Neither "safety" nor "the SDK handles it"
is sufficient evidence alone. An exposed dependency API or synthetic test does
not establish a supported application entry path. Show the real caller or the
requested future use; if a broader guarantee is intentional, compare its cost
with protecting only the supported path.

Keep behavior-preserving simplifications separate from scope reductions. For a
worthwhile scope reduction, name the capability lost, affected consumers, ongoing
implementation/test cost, and the decision needed. Do not dismiss it merely
because the proposed spec includes the capability, or silently weaken an
accepted contract. If necessity remains unproven, identify the focused evidence
needed; do not automatically endorse the mechanism or demand its removal.

## Check understanding from the plan

Before using implementation details to fill gaps, briefly explain from the plan:
the user-visible change, the main execution/data flow, who owns the important
decisions, and the reasons for additional mechanisms and material trade-offs.
For small changes this can be a few sentences.

Mark what the plan actually explains versus what you inferred from code.
If an important answer requires reconstructing implementation, identify the
missing explanation and its consequence for review or execution. Recommend
rewriting the owning section, not adding a parallel summary document.
Missing optional headings or a preferred writing style are not findings.

## Engineering and execution

Apply the relevant checks without turning them into a report quota:

- Scope, behavior, design and tasks agree, including removals.
- Important before/after contracts, errors, validation and affected consumers
  are clear. Do not invent compatibility or migration obligations.
- Flow, module boundaries and ownership are understandable; abstractions solve
  demonstrated needs rather than hypothetical extensions.
- Detail matches coupling, risk and uncertainty, without prescribing every
  function or enforcing word, task or file counts.
- Tasks deliver reviewable outcomes with sensible dependencies and verification.
  Each proposed test scenario should protect a meaningful failure mode; consider
  existing coverage before adding a new fixture or integration matrix. Separate
  application integration checks from re-testing a dependency's algorithms.
- Material questions that change scope or approach are exposed before coding.
  Leave harmless implementation choices to the implementer.

## Findings and result

Report actionable findings with a precise plan location, concrete consequence,
evidence, and proposed correction. Distinguish verified contradictions from
unproven assumptions and optional choices. Do not inflate uncertainty or a
stylistic preference into a blocker.

Lead with readiness and the reason, then the brief explanation of the solution
and material findings. Distinguish:

- **Implementation readiness:** ready, ready with improvements, or not ready.
  Name unresolved decisions or missing evidence that prevent a reliable plan.
- **Necessity and understanding:** which consequential mechanisms were justified,
  which remain unproven, and which explanations required inference.
- **Options requiring a decision:** worthwhile reductions in scope or guarantees,
  separate from defects and behavior-preserving improvements.

These are distinctions to preserve, not mandatory headings or finding counts.
A clean review may be short, but "no blockers" alone does not endorse simplicity.
An optional scope reduction alone does not make an otherwise sound plan unready.
Name coverage limits and whether the baseline assessment was independent.

Do not rewrite the plan, change requirements, mark tasks complete, or start
implementation during review. If fixes were also requested, present findings
then make a separate authorized editing step and recheck affected decisions.
Review readiness is advice, not approval to implement.
