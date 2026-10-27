---
name: complex-code-review
description: Review code changes with adaptive specialist subagents, evidence-based ranking, and selective independent verification. Use for comprehensive code or PR reviews that benefit from multiple perspectives, including design simplicity, readability, and decomposition.
---

# Complex Code Review

Produce an actionable review with bounded coordination cost. Review only by default; fixing code or publishing comments requires a corresponding user request. Write the report in the user's language.

## Scope and dispatch

1. Establish the requested scope and an unambiguous base and target. Record commit IDs for committed changes; for working changes, record the base, staged/unstaged/untracked scope, and check for drift before reporting. Ask when the base cannot be determined. Do not silently pick an unrelated branch or omit relevant untracked files. If files change during review, qualify affected findings as stale rather than reporting them as current.
2. Read applicable repository instructions, the diff, and relevant requirements. Distinguish implemented requirements from approved future work and drafts. Future requirements govern the change only when the requested implementation explicitly targets them. Inspect surrounding code, callers, and tests as needed; a diff is a starting point, not the boundary of evidence.
3. Select roles using the table below. Always select Correctness and Code Clarity & Decomposition. Select Design Simplicity for substantive logic or design in scope; the two roles work independently on necessity and organization, respectively. The coordinator reads only the selected role files linked below, then sends each specialist its role instructions and the shared review brief. These roles guide investigation; they are not mandatory checklists for every file. Trace related code as needed and respect role ownership to reduce duplicate work. Run each selected role once, independently, with no nested delegation or discussion between specialists.

| Role | Activate when |
| --- | --- |
| [Correctness](references/roles/correctness.md) | Always |
| [Code Clarity & Decomposition](references/roles/code-clarity.md) | Always |
| [Design Simplicity](references/roles/design-simplicity.md) | Substantive logic, mechanisms, representations, abstractions, dependencies, or orchestration are introduced, changed, or explicitly under review; skip small straightforward edits |
| [Security](references/roles/security.md) | Authorization, trust boundaries, untrusted input, secrets, or personal data change |
| [Reliability & performance](references/roles/reliability-performance.md) | I/O, mutable state, asynchronous/concurrent execution, failure handling, or costly operations change |
| [Architecture & contracts](references/roles/architecture-contracts.md) | Public interfaces, data schemas, module boundaries, or integrations change |
| [Tests](references/roles/tests.md) | Behavior or tests change |
| [AI systems](references/roles/ai-systems.md) | Model or agent instructions, context or memory handling, model-facing tools, agent loops, permissions, side effects, or agent behavior evals change; skip ordinary application changes that do not affect model or agent behavior |

Use 2–8 specialist runs, plus at most one independent verifier. Respect available concurrency; schedule in waves when necessary. A broad change may activate all eight. Explain skipped roles briefly in coverage, especially when a plausible risk was considered and excluded.

If delegation is unavailable, apply the selected lenses sequentially yourself. Clearly state that the review lacked independent agents and verification; do not label self-checking as independent validation.

## Shared specialist brief

Pass the review base/target, original requested outcome, existing contracts and explicitly accepted decisions, assigned role, relevant paths, shared checks already run, and this output contract. Label new guarantees proposed in the change separately; their appearance in a new spec or test alone is not evidence of user acceptance. When provenance is unavailable, report uncertainty rather than silently removing the guarantee. Use a fresh/minimal context rather than forking the entire conversation. For Design Simplicity, withhold the author's rationale and previous review conclusions from the initial brief so the specialist can assess simplifications independently. Permit reading related code outside the assigned paths when needed to prove or refute a claim. Specialists must not edit files, publish comments, or delegate.

Return concise results:

- **Coverage:** files or flows actually read at the review base/target; material risks checked and ruled out; relevant areas not inspected and why. Keep this brief and specific to the assigned role.
- **Candidates:** issue ID (see below), location with a current line, concrete trigger, impact, source/test evidence, suggested P0–P3 severity, confidence (`high`, `medium`, or `low`), and why this change introduces or exposes the issue. For Design Simplicity and Code Clarity & Decomposition, a concrete comprehension or maintenance difficulty replaces the runtime-trigger requirement; source-based structural evidence is sufficient. Include the alternative, whole-flow benefit, preserved guarantees, and meaningful cost.
- **Design proposals:** include an issue ID and keep promising broader alternatives whose equivalence or requirement changes need a decision separate from actionable improvements and defects. State the observed motivation, affected consumers, unresolved decision, and focused validation needed; do not assign defect severity.
- **Dismissed candidates:** retain their issue IDs; include only plausible material concerns that were checked and disproved; include the decisive reason to avoid repeated investigation.

For an uncertain claim, name the unknown fact and the smallest check that could
confirm or refute it. Preserve this information when passing the claim to the
verifier or reporting an unresolved risk.

Assign issue IDs as a three-letter uppercase role code followed directly by a positive integer, such as `COR1` or `CLR2`. Use `COR` (Correctness), `CLR` (Code Clarity & Decomposition), `SIM` (Design Simplicity), `SEC` (Security), `REL` (Reliability & performance), `ARC` (Architecture & contracts), `TST` (Tests), and `AIS` (AI systems). Each specialist numbers its candidates and design proposals from 1 in a single sequence. Preserve IDs through triage, verification, and the final result; do not renumber after dismissing or reordering issues. When merging duplicates, retain one canonical ID and record the merged IDs as aliases. Include the canonical ID on every reported defect, improvement, design proposal, and candidate-derived unresolved risk, and retain IDs when mentioning refuted claims. Pass these IDs in specialist and verifier results and in any structured result's `id` field.

