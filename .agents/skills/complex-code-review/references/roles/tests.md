# Tests

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
