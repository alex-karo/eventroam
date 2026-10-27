# Eventroam

Eventroam is an English-language worldwide event catalog. The first scope covers open-air music festivals and burning-like gatherings. The public Next.js app reads the catalog. Local setup uses fictional development fixtures. Owner-initiated ingestion and application containers are implemented. See [README](README.md) for public sites and deployment status.

The project is under active development. Backward compatibility is not required at this stage. Prefer clear current contracts; do not add compatibility layers or preserve obsolete APIs, schemas, report formats, or commands solely for earlier versions. Keep code, tests, specs, and documentation aligned when changing a contract.

Start at the [documentation index](docs/index.md), then read only the documents relevant to the task. Main OpenSpec specs describe implemented behavior and are grouped by `catalog/`, `website/`, and `operations/`; active changes describe approved future work, with matching domain paths in their delta specs; [draft proposals](docs/proposals/) hold unresolved choices.

- Records and writes: [catalog records](openspec/specs/catalog/records/spec.md) and [publication and details](openspec/specs/catalog/publication/spec.md).
- Classification: [Edition classification](openspec/specs/catalog/classification/spec.md); the [starter vocabulary](docs/proposals/festival-taxonomy-vocabulary.md) remains a draft.
- Map, list, or filters: [discovery](openspec/specs/website/discovery/spec.md).
- Routes or scope hosts: [scoped website](openspec/specs/website/routing/spec.md).
- Local ingestion: [ingestion workflow](openspec/specs/catalog/ingestion-workflow/spec.md), [source access](openspec/specs/catalog/source-access/spec.md), and [ingestion guide](docs/ingestion-process.md).
- Public metadata and indexing: [website discoverability](openspec/specs/website/discoverability/spec.md). Deployment and transfers: [infrastructure](docs/infrastructure.md).
- Approved future work: [active OpenSpec changes](openspec/changes/).
- Code layout or commands: [project structure](docs/project-structure.md) and [development guide](docs/development.md).
- Technology rationale: [decisions](docs/index.md#decisions).

Use current OpenSpec specs and accepted decisions for implemented behavior; check code and progress docs for exact implementation status. Do not treat active changes or draft proposals as completed behavior. Dated research and [legacy specs](docs/archive/legacy-specs/) are background evidence. For behavior changes, use the standard OpenSpec change workflow and update the owning spec when implementation is complete. Update the documentation index if the document set changes. Run `npm run openspec:validate` for OpenSpec edits and `npm run docs:check` for documentation edits.

## Database validation

Keep business validation and extensible vocabularies in application code. Do not add SQL CHECK constraints or business-validation triggers. SQLite owns keys, uniqueness, `NOT NULL`, and the existing audit/URL-alias immutability protections. Reuse operation validators and validate related state within the write transaction; fixture loaders and normal test helpers must use applicable shared validation. Prefer existing operation guarantees over duplicate storage-row schemas. Keep schema changes aligned with [ADR 001](docs/decisions/001-sqlite-and-drizzle.md) and [storage integrity](openspec/specs/operations/storage-integrity/spec.md).
