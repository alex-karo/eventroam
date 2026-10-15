# Tasks

## 1. Tool names

- [x] 1.1 Rename active tools and consumers per design.md; update fixtures/tests and verify type-check, reader/session/provider and observability tests.
- [x] 1.2 Update current docs/spec references without historical rewrites; run `npm run docs:check` and `npm run openspec:validate`.

## 2. Highlights

- [x] 2.1 Extend candidate contracts and citation parsing; test present/missing/invalid/oversized content, URL filtering/order and excerpt exclusion from technical logs/traces.
- [x] 2.2 Document highlights and verify provider/session/report tests preserve request mode, safeguards and research/editor/discovery accounting; run `npm run docs:check`.

## 3. Search instructions

- [x] 3.1 Apply design.md's description/prompt and conditional add discovery; verify prompt tests remove broader permissions and preserve editor decisions.
- [x] 3.2 Evaluate absent announcements/optional fields, prior-link reuse, unknown/wrong/inaccessible sources and material identity/date conflicts with the original event or other sources. Assert zero searches for absent facts or successful known-link recovery, reading prior candidates before repeat search, and permitted recovery/conflict searches. Run scoring tests, source-regression/editor cases and targeted live evals when credentials permit; record limitations.
- [x] 3.3 Document search conditions and sync the completed delta; run `npm run docs:check` and `npm run openspec:validate`.

## 4. Integration

- [x] 4.1 Run type-check, lint, deps:check, format:check and affected ingestion tests. Check active code/docs for old names and verify provider/mode/config remain unchanged; record results.

## Validation

- Type-check, lint, dependency and format checks pass; 450 ingestion/command tests pass.
- Main specs, this change and docs checks pass. Global OpenSpec validation still fails only on the pre-existing proposal-only `narrow-current-refresh`.
- Live fixed-source evals (`openai/gpt-6-luna`): all 9 targeted cases pass across the latest runs, including zero-search absent-fact/known-link recovery and single-search exceptional recovery/conflicts. Initial Node timeouts required process-only IPv4 priority; synthetic sources were corrected before recovery reruns. Reports: ignored `data/catalog-evals/focused-search-{policy-ipv4,recovery,canonical-recovery}-2026-10-15.json`. These check model tool selection with fixed sources, not live Exa retrieval or measured cost savings.
