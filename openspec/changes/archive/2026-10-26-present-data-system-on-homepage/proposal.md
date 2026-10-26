# Proposal

## Why

The main domain currently shows a short scope directory. Product teams and founders need to understand the data collection system, see its festival catalog example, and contact its author about their own data needs.

## What Changes

- Replace the apex directory with three short English sections: system presentation, festival catalog example, and cooperation options.
- Use the approved copy in [design.md](design.md#approved-page-copy). Present the system before its services. Use a labeled source-to-record-to-catalog illustration and an early contact link. Keep technical detail brief.
- Show the festival catalog as the first example, with a preview image, a link to its configured origin, and the fictional-data notice.
- Offer data collection as a service and custom system development for other subject areas. Both options lead to the author's [LinkedIn profile](https://www.linkedin.com/in/alex-karo/).
- Keep the Festivals host and its existing catalog routes intact.

## Capabilities

### New Capabilities

- `website/project-presentation`: The apex page's system introduction, example, service options, and direct contact path.

### Modified Capabilities

- `website/routing`:
  - **Before**: The apex host shows a scope directory linking to Festivals. The current code follows this contract.
  - **After**: The apex host shows the project presentation and links to Festivals as its example. Other host and record-route rules stay the same.

## Impact

The change affects the apex branch in `src/app/page.tsx`, its page metadata, a small presentation component, styles, and a local catalog preview image, and local font files. `Dockerfile` must copy the preview into the web build so the final web image includes it. README and the development and project-structure guides must describe the new apex role when it is implemented.

No catalog, ingestion, database, or public API contract changes are required. Public deployment and broader search metadata remain in the existing launch work. This change does not build a customer data service, scheduled collection, a contact form, pricing, or additional case studies; it presents services that start with a personal discussion.
