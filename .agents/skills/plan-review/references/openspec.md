# OpenSpec plan inputs

Use this adapter only when the selected plan is an OpenSpec change. The review
method in `SKILL.md` also works without OpenSpec.

- If the change is ambiguous, run `npm exec -- openspec list --json` and ask
  which change to review.
- Run `npm exec -- openspec status --change "<name>" --json`. Read proposal,
  design, delta specs and tasks from the resolved artifact paths as available.
  Use the change's selected schema, not today's default for new changes.
- Read relevant main specs with their scenarios and accepted decisions as
  existing contracts. Treat new delta requirements according to their provenance;
  inclusion in a change is not evidence of explicit acceptance.
- For the baseline assessment, read the original request and existing contracts
  before the proposed design and deltas. Do not require extra artifacts for
  schemas that legitimately omit them.
- When useful, run
  `npm exec -- openspec validate "<name>" --type change --strict`.
  Report structural failures separately from engineering findings.

For a configured standalone store, retain its resolved store/path context rather
than reading a different repository's artifacts. Do not initialize OpenSpec or
create a change as a side effect of review.
Completed implementation verification belongs to `openspec-verify-change`.
