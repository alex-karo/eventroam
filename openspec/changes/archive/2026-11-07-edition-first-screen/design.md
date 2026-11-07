# Design

## TL;DR

Use the existing Edition page and fact components. Keep the date block beside the title. Use a smaller title and put the wrapping tags below it. Below this group, put dates, status, place, short description, and size on the left. Put base price and ticket and official-site links on the right. Stack the grid below 740 px. The DOM keeps this same reading order.

Reuse Signal fonts, colors, and controls. Give one link primary emphasis. For upcoming active Editions, prefer the first ticket link, then the first official-site link. For past, cancelled, or postponed Editions, prefer the official site. Keep all supplied booking links. Move other links below the detail sections.

Use only nonblank shortDescription in the opening summary. A long description stays below; do not crop it or add summary-generation code. Keep all classification terms. Long names, warnings, and text can increase the page height. Do not use a fixed-height hero, sticky controls, or new client state.

Reuse date, location, price, category, and historical-link formatting. If categories are known but no base price is known, show Price not available in the ticket area. If no categories are known, omit the separate category section; keep the existing no-ticket-data fallback once in the opening area. Full address stays in Location.

Move the Event link below the history list in Other editions and label it Festival overview. Keep the new-tab behavior. This removes the repeated festival name above the Edition title.

## Contracts

Proposed addition to [ExternalLinks](../../../src/components/catalog/external-links.tsx):

```typescript
primaryUrl?: string;
```

This optional presentation prop gives at most one rendered link primary emphasis. Existing callers retain their presentation.

Proposed addition to [TicketPrice](../../../src/components/catalog/catalog.tsx):

```typescript
showLabel?: boolean; // Defaults to true.
```

The ticket area uses its heading as the label. Other callers retain the inline label.

## Risks and validation

Check link selection and missing data in server-rendered presentation tests. Keep existing historical, price, map, and description checks. Use the built-in Browser at 320, 390, 768, and 1440 px, with long text and enlarged text. Check that key facts and actions fit a typical phone screen with normal fixture content. Do not hide content to force that fit.