No finding quota. No speculative bugs, generic best practices, or unrelated pre-existing defects. Missing tests alone are not proof of a behavior bug. A test gap must name a meaningful changed scenario and explain why existing checks do not protect it. For test-maintenance suggestions, concrete redundancy or complexity and its maintenance cost may replace a runtime trigger; identify the protection retained by the proposed change. Keep justified suggestions separate from defects.

Before claiming a missing mandatory check, compare the applicable requirement with the accepted design. Distinguish a required contract from the reviewer's quality expectations; unresolved contradictions are uncertainty, not grounds to invent a new acceptance gate.

The coordinator owns shared commands so tests/lint/build are not repeated by every role. Specialists may suggest targeted reproductions; run safe, relevant checks once and distribute the result. Do not run tests against live services or mutate user data merely to validate a suspicion.

## Triage and selective verification

Reopen the relevant source for every candidate. Check reachability, caller guarantees, existing safeguards, requirements, and whether the issue belongs to this change. Merge candidates with the same root cause, retaining distinct impacts when useful. Prefer stronger evidence over votes or reviewer count. Reject unsupported claims and record meaningful unresolved questions as risks, not established defects.

Compare each specialist's coverage with its assigned scope and role. Use targeted
reads to check claims and material gaps; do not repeat the specialist's broad
investigation unless a concrete gap could change the result. Differences in
coverage wording or grouping do not justify more investigation.

For maintainability candidates, compare the current and proposed flows across affected callers and modules. Do not reject a substantiated improvement solely because current behavior is correct or tests pass. Reject proposals that merely relocate complexity or invoke a preferred pattern without a practical benefit. A reference to the new spec does not by itself settle whether an added guarantee is worth its cost: retain a substantiated scope-reduction option separately, with its affected consumers and lost behavior. Merge overlapping necessity/clarity findings by root cause. Keep optional design proposals separate from correctness risks: uncertainty about a possible refactor alone does not make the current change inconclusive.

After triage, send **all surviving P0/P1, other potentially blocking candidates, and disputed factual candidates** to one fresh verifier in a single batch. Skip this run if none qualify. Supply candidate IDs, claims, evidence, scope, and relevant paths, without reviewer vote counts or prior debate. Instruct the verifier:

> Attempt to disprove each candidate. Read the actual implementation and its callers, requirements, safeguards, and tests. Find a concrete counterexample to the claim or establish its failure conditions. Check the claimed consequences and severity separately from the underlying mechanism. If consequences depend on unproven assumptions, state those assumptions and narrow the conclusion. Return `confirmed`, `refuted`, or `unresolved` for each ID, with decisive evidence and any severity correction. Do not edit, delegate, or expand into another general review.

One verification round only. The coordinator reconciles the evidence: drop refuted candidates from defects, retain established issues, and label unresolved material risks. If new potentially blocking issues emerge during verification, they may be examined in that same run; otherwise report their verification limitation. Do not start a debate loop or silently accept a severe claim because the budget ran out. If verification is unavailable or incomplete, distinguish coordinator-confirmed evidence from independent validation and reflect material uncertainty in the verdict.

## Severity and verdict

Severity describes impact, not confidence or the number of agreeing agents:

- **P0:** critical failure, data loss, or a serious exploitable vulnerability requiring immediate action.
- **P1:** substantial defect that should be fixed before accepting the change.
- **P2:** concrete problem with limited impact.
- **P3:** small practical improvement; include only when its value is clear.

Rank by severity, then practical impact and strength of evidence. Design Simplicity and Code Clarity & Decomposition suggestions normally remain non-blocking; they block only when evidence establishes a substantial defect or violation of an applicable requirement. A simpler alternative does not justify removing necessary validation, compatibility, or domain logic.

Choose a verdict:

- **Changes requested:** at least one confirmed blocking issue; normally P0/P1, or another issue proven to violate a required acceptance condition. Still disclose any other unresolved risks.
- **Inconclusive:** no confirmed blocker, but potentially serious unresolved claims, stale evidence, or missing coverage prevent a defensible decision.
- **No blocking findings:** no confirmed blocker and no material uncertainty preventing that conclusion. This does not claim the change is bug-free or that every mechanism and test is necessary.

## Report and cost discipline

Lead with the verdict and a short assessment of correctness, justified complexity,
and test value for the lenses that ran. Name consequential mechanisms or scenarios
examined and remaining necessity questions; do not imply skipped lenses passed.

Present confirmed defects in priority order, then useful improvements, optional
scope proposals, and unresolved risks separately. Preserve the specialist evidence
and issue IDs, adding validation status (`coordinator checked` or `independently
confirmed`). Mention refuted claims only when they clarify the result.

Close with compact coverage: base/target, selected/skipped roles, specialist and
verifier runs, checks and results, and material limitations.

Adapt formatting to the size of the review; do not emit empty sections or repetitive logs. Keep instructions and findings concise without truncating material issues to meet a quota. Review only relevant references, avoid duplicate source dumps, and do not prescribe a model or promise a token count. Stop after the report: no automatic fix/review loop.

Design influences: [review-pro](https://github.com/tufantunc/review-pro) (attempted refutation), [JUNERDD code-review](https://github.com/JUNERDD/skills/tree/main/skills/code-review) (evidence and coverage), and [Cline skills](https://github.com/cline/skills) (specialist separation). These links are attribution, not runtime dependencies.
