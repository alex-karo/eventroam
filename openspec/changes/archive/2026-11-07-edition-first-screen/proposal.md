# Proposal

## Why

Visitors need to assess an Edition before they read the detail sections. The current page puts all facts and links in one column. The user approved a compact summary with a separate ticket area and a mobile layout.

## What Changes

- Use a smaller Edition title and place classification tags below it.
- Group dates, place, festival summary, and size in the opening area.
- Place base price and ticket and official-site links beside these facts on wide screens.
- Stack the same content in reading order on small screens.
- Keep full text, ticket categories, street address, map, other links, and history below.
- Put the Festival overview link with the Edition history.
- Preserve date, status, location, price, and category availability meanings.

## Capabilities

### Modified Capabilities

- `website/festival-details`:
  - **Before**: Key facts and all external links appear near the top. All sections use one column. The current implementation puts the Event link above the Edition title and has no short description in its opening area.
  - **After**: Classification tags appear below the smaller title. The opening area has facts and a ticket area in two columns on wide screens and one column on small screens. A known short description appears with the facts. Other links follow the detail sections. Other editions contains the link to the Event page.

## Impact

Edition page markup, shared external-link presentation, page CSS, presentation tests, and design guidance. No storage, public payload, or dependency changes.
