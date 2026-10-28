# Past cleanup lessons

These examples come from archived Eventroam chats reviewed when this skill was
created. They describe local decisions, not rules for all features. Check current
code and specs before applying a lesson.

| Chat | Observation | Question to reuse |
| --- | --- | --- |
| [Упростить работу с трейсами и логами](codex://threads/01a17f70-ffc5-7310-9ef2-d140ba573efe) | Native Pino/Mastra export replaced a manual bus path, custom SDK logger, payload filtering, and span-field restoration. The user approved changes to delivery, payload, naming, and correlation guarantees. Root-span state repeated workflow and report data. | Which guarantee requires our custom path? Can native behavior meet the actual need after an explicit scope decision? |
| [Read page - improvements](codex://threads/01a17daa-d3a9-7981-b721-7fd36e562d39) | The user questioned `ok` versus `partial`. Later review proposed another text limit for an artificial case with 10,000 links and a very long base URL. Link expansion was the cause; the user accepted the existing risk without a change. | Does the extra status help a consumer? Is the failure demonstrated? Can we remove its cause instead of adding a limit? |
| [Пересмотреть систему эвалов](codex://threads/01a16ff6-428d-7782-8a90-a2f6674aa7f3) | Cleanup removed model substitutes, test parameters, repeated validation, and eval/CLI coverage obligations. The 50 model cases remained. Later analysis separated provider failures, fixture gaps, wrong expectations, and real agent errors. | Does this test find a distinct application failure, or does it maintain a simulation of the eval system? Is a failed case evidence against the agent or against the fixture? |
| [Упростить dry run](codex://threads/01a17f59-b15c-7973-9de6-f7f379752906) | Skipping writes appeared simpler, but rollback used about 20 lines and exercised the real writer. A separate preview needed different reports and could lose write-time checks. Final-state writing also affected versions and audit records. No rewrite was justified by the name alone. | Does the complete replacement cost less? Which transaction, report, version, or audit contract makes it more expensive? |

The strongest recurring questions were: Why is this needed? What else already
does it? What can we remove? Does this test justify its support code? Which small
requirement creates most of the complexity? Keep the answer tied to evidence.
