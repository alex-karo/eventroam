# Design

## TL;DR

- Validate each ingestion role's reply before the next stage uses it. Name the role's checks and keep the rules with the correction text.
- The role validator can accept a reply, ask for a correction, or stop. Reader can accept a partial page after it drops unusable quotations.
- The role runner sends a Reader or Editor correction once. The group return code continues to send corrections for selected groups to General, Tickets, Classification, Links, and Location.

## Architecture

The [role runner](../../../../src/ingestion/roles/invoke.ts) generates the reply, calls the output validator, and sends a correction when the validator requests one. A correction adds a short list of errors to the original context. It keeps the first call's tool results and uses one model step without tools. The run deadline applies to both calls. Reader reserves another call from the shared allowance only when it needs a correction.

Research checks its summary against assigned checks and saved source IDs after collection. Its invalid result stops the attempt. Reader checks the page response schema, then binds quotations to the saved Markdown. The binding step drops untagged or unmatched quotations and retains source limitations. Editor checks its decision list against the review paths. A valid `return` decision still starts a group return.

The group validators check assignment, known references, schema, and each role's groups. General confirms identity and selected Editions in the General phase before group returns or specialist execution. Location keeps its geocoding session and checks its reply against its registered points. The [group return code](../../../../src/ingestion/repairs.ts) records returns, sends the correction requests, and merges the requested groups. It checks the revision and the merged reply before Editor sees them.

## Contracts

Proposed result for [role invocation](../../../../src/ingestion/roles/invoke.ts). The retry case carries an instruction and field errors for the model.

```ts
type ReplyValidation<T> =
  | { status: "accepted"; output: T }
  | { status: "failed"; errors: ResearchError[] }
  | { status: "retry"; errors: ResearchError[]; instructions: string };
```

Group validation keeps the existing field path, rule, and group allowance. A group error that remains after correction stops the attempt. The validation error for a failed correction remains in the private report. A recovered whole-reply error is recorded in the run log when tracing is enabled.

## Key decisions

- Keep strict local response checks. The provider schema omits array bounds for compatibility. Local validation can give useful feedback even when the provider accepts a reply outside the domain schema.
- Require topics for retained evidence because topic selection determines which roles receive each quotation. Treat an untagged quotation as a source limitation, like a quotation without a unique match. This keeps other evidence from the same page.
- Use the existing return for an unknown Classification term or reuse Edition. Keep unknown evidence, source and point references as item errors. Keep the existing group return allowance and stop rules.

## Risks and validation

- Test a mixed Reader reply and a valid correction using the saved page. Verify the call allowance also applies to corrections.
- Test Editor with a missing required path and an invalid correction. Check that the correction keeps the same paths.
- Test Classification with an unknown value and check the group note. Keep existing tests for wrong targets, unknown evidence references, and revision scope.
