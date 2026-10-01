# Service build progress

Current section: 1 — Application foundation  
Fix rounds: 0 of 2  
Status: accepted; commit pending

## Acceptance checklist

- [x] One npm-managed Next.js App Router application with React and strict TypeScript; exact compatible dependency pins and a lockfile.
- [x] Separate `src/app`, `src/components`, `src/domain`, `src/application`, and `src/db` responsibilities.
- [x] SQLite access through Drizzle and `better-sqlite3`, with validated environment configuration and safe connection settings (foreign keys, WAL, busy timeout).
- [x] Working development, type-check, lint, test, and production build commands, with documented usage and a basic real SQLite smoke test.
- [x] Foundation configuration follows ADR 002 where applicable, including runtime pinning and a clean-install path; no catalog behavior from later sections is implemented.

## Decisions

- Process sections in checklist order and commit each accepted section separately.
- Use development fixtures. Parsing, crawling, imports, agent workflows, public-content/SEO completion, and production deployment remain deferred.
- The local default runtime is Node 26.7.0/npm 11.19.0; ADR 002 selects Node 26.10.0/npm 11.19.1. The implementer will verify the selected pins and use an appropriate runtime for checks.
- Section 1 passed independent Astra review and required checks on the selected runtime. Normal development watching hit sandbox `EMFILE`; polling served HTTP 200. Linux image packaging belongs to later deployment work.
- Optional documentation improvements (not acceptance blockers): remove one stale pre-scaffold statement and mention the polling fallback.

## Next action

Commit accepted section 1, then define section 2 acceptance and start a fresh Sol implementer.
