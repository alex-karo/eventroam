# OpenSpec plan inputs

Use this adapter only when the selected plan is an OpenSpec change. The review
method in `SKILL.md` also works without OpenSpec.

- If the change is ambiguous, run `npm exec -- openspec list --json` and ask
  which change to review.
- Run `npm exec -- openspec status --change "<name>" --json` to resolve artifact
  paths and the selected schema; do not impose today's default on older changes.
- For each artifact under review, run
  `npm exec -- openspec instructions <artifact> --change "<name>" --json`
  (`proposal`, `specs`, `design`, or `tasks`). Use its `instruction`, `template`,
  `context`, and `rules` when present as the review criteria. Keep the change's
  selected schema; do not override it with `--schema`.
  Read the schema source only if this output is unavailable or incomplete.
  For `review-driven`, the fallback is the project-local
  [schema.yaml](../../../../openspec/schemas/review-driven/schema.yaml).
- Read the original request, relevant main specs and accepted decisions to form
  the baseline before reading the proposed solution.
- Then read the available proposal, design, delta specs and tasks from those paths.
- When useful, run
  `npm exec -- openspec validate "<name>" --type change --strict`.
  Report structural failures separately from engineering findings.

## Separate artifact checks

1. **Specs**: Check compliance with the selected schema's spec instructions and
   applicable rules. Compare changes with main specs for unintended loss of
   behavior. Distinguish requirements from recommendations.
2. **Proposal**: Check that it states the problem, scope, behavior changes, and
   impact. Propose moving implementation details to design. Technical constraints
   and external contracts can stay.
3. **Design**: Keep only information needed to assess or implement the solution.
   Cite specific text to remove, shorten, or replace with a reference. Preserve
   necessary reasons and constraints; do not enforce word or sentence limits.

A missing required artifact is an issue. If the schema permits an artifact to be
omitted, report its check as not reviewed and why. Structural validation alone
does not establish content quality or readiness.

For a configured standalone store, retain its resolved store/path context rather
than reading a different repository's artifacts. Do not initialize OpenSpec or
create a change as a side effect of review.
Completed implementation verification belongs to `openspec-verify-change`.
