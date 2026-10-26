---
type: Reference
title: Eventroam Signal design
description: Selected visual direction and implementation guidance for the public website.
status: stable
tags: [design, website]
---

# Eventroam — Signal

Signal is the selected design direction for Eventroam. It combines a precise technical layout with the character of music and travel. Visitors use the catalog to compare events by date and place, then read event details.

This file records the design decision. The catalog and project presentation use these shared rules. Sizes and color pairs below are implementation targets; check them in the browser when applying the design. Current OpenSpec specs own behavior. Use the standard change workflow for behavior changes.

## Reference and adaptation

Reference: [Together AI analysis](https://getdesign.md/together.ai/design-md) and its [design preview](https://getdesign.md/design-md/together.ai/preview). This is an independent interpretation on getdesign.md, not an official Together AI design system.

Use its contrast between dark and light surfaces, clear type hierarchy, small corner radii, and limited gradient treatment. The Eventroam adaptation uses a dark header above a light catalog and map. A date block connects the list, selected preview, and edition page.

The main visual feature is the event date beside a strong title. On an edition page, one coral-to-lavender gradient area can sit beside this block. Keep the gradient clear of text and controls. The discovery screen needs no large hero section. The project presentation uses a thin coral-to-lavender rule above its source-to-catalog example; the gradient does not carry data or status.

## Color

Use these shared roles on every public page. Do not define a separate palette for discovery and details.

| Role | Value | Use |
| --- | --- | --- |
| Ink | `#151522` | Main text, header, primary buttons |
| Canvas | `#FAFAFC` | Page background |
| Surface | `#FFFFFF` | List, fields, panels |
| Muted text | `#60606F` | Supporting text on light surfaces |
| Divider | `#DEDEE7` | Decorative separators |
| Control border | `#858593` | Field and control boundaries |
| Lavender | `#DCD9FA` | Selected row and selected filter surface |
| Violet | `#5144B5` | Links, selected markers, focus on light surfaces |
| Coral | `#E96851` | Decorative brand accent |
| Warning text | `#865000` | Uncertain or provisional data |
| Warning surface | `#FFF3D6` | Warning background |
| Error text | `#A3293A` | Error text and error border |
| Error surface | `#FFF0F2` | Error background |

Use white text on Ink and Violet. Use Ink on Lavender and light surfaces. Use Lavender for keyboard focus on the dark header. Coral is not the default text, button, or warning color. The brand gradient runs from Coral to Lavender and has no status meaning.

Always add a label or shape to a status or selection. Color alone must not carry meaning. Check actual color pairs: normal text needs 4.5:1 contrast; large text and required control indicators need 3:1.

## Typography

Use Space Grotesk for titles, body text, and controls. Use IBM Plex Mono for short date labels, counts, and compact data. Load the actual font files when implementing; a CSS family name alone does not load a font. Provide sans-serif and monospace fallbacks and check the fallback layout.

| Role | Target |
| --- | --- |
| Edition page title | 40–56 px desktop; 28–36 px mobile; weight 500; line height 1.1 |
| Section or panel title | 20–24 px; weight 500; line height 1.25 |
| List event name | 17–19 px; weight 600; line height 1.3 |
| Body and form input | 16 px; weight 400; line height 1.5 |
| Control label | 14–16 px; weight 500; line height 1.3 |
| Supporting text | 13–14 px; line height 1.45 |
| Short mono label | 12–13 px; line height 1.4 |

Use sentence case. Uppercase is limited to short month labels. Keep long names in the regular face and allow them to wrap. Use tabular numbers for counts. Display full dates, including the year, near the compact date block; the block alone is not a complete date range.

## Space and shape

Use a 4 px spacing unit: 4, 8, 12, 16, 24, 32, 48, and 64 px. Use 16–24 px panel padding and 16 px list-row padding as starting values.

Use 4 px corners on buttons, inputs, date blocks, and cards. Use up to 8 px on floating panels. Use circles for map markers and compact icon controls. Keep borders at 1 px. Separate rows with lines instead of placing each row in a raised card.

Only floating panels need a soft shadow: start with `0 12px 32px rgb(21 21 34 / 12%)`. Use surface contrast for other layers.

## Page layout

Desktop discovery keeps a list beside the map. Start near 40% list and 60% map; protect readable names and usable filters before enforcing that ratio.

```text
[ Dark header: Eventroam | scope | search                 ]
[ Results and applied filters | Map and filter controls  ]
[ Date | Event name           |                          ]
[      | Place and facts      | Selected marker          ]
[ Date | Event name           | Detail preview           ]
```

Keep the header compact, approximately 64 px on desktop. Keep filter access visible and prevent panels from covering required map attribution. Allow the list and panels to scroll within their available space.

On small screens, keep the existing list/map switch and filter flow. Stack fields when they no longer fit. Allow the header to grow when text wraps. Keep controls at least 44 px high for touch. Check 320, 390, 768, and 1440 px widths, plus 200% zoom. No page-level horizontal scroll is acceptable.

Event and edition pages use the same header, fonts, and controls. Place navigation above the title. Group dates, place, tickets, and official links into clear sections. Use a readable content width near 1120 px, with body text near 65 characters per line. The root directory uses the same system at a smaller content width.

## Components and states

### Header and search

Use Ink for the header with white text. Keep the Eventroam wordmark simple. Search must have a visible label or an accessible name and a clear boundary. Preserve the name search behavior. Do not add unsupported accounts, saved events, or navigation destinations.

### Result row and date block

Place the date in a fixed-width left column, the name and facts in a flexible middle column, and the details action in the remaining space. Move the action below the text when needed. Use a month label and day number in the compact date block. Keep full date ranges in the text.

Use Lavender for the selected row, with a Violet side rule and a pressed state on its details control. Use a light neutral surface on hover. Keep hover, keyboard focus, and selection distinct. Show uncertainty labels and missing location information in plain text.

### Buttons, fields, and filters

Primary action: Ink with white text. Secondary action: Surface with a Control border. Selected option: Lavender with Ink text and a Violet border. Preserve visible focus on all states. Disabled controls must still be readable and must expose their disabled state.

Keep input labels above fields. Show pending and applied filter values according to the current discovery contract. Applied chips contain a readable value and a named remove action. Long values wrap. Preserve the existing Apply and Clear actions and their behavior.

### Map and preview

Use a light map with low visual noise. Keep place names readable. Use Ink for ordinary markers and Violet with an extra ring or size change for the selected marker. Check contrast against land and water. Preserve cluster counts, location precision, and accessible selection behavior.

The selected preview is a white panel with the same date, type, and status treatments as the full page. Keep its close control visible. Provide clear loading and error states. Missing coordinates must not remove an otherwise eligible event from the list. Moving the map must not change result eligibility.

### Event details and images

Repeat the date block at a larger size on edition pages. Event pages without one definite edition date use the event title and edition list. Never invent a date to complete the layout.

Use photographs only when suitable event images and usage rights are available. Text-only cards must look complete. Do not use stock images or generated crowd images as evidence of a real event. A decorative gradient is optional and must not imply event facts.

### Empty, loading, and error states

Keep the content area stable during loading. Use short text that explains what is happening. Empty results explain that no editions match and retain the clear-filter action. Errors explain the problem and show the available recovery action. Keep warnings, errors, and selected states visually distinct.

## Motion and accessibility

Use 120–180 ms transitions for color and border changes. Avoid moving list rows, animated gradients, and decorative map pulses. Respect reduced motion. Keep keyboard focus visible and preserve keyboard access, dialog focus handling, and accessible names from the current UI.

Use simple English in interface text. Keep the same action name across controls and feedback. Do not expose internal record identifiers, ingestion terms, or implementation details in the public UI.

## Implementation review

Before accepting a UI change, check the following in the built-in Browser:

- Discovery, filter panel, selected preview, event page, and edition page share the same tokens.
- Long names, wrapped filter chips, missing facts, provisional dates, and empty results remain clear.
- Selection agrees between the row, details control, and map marker.
- Keyboard focus, touch targets, contrast, zoom, and reduced motion work.
- Mobile panels fit the available height and leave a visible close or recovery action.
- Map attribution and existing discovery behavior remain intact.
- The interface works without photographs and with fallback fonts.

Use shared CSS tokens for colors, space, type, radii, and states when implementing. Keep feature behavior in its existing modules. This design file does not require a new component library, a dark mode, or a change to catalog data.
