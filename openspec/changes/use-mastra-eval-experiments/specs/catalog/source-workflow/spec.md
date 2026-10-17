## ADDED Requirements

### Requirement: Eval execution is distinct from acceptance

Eval reports SHALL expose experiment execution metadata and per-case scorer results. A completed task SHALL NOT imply acceptance. Existing assertion checks, diagnostics, case acceptance, and CLI exit rules SHALL remain authoritative. Each repetition SHALL retain its own ordered result. Task or scorer execution failures SHALL fail the eval command without exporting raw exception details.

#### Scenario: Completed task fails its checks

- **WHEN** an eval task completes but research or tool-use checks fail
- **THEN** experiment execution can report success while the case is rejected and the command exits nonzero
- **AND** the report retains the failed diagnostics and native scorer results

#### Scenario: Repetitions complete out of order

- **WHEN** repeated cases finish in a different order from their inputs
- **THEN** report rows preserve input order and keep each repetition's result, score, tool calls, and scorer results together

#### Scenario: Framework evaluation fails

- **WHEN** a task fails to produce an output or a scorer fails to execute
- **THEN** the command fails without treating missing results as acceptance or exposing raw exception messages and stacks
