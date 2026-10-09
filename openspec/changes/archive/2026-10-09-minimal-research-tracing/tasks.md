# Tasks

## 1. Agent tracing

- [x] 1.1 Add compatible pinned observability/LibSQL dependencies and the optional tracing helper/configuration; verify installation and tests for default-off behavior, absolute path resolution, and separation from the catalog database. Document `CATALOG_TRACING` and the store-path setting in `.env.example` and the ingestion guide.
- [x] 1.2 Connect automatic tracing to the real research-agent path with always sampling and minimal metadata; verify an offline provider-stub test persists the agent/model/tool hierarchy while injected candidates and disabled tracing create no store. Preserve the existing usage callbacks and report shape.
- [x] 1.3 Hide inputs/outputs, set observability `logging: { enabled: false }`, and sanitize residual attributes/errors by mutating the live span; verify persisted spans, logs, and exported JSON contain none of the sentinel content while retaining operation names and timing. Inject a processor failure and verify it drops the span and emits only a fixed diagnostic code. Document content exclusions in the ingestion guide.
- [x] 1.4 Explicitly attempt to flush observability before shutdown on success, handled provider errors, and cooperative abort; verify a short buffered-exporter process exits before automatic batch flushing and a new process can read its final spans. Inject flush/shutdown failures and verify shutdown is still attempted and the original result, partial usage, budgets, retry policy, and exit behavior survive. Document the accepted background-flush race and best-effort persistence; custom buffering, serialization, and dependency patches are deferred by the owner's decision.
- [x] 1.5 Connect a narrow tracing-component logger adapter and exporter drop notifications to fixed application stderr diagnostic codes; verify asynchronous initialization failure falls back to untraced research and a post-initialization persistence failure handled inside the exporter still emits a safe application diagnostic. Verify messages/metadata reaching the adapter are discarded and no diagnostic becomes a stored log or report field; document the diagnostic codes and the accepted exception for original technical errors/stacks emitted directly by LibSQL's private logger.

- [x] 1.6 Capture generation completion time before tracing cleanup and preserve the original HTTP/budget classification when cleanup crosses the deadline. Compare offline HTTP failure and cooperative abort results, usage, and request counts against untraced runs.

## 2. Local inspection

- [x] 2.1 Add the compatible Mastra CLI development dependency, storage-only entry point, and `catalog:studio` launcher; verify Studio starts on localhost without model credentials or a catalog connection, shares the absolute store path, and registers no research agents or mutation workflows. Document the exact activation, inspection, and stopped-process cleanup commands in the development guide.
- [x] 2.2 Inspect a persisted CLI/provider-stub trace through the built-in Browser after the research process exits; verify its model/tool hierarchy and metadata remain visible without rerunning research, inspect its JSON export for the content exclusions, and verify no agent/SDK logs were persisted.

## 3. Completion checks

- [x] 3.1 Run the relevant offline research/provider tests, type-check, lint, docs checks, and strict OpenSpec validation; verify existing version-2 report tests pass without new trace fields or eval workflow instrumentation.
- [x] 3.2 After implementation passes its checks, sync the added requirements into `catalog/source-workflow`, update implementation/progress documentation, and verify `npm run openspec:validate` and `npm run docs:check` pass.
