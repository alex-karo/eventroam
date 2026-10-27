# Tasks

## 1. Page metadata

- [x] 1.1 Add metadata builders and connect both roots and Event/Edition pages to existing public request adapters. Start and pass the metadata smoke checks defined in design. Document public origins and metadata in the development guide and project structure; run `npm run docs:check`.

## 2. Crawler routes

- [x] 2.1 Add the small public URL query and request-time robots/sitemap routes. Extend and pass the same smoke suite with the crawler checks defined in design. Document endpoints and later manual Search Console steps in the existing guides; run `npm run docs:check`.

## 3. Edition structured data

- [x] 3.1 Build and render optional Edition Event JSON-LD. Add and pass only the small test table and JSON-LD smoke checks defined in design. Document JSON-LD eligibility and independent page indexing in the existing guides; run `npm run docs:check`.

## 4. Integration

- [x] 4.1 Run the complete minimal smoke suite against the built application with runtime origins. Run the existing `type-check`, `lint`, `deps:check`, `test`, `build`, `docs:check`, and `openspec:validate` npm scripts. Check the remaining discoverability scenarios against the implementation without adding a test per scenario, then sync the completed delta through the normal OpenSpec workflow.
