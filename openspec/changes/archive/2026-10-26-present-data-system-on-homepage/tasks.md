# Tasks

## 1. Present the system on the apex homepage

- [x] 1.1 Capture the existing fixture catalog through the built-in Browser and save an optimized local preview under `public/`. Verify that the image represents the current interface and retains any visible map attribution.
- [x] 1.2 Create the presentation component and scoped styles using the [approved copy](design.md#approved-page-copy). Include the preview, three ordered sections, example anchor, configured Festivals link, and supplied LinkedIn link. Verify that the rendered page matches the copy and has no additional main section.
- [x] 1.3 Replace the apex directory branch in `src/app/page.tsx` and set its title and description as specified in the design. Verify the apex and Festivals roots and their metadata; run `npm test -- src/catalog/read/public-catalog.test.ts` to check existing host and public-path rules.
- [x] 1.4 Add `COPY public ./public` to the `web-build` stage in `Dockerfile` before its build command, and remove the unused `mkdir -p public`. Build the `web` target and verify that the final image contains the captured preview at the path used by the page.
- [x] 1.5 Update the apex descriptions in `README.md`, `docs/development.md`, and `docs/project-structure.md`. Sync the two delta specs once the behavior is implemented. Verify that current docs and main specs describe the implemented page, then run `npm run docs:check` and `npm run openspec:validate`.

## 2. Verify the complete page

- [x] 2.1 Use the built-in Browser to check mobile and desktop layouts, heading order, keyboard focus, the example anchor, the Festivals destination, and the LinkedIn destination. Verify that the preview and fictional-data notice remain readable and the Festivals layout still works. Record the results in the implementation handoff.
- [x] 2.2 Run `npm run type-check`, `npm run lint`, and `npm run build`. Verify that all commands pass with the new page and local image included.

## 3. Refine the client presentation

- [x] 3.1 Apply the revised copy, source-to-record illustration, local fonts, and compact catalog layout. Verify that there are three main sections and that the illustration is labeled and uses matching values.
- [x] 3.2 Check desktop and narrow mobile layouts in the built-in Browser. Verify font loading, readable preview, keyboard focus, all links, and unchanged Festivals presentation. Run type check, lint, and production build.
- [x] 3.3 Sync the presentation spec and record the new validation results. Run OpenSpec validation and docs checks. Verify that the web image includes the new local fonts and preview.

## 4. Show the catalog as the result

- [x] 4.1 Update the introduction and apex metadata. Extend the illustration to three steps with an Agents label and a matching highlighted catalog row. Use a full-width desktop layout and a vertical mobile layout.
- [x] 4.2 Check the diagram, links, metadata, and page width in the built-in Browser on desktop and mobile. Run type check, lint, and production build. Sync the presentation spec, update docs, and run both validation commands.

## Initial implementation handoff

Verified on 2026-10-26:

- Built-in Browser: desktop at 1280 × 720 and mobile at 390 × 844 and 320 × 740. The page has three main sections, one h1, two h2 headings, and two service h3 headings. The layouts have no horizontal page overflow. The preview loads, retains map attribution, and has a readable fictional-data notice.
- All three links have visible keyboard focus. The example anchor moves the example to the viewport. The catalog link opens the configured Festivals root. The rendered contact link has the supplied LinkedIn URL.
- The apex title and description match the design. Festivals keeps its title, description, and canonical URL. Its desktop list and map render; its mobile list, filter panel, and map view work.
- The optimized preview is 96,824 bytes. The final `web` image contains `/app/public/festival-catalog.webp`; its SHA-256 matches the local asset.
- Public catalog tests: 12 passed. Type check, lint, production build, dependency checks, focused formatting checks, docs checks, and OpenSpec validation passed. Main presentation and routing specs are synced.

## Client presentation refinement handoff

Verified on 2026-10-26:

- The page keeps three sections. The introduction has a labeled source-to-record illustration and a direct LinkedIn link. The source and record use the same event, dates, and place.
- Built-in Browser: desktop at 1280 × 800, mobile at 390 × 844 and 320 × 740. No horizontal page overflow. The preview scrolls horizontally on mobile and responds to the keyboard. The contact link and preview have visible keyboard focus. The example link moves to the correct section. The catalog link opens the configured Festivals root. Both contact links have the supplied LinkedIn URL.
- The new preview is 900 × 720 and 94,482 bytes. It shows all four fixture records and retains map attribution. It uses `public/festival-catalog-preview.webp` so the prior optimized image does not remain in the cache.
- The local display, body, and data fonts return HTTP 200. Font names are scoped to the presentation. Festivals keeps its font family, title, description, canonical URL, and mobile list.
- Type check, lint, production build, formatting, docs checks, and OpenSpec validation passed. The main presentation spec is synced.
- The final web image includes the new preview, three WOFF2 files, and their licenses. All seven files match the local SHA-256 hashes.

## Three-step catalog handoff

Verified on 2026-10-26:

- The introduction and metadata present a structured data catalog with agents to collect and update records. The illustration shows Source text, Structured record, and Data catalog. The Agents label names the collection mechanism. The new catalog row matches the source and record.
- Built-in Browser: 1280, 820, 390, and 320 pixel widths. The page has no horizontal overflow. The steps stack on mobile. Three main sections remain. The example anchor works, keyboard focus is visible, and the catalog and LinkedIn links keep their configured destinations.
- Production build, type check, lint, formatting, docs checks, and OpenSpec validation passed. The main presentation spec and project structure guide match the new diagram. No asset or Docker input changed in this refinement.
- Direct plan review: specs, proposal, and design checks passed. The change adds static content and scoped layout rules. No new state, dependencies, or abstraction is needed. No useful further simplification was found. This small plan had no independent review.
