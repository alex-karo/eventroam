# Design

## Change size

Small. This change replaces the apex page's content and presentation. It changes the apex routing description but adds no host, API, database field, or dependency. The user supplied the LinkedIn destination. No product decisions remain open.

## Approach

The apex homepage presents the system, shows the festival catalog, then offers two services and direct contact. Use exactly three main sections. Keep the author statement inside the last section. The [proposal](proposal.md) explains the audience and scope; the [presentation spec](specs/website/project-presentation/spec.md) owns observable behavior.

Keep `requestSite()` as the host selector in `src/app/page.tsx`. Replace only its apex directory branch with a small server-rendered component under `src/features/project-presentation/`. Pass the existing configured Festivals origin into that component. Keep the fixed LinkedIn link with its page content. Use normal links and a section anchor; the page needs no client state or catalog query.

Add styles scoped to the presentation. Use a cool light background and a blue accent. Keep one main heading, clear section headings, visible keyboard focus, and a layout that fits mobile and desktop screens. Exact spacing and typography remain implementation choices.

## Key decisions

- **Use a local catalog image.** Capture the existing fixture catalog through the built-in Browser during implementation. Store an optimized preview under `public/` with useful alternative text. Preserve any map attribution shown in the capture. A static image gives context without loading a second map or embedding discovery on the apex. It must not imply that the preview records came from a real collection run.
- **Include the preview in the web image.** Add `COPY public ./public` to the `web-build` stage in `Dockerfile` before the build command. Remove its now-unused `mkdir -p public`. The existing runtime copy then includes the preview. Keep this input out of the shared source stage because Studio does not use it.
- **Preserve the approved copy.** The text below is the copy source for implementation. The three-step illustration sits below the introduction and stacks on small screens. Keep the fictional-data notice beside the example. Detailed case studies, accuracy figures, technology lists, and new service features are outside this change.
- **Keep metadata local to the apex.** Set its title to `Eventroam | A catalog of structured data` and its description to the introduction below. Do this in the apex metadata branch so shared layout defaults and Festivals metadata do not change. Broader metadata and crawler work remain in `public-site-launch`.
- **Keep contact direct.** Use `https://www.linkedin.com/in/alex-karo/` for the contact link. Both services share it. No form, account, pricing flow, or new configuration setting is needed.

## Approved page copy

These are the three page sections. Their headings do not include the numbers below. Keep Eventroam visible as the project name.

### 1. A catalog of structured data.

From web sources to one catalog, with agents to collect new records and update existing ones.

**Contact me on LinkedIn**

Destination: `https://www.linkedin.com/in/alex-karo/`.

**See an example**

Destination: the festival example section on this page.

Illustrative example: source text for Fictional Atlantic Sounds, June 10–12, 2027, in Lisbon, Portugal. Show three steps: Source text, Structured record, and Data catalog. Show the same event name, dates, and location in a structured record and a highlighted new catalog row. Include two other fictional records. Label the collection mechanism as Agents. Do not add an In development label. Label the example as an illustration. Do not imply a live tool or a real collection run.

### 2. One application: a festival catalog

Dates, locations, and event details in a searchable catalog, with filters and a map.

Built with fictional event data for this demo.

**Explore the festival catalog**

Destination: the configured Festivals root.

### 3. Data for your product

I can apply the same approach to other types of data.

**Get the data**

I collect data from agreed sources and deliver it in the format your product needs.

**Build your own system**

I build a system for your sources, data structure, and workflow.

Built by Alex. Tell me what data you need and how you plan to use it.

**Contact me on LinkedIn**

Destination: `https://www.linkedin.com/in/alex-karo/`.

## Visual direction

Place the heading beside the introduction and contact actions. Put the three-step illustration across the full width below them. Match highlighted source text to the record fields and the new catalog row. Use connecting arrows, with an Agents label between source and record. Stack the steps in reading order on narrow screens. This transformation is the main visual element. Use static HTML; no client state, animation, or extra library is needed. A plain pipeline is shorter but does not show what a client receives.

Use background `#F5F7FA`, surface `#FFFFFF`, text `#192D38`, secondary text `#536572`, accent `#315DDC`, and highlight `#E5EDF9`. Use Bricolage Grotesque for headings, IBM Plex Sans for body copy, and IBM Plex Mono for field labels. Store Latin WOFF2 files and their licenses under `public/fonts/`. Use page-specific font names so catalog typography does not change.

Keep the catalog preview smaller than the first version. Place its description beside the preview on desktop and above it on mobile. Preserve the full screenshot and map attribution. Make the image horizontally scrollable on narrow screens if needed to keep records readable. Show the two services together, then a short author statement and shared contact action. Use the same contact label at both locations.

## Risks and validation

- A global style or metadata edit could affect Festivals. Keep the changes local and check both configured roots. Existing host mapping and public path tests already cover the routing helpers; no new host abstraction is needed.
- A weak preview or narrow layout could hide the example or contact path. Use the built-in Browser to inspect mobile and desktop layouts, all links, the image, and keyboard focus. Retain the visible demo notice.
- A local build cannot detect a missing Docker input. Build the `web` target and verify that the final image contains the captured preview at the path used by the page. The existing Compose health check does not check static files.
- The old apex role appears in `README.md`, `docs/development.md`, and `docs/project-structure.md`. Update those descriptions and sync the delta specs after implementation. Do not rewrite historical documents. No new document under `docs/` is needed.
- Run the existing targeted public-catalog tests, type check, lint, build, OpenSpec validation, and documentation check. Use the built-in Browser for local UI checks; do not launch full Chrome through a shell or test runner without approved execution outside the sandbox on macOS.

No data migration or separate deployment step is part of this change.
