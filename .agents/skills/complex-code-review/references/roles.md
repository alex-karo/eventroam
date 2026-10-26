# Specialist roles

The coordinator reads this reference before dispatch and sends only the selected role's section, together with the shared brief and output contract in SKILL.md. These are review lenses, not mandatory checklists for every file. Trace related code as needed; keep primary ownership below to reduce duplication.

## Correctness

Own behavioral logic and conformance to the change's actual requirements: boundaries, empty/missing values, state transitions, ordering, and observable regressions. Trace the real inputs and callers before claiming a failure. Treat drafts and future plans as requirements only when explicitly targeted by this change. Delegate no work yourself; surface security or contract concerns if encountered, but do not conduct a second specialist's full pass.

## Design Simplicity

What can be simplified in this implementation? Check the whole affected flow,
including callers and tests. Propose concrete removals, combinations or
replacements, and state what behavior or protection we would lose. Do not invent
suggestions if there are no useful simplifications.

Ground suggestions in the original requested outcome, accepted contracts and
actual code. Show the complexity removed, where required behavior and safeguards
remain, and any meaningful migration cost. Moving complexity into callers or
another module is not itself a simplification; trace real inputs and dependency
guarantees before calling a mechanism redundant.

Separate behavior-preserving improvements from scope alternatives that require a
decision, using the shared output rules. Leave organization within the chosen
approach primarily to Code Clarity & Decomposition.

## Code Clarity & Decomposition

Own how clearly the code communicates its intent, responsibilities, main flow, state, and side effects. Assess readability, coherent decomposition, and separation of abstraction levels; use language idioms and project conventions when they provide a concrete benefit.

Trace representative affected flows from their real callers. Explain the operation's meaningful steps to yourself, then compare that explanation with what the code exposes. Look for reconstructing intent from low-level details, scattered state changes, implicit ordering, ambiguous names, or distant helpers. Required mechanisms may still be poorly organized.

Assess responsibility boundaries in both directions: separate entangled work, or combine fragments whose separation adds navigation without understanding. Coordinating functions should reveal meaningful steps; helpers should own a recognizable responsibility with explicit inputs and results. Neither function size nor the number of helpers establishes a problem.

For a candidate, show the specific relationships the reader must reconstruct and a concrete alternative responsibility map. Describe what stays with the caller, what moves or disappears, and any extracted unit's inputs and outputs. Use a compact before/after outline when helpful. Explain which relationships become local or explicit, accounting for new navigation, coupling, parameter passing, and state ownership.

Rejecting one extraction does not establish that the current structure is clear. Assess the original difficulty independently, but report an improvement only when an alternative has a clear net benefit. Preserve required behavior and the meaningful order of checks and effects; do not hide differing rules behind a generic pipeline.

Do not equate readability with fewer lines, smaller functions, more layers, or eliminating all duplication. Avoid cosmetic preferences, generic best-practice mandates, and moving code without improving understanding. Leave reconsideration of the overall approach primarily to Design Simplicity; surface it if encountered without conducting a second full pass.

## Security

Own changed trust boundaries: authentication versus authorization, tenant/record ownership, input reaching sensitive sinks, secret handling, and unintended personal-data exposure. Identify an actual attacker-controlled entry, reachable path, and impact. Check caller and framework guarantees before claiming missing validation. Avoid hypothetical threat models without a plausible entry point. Inspect only relevant sensitive material and never reproduce secrets in findings.

## Reliability & performance

Own failure behavior and runtime cost: partial failures, retries and idempotency, concurrency, cancellation, resource cleanup, unbounded work, query amplification, and meaningful latency/memory regressions. Name the workload or failure condition that makes the issue relevant. Do not demand infrastructure, caching, retries, or optimization without evidence that the current behavior needs it. Distinguish measured results from source-based estimates.

## Architecture & contracts

Own component boundaries and compatibility: caller/callee assumptions, API shapes and semantics, persistence schemas and migrations, integration behavior, and multiple sources of truth. Trace producers and consumers before recommending a boundary change. Assess the project's existing design and actual requirements, not an idealized architecture. Assess whether the chosen design preserves contracts and boundaries. Leave the necessity of mechanisms and alternative approaches primarily to Design Simplicity, local organization primarily to Code Clarity & Decomposition, and algorithmic behavior to Correctness.

## Tests

Own protection of changed behavior and maintainability of tests in scope: missing important cases, assertions that cannot detect the regression, mocks that bypass the relevant boundary, nondeterminism, and tests that enforce an incorrect contract. Identify the exact scenario and why current checks would miss it. For changed tests and evals, look for a concrete incorrect result that the assertions or scorer would still accept.

For each materially new or expanded scenario, identify a meaningful regression it
detects and why existing coverage would not detect it. Group equivalent cases;
do not require an assertion-by-assertion report. Separate application integration
risks from re-testing dependency algorithms or freezing incidental implementation
choices. An absence assertion is valuable when absence is a meaningful contract
(for example, private content must not be stored); removing an internal mechanism
does not automatically require a new test proving that its former field is absent.
Do not propose extra coverage solely because a helper or code path exists.

Check for redundant tests when the same behavior is already protected by other cases or tests at another level. Compare scenarios, assertions, exercised boundaries, and failure modes; shared code coverage alone does not establish redundancy. Name the tests that retain the protection and the practical cost avoided by removal or consolidation. Preserve distinct unit, integration, and end-to-end guarantees when they detect different failures or provide useful fault isolation.

Check for overcomplicated tests: setup, fixtures, mocks, helpers, or indirection that make the scenario and expected result unnecessarily hard to understand or maintain. Show the concrete difficulty and a simpler alternative that preserves meaningful assertions, relevant boundaries, and determinism. Length or helper count alone is not evidence. Report redundancy and complexity as non-blocking improvements unless a concrete defect or required-contract violation is established.

Prefer a small targeted test over broad coverage mandates. Do not ask for tests that merely mirror implementation or test trivial low-impact refactors without a meaningful failure mode. Report suggested checks to the coordinator to avoid duplicate execution.
