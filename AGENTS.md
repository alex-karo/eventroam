# Eventroam

Eventroam is an English-language worldwide event catalog. The first scope covers open-air music festivals and burning-like gatherings. The current Next.js app uses fictional development fixtures; ingestion and public deployment are deferred.

Start at the [documentation index](docs/index.md), then read only the documents relevant to the task:

- Product behavior or release scope: [product foundation](specs/000-product-foundation.md) and the relevant spec.
- Records, publication, or writes: [domain model](specs/001-domain-model.md); consult the [taxonomy](specs/002-festival-taxonomy.md) for classifications.
- Map, list, or filters: [discovery filters](specs/004-discovery-filters.md).
- Routes or scope hosts: [website structure](specs/005-website-structure-and-urls.md).
- Code layout or commands: [project structure](docs/project-structure.md) and [development guide](docs/development.md).
- Technology rationale: [decisions](docs/index.md#decisions). Deployment: [Mapbox gate](docs/mapbox-deployment-gate.md).

Use current specs and accepted decisions for intended behavior; check code and progress docs for what is implemented. Draft proposals are open choices. Dated research is background evidence and does not override current specs or decisions. When changing a documented behavior, update its owning document and the index if the document set changes. Run `npm run docs:check` for documentation edits.
