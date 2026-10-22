# OpenSpec plan inputs

Use this adapter only when the selected plan is an OpenSpec change. The review
method in `SKILL.md` also works without OpenSpec.

- If the change is ambiguous, run `npm exec -- openspec list --json` and ask
  which change to review.
- Run `npm exec -- openspec status --change "<name>" --json` to resolve artifact
  paths and the selected schema; do not impose today's default on older changes.
- Read the original request, relevant main specs and accepted decisions to form
  the baseline before reading the proposed solution.
- Then read the available proposal, design, delta specs and tasks from those
  paths. Treat new requirements according to their provenance, not as accepted
  merely by inclusion. Do not require artifacts the schema legitimately omits.
- When useful, run
  `npm exec -- openspec validate "<name>" --type change --strict`.
  Report structural failures separately from engineering findings.

For a configured standalone store, retain its resolved store/path context rather
than reading a different repository's artifacts. Do not initialize OpenSpec or
create a change as a side effect of review.
Completed implementation verification belongs to `openspec-verify-change`.
