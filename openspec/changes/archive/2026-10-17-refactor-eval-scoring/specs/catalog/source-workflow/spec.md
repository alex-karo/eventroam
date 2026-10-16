## ADDED Requirements

### Requirement: Eval diagnostics explain every failed dimension
Eval reports SHALL include failed-check explanations grouped by correctness, completeness, research, and tool use. CLI output and scorer explanations SHALL use those same diagnostics. Expected research failures SHALL identify unmet acceptance conditions. Diagnostic presentation SHALL preserve numeric scores, pass/fail decisions, and exit status.

#### Scenario: Perfect mutation scores do not hide another failure
- **WHEN** a case has perfect correctness and completeness but fails a research or tool-use check
- **THEN** its report and CLI identify the failed dimension and check
- **AND** its corresponding scorer gives the same failed-check explanation

#### Scenario: An expected failure lacks required evidence
- **WHEN** failed research does not satisfy an expected-failure condition
- **THEN** diagnostics identify that condition, such as missing source diagnosis or unexpected writes
- **AND** a host failure still invalidates acceptance

#### Scenario: Repetitions remain independent
- **WHEN** repetitions of the same case have different findings or tool calls
- **THEN** each repetition retains its own scores and diagnostics across scorer output, JSON, and CLI
