# Design

<!-- State each decision directly. Explain each fact once. Remove filler, repeated
context, obvious details, and statements that add no useful information. Usually
use 2-3 sentences per key decision: choice, reason, and material trade-off. Add
detail only for a specific complexity or risk; this is not a sentence limit.
Before handoff, remove any sentence whose deletion does not reduce the reader's
ability to assess or implement the design. Keep necessary reasons and constraints.
Prefer direct wording over dense shorthand. -->

## Change size

<!-- Small / Medium / Large and why. Name affected areas, contract/data changes,
dependencies, and material uncertainty. Judge coupling and risk, not file count. -->

## Approach

<!-- Explain the core idea without requiring code: observable change, main flow,
existing component/dependency responsibilities, and what the application adds.
Start with the smallest credible approach. Link to proposal/specs rather than
repeating them. A small change may need only these first two sections. -->

## Contracts

<!-- Important before -> after changes. Short type sketches, value semantics,
errors, and validation where relevant. Omit if contracts do not change. -->

## Architecture

<!-- Flow, module boundaries, decision/validation/write ownership, removed paths.
Omit if the approach already explains the relevant structure. -->

## Key decisions

<!-- Choice, concrete consumer/scenario, reason, trade-off. Distinguish requested
or accepted requirements from new guarantees and assumptions. For significant
custom mechanisms, explain why existing capabilities are insufficient.
Omit if Approach already covers all decisions. -->

## Simpler options

<!-- Same requirements: what can disappear using existing capabilities, and why
selected or rejected. Reduced scope: capability lost/deferred, affected consumers,
and implementation/test burden avoided; not approval.
Do not invent alternatives. Omit if already covered in Key decisions. -->

## Risks and validation

<!-- Material risk -> check/evidence. Add migration/recovery only if needed.
Only deferrable questions belong here. Omit if Approach covers all checks. -->
