# Eventroam

Eventroam is an English-language worldwide event catalog. The first scope covers open-air music festivals and burning-like gatherings. The current Next.js app uses fictional development fixtures; ingestion and public deployment are deferred.

Start at the [documentation index](docs/index.md), then read only the documents relevant to the task. Main OpenSpec specs describe implemented behavior and are grouped by `catalog/` and `website/`; active changes describe approved future work, with matching domain paths in their delta specs; [draft proposals](docs/proposals/) hold unresolved choices.

- Records and writes: [catalog records](openspec/specs/catalog/records/spec.md) and [publication and details](openspec/specs/catalog/publication/spec.md).
- Classification: [Occurrence classification](openspec/specs/catalog/classification/spec.md); the [starter vocabulary](docs/proposals/festival-taxonomy-vocabulary.md) remains a draft.
- Map, list, or filters: [discovery](openspec/specs/website/discovery/spec.md).
- Routes or scope hosts: [scoped website](openspec/specs/website/routing/spec.md).
- Future source workflows, public discovery metadata, and deployment: [active OpenSpec changes](openspec/changes/).
- Code layout or commands: [project structure](docs/project-structure.md) and [development guide](docs/development.md).
- Technology rationale: [decisions](docs/index.md#decisions). Deployment: [Mapbox gate](docs/mapbox-deployment-gate.md).

Use current OpenSpec specs and accepted decisions for implemented behavior; check code and progress docs for exact implementation status. Do not treat active changes or draft proposals as completed behavior. Dated research and [legacy specs](docs/archive/legacy-specs/) are background evidence. For behavior changes, use the standard OpenSpec change workflow and update the owning spec when implementation is complete. Update the documentation index if the document set changes. Run `npm run openspec:validate` for OpenSpec edits and `npm run docs:check` for documentation edits.
