# OpenSpec plan inputs

Use this adapter only for an OpenSpec change.
The review procedure in `SKILL.md` also works with other plan formats.

## Read the inputs

1. If the change is unclear, run `npm exec -- openspec list --json`.
   Ask which change to review.
2. Run `npm exec -- openspec status --change "<name>" --json`.
   Use the returned artifact paths and selected schema.
   Do not impose the current default schema on an older change.
3. Get instructions for each artifact under review:
   `npm exec -- openspec instructions <artifact> --change "<name>" --json`.
   Artifact examples include `proposal`, `specs`, `design`, and `tasks`.
   Use `instruction`, `template`, `context`, and `rules` as review criteria when present.
   Apply the [project writing guide](../../../../docs/change-workflow.md#plan-a-behavior-change) to new or revised text. Keep unchanged historical headings.
   Do not override the selected schema with `--schema`.
   Read schema source only if the response is unavailable or incomplete.
   For `review-driven`, use the local [schema](../../../../openspec/schemas/review-driven/schema.yaml) as the fallback.
4. Read the original request, relevant main specs, and accepted decisions before the proposed solution.
5. Read the available proposal, design, delta specs, and tasks at the returned paths.
6. When useful, run `npm exec -- openspec validate "<name>" --type change --strict`.
   Report structural failures separately from engineering findings.

## Check behavior and agreement

- Compare delta specs with the main specs for unintended behavior loss.
  Check each modified requirement against its complete main spec block, including all scenarios.
- Check that the proposal, delta specs, design, and tasks agree on scope and behavior.
  Check that tasks cover the planned behavior and its verification.
- Check that the design overview agrees with the details and that diagrams match the design.

## Report limits

Report a missing required artifact as an issue.
Treat an omitted optional artifact as out of scope.
Structural validation alone does not prove content quality or readiness.

For a configured store, keep its resolved paths and context.
Do not read artifacts from a different repository.
Do not initialize OpenSpec or create a change as a side effect of review.
Use `openspec-verify-change` to check completed implementation.
