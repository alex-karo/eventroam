# Design

## TL;DR

The apex home links to two service pages and the festival catalog. Each service page tells one case from source to result and ends with an email invitation. Use the shared presentation styles and the existing host, metadata, sitemap, and analytics code.

## Contracts

Proposed public paths on the apex host:

```text
/data
/custom-systems
```

Return 404 for the service paths on the festival host. Each apex page has its own canonical URL and sitemap entry. Use the same contact link on all three pages. For new contact clicks, the existing [promo link event](../../../src/features/project-presentation/promo-link.tsx) records the following destination:

```ts
destination: "email"
```

Keep the existing hero and footer placement names for email links. Catalog links keep the example placement.

## Key decisions

Keep the cases on the service pages so a shared link contains both the service and the evidence. Identify the source of dated facts and link to the published catalog record. Label illustrative pipelines as examples. Keep the reusable writing prompts in a short guide. The pages can render without access to private research or a catalog database.
