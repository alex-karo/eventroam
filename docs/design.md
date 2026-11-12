---
type: Reference
title: Eventroam — Signal
description: Selected visual direction and implementation guidance for the public website.
status: stable
tags: [design, website]
---

# Eventroam — Signal

Signal is the selected design direction for Eventroam. It combines a precise technical layout with the character of music and travel. Visitors use the catalog to compare events by date and place, then read event details.

The catalog and project presentation use these shared rules. Check sizes and color pairs in the browser when you apply the design. Use the [current OpenSpec specs](../openspec/specs/) for behavior and the [change workflow](change-workflow.md#choose-a-workflow) to choose how to make a change.

## Reference and adaptation

Reference: [Together AI analysis](https://getdesign.md/together.ai/design-md) and its [design preview](https://getdesign.md/design-md/together.ai/preview). This is an independent interpretation on getdesign.md, not an official Together AI design system.

Use its contrast between dark and light surfaces, clear type hierarchy, small corner radii, and limited gradient treatment. The Eventroam adaptation uses a dark header above a light catalog and map. A date block connects the list, selected preview, and edition page.

The main visual feature is the event date beside a strong title. On an edition page, one coral-to-lavender gradient area can sit beside this block. Keep the gradient clear of text and controls. The discovery screen needs no large hero section. The project presentation uses a thin coral-to-lavender rule above its source-to-catalog example; the gradient does not carry data or status.

## Color

Use these shared roles on every public page. Do not define a separate palette for discovery and details.

| Role            | Value     | Use                                              |
| --------------- | --------- | ------------------------------------------------ |
| Ink             | `#151522` | Main text, header, primary buttons               |
| Canvas          | `#FAFAFC` | Page background                                  |
| Surface         | `#FFFFFF` | List, fields, panels                             |
| Muted text      | `#60606F` | Supporting text on light surfaces                |
| Divider         | `#DEDEE7` | Decorative separators                            |
| Control border  | `#858593` | Field and control boundaries                     |
| Lavender        | `#DCD9FA` | Selected row and selected filter surface         |
| Violet          | `#5144B5` | Links, map markers, focus on light surfaces      |
| Coral           | `#E96851` | Decorative brand accent                          |
| Warning text    | `#865000` | Uncertain or provisional data                    |
| Warning surface | `#FFF3D6` | Warning background                               |
| Error text      | `#A3293A` | Error text and error border                      |
| Error surface   | `#FFF0F2` | Error background                                 |

Use white text on Ink and Violet. Use Ink on Lavender and light surfaces. Use Lavender for keyboard focus on the dark header. Coral is not the default text, button, or warning color. The brand gradient runs from Coral to Lavender and has no status meaning.

Always add a label or shape to a status or selection. Color alone must not carry meaning. Check actual color pairs: normal text needs 4.5:1 contrast; large text and required control indicators need 3:1.

## Typography

Use Space Grotesk for titles, body text, and controls. Use IBM Plex Mono for short date labels, counts, and compact data. Load the actual font files when implementing; a CSS family name alone does not load a font. Provide sans-serif and monospace fallbacks and check the fallback layout.

| Role                   | Target                                                         |
| ---------------------- | -------------------------------------------------------------- |
| Edition page title     | 24–44 px; weight 500; line height 1.15                        |
| Section or panel title | 20–24 px; weight 500; line height 1.25                         |
| List event name        | 17–19 px; weight 600; line height 1.3                          |
| Body and form input    | 16 px; weight 400; line height 1.5                             |
| Control label          | 14–16 px; weight 500; line height 1.3                          |
| Supporting text        | 13–14 px; line height 1.45                                     |
| Short mono label       | 12–13 px; line height 1.4                                      |

Use sentence case. Uppercase is limited to short month labels. Keep long names in the regular face and allow them to wrap. Use tabular numbers for counts. Display full dates, including the year, near the compact date block; the block alone is not a complete date range.

## Space and shape

Use a 4 px spacing unit: 4, 8, 12, 16, 24, 32, 48, and 64 px. Start with 16–24 px panel padding. Use the [result row guidance](#result-row-and-date-block) for discovery rows.

Use 4 px corners on buttons and date blocks, 8 px on search fields, and up to 12 px on floating panels. The mobile results sheet uses 16 px top corners. Use circles for map markers and compact icon controls. Keep borders at 1 px. Separate rows with lines instead of placing each row in a raised card.

Only floating panels need a soft shadow: start with `0 12px 32px rgb(21 21 34 / 12%)`. Use surface contrast for other layers.

## Page layout

Place the discovery controls above the list and map. Use the [discovery spec](../openspec/specs/website/discovery/spec.md) for the controls and result views. On desktop, start with a 360 px results panel on the left. On tablets, start with 300 px.

Keep the header compact, approximately 64 px on desktop. Keep filter access visible and prevent panels from covering required map attribution. Allow the list and panels to scroll within their available space. Hide footer result counts on mobile; keep the footer links visible.

On small screens, show results in a bottom sheet and keep the footer below the workspace. Stack fields when they no longer fit. Allow the header to grow when text wraps. Use compact 32 px month buttons. Keep primary controls at least 44 px high for touch. Check 320, 390, 768, and 1440 px widths, plus 200% zoom. No page-level horizontal scroll is acceptable.

Event and edition pages use the same header, fonts, and controls. Place the Festival overview link below the history list in Other editions. On Edition pages, keep the date block beside the title and put known classification tags below the title. On wide screens, put dates, status, place, known short festival text, and estimated size on the left of the opening area. Put base price, its conditions, and ticket and official-site links on the right. Stack these areas in the same reading order on phones. Give one ticket link primary emphasis for upcoming Editions that are not cancelled or postponed; otherwise prefer the official site. Keep other links below the detail sections. Put full text, known ticket categories, full address, map, and history below the opening area. Let long or enlarged text increase the page height. Do not crop facts or controls to fit one screen. Use a readable content width near 1120 px, with body text near 65 characters per line. The root directory uses the same system at a smaller content width.

## Components and states

### Header and search

Use Ink for the header with white text. Keep the Eventroam wordmark simple. Search must have a visible label or an accessible name and a clear boundary. Preserve the name search behavior. Do not add unsupported accounts, saved events, or navigation destinations.

### Result row and date block

Use compact result rows with 12 px vertical padding and 16 px names. Place the date in a fixed-width left column and the name and facts in a flexible column. The main row button selects the festival and shows its location on the map. A separate 44 × 44 px link in the top right corner opens its edition page in a new tab. Use the new-page icon. Keep this link outside the row button and label it for screen readers. Use a month label and day number in the compact date block. Keep full date ranges in the text. Show status text only when needed.

Use Lavender for the selected row, with a Violet side rule and a pressed state on its row button. Use a light neutral surface on hover. Keep hover, keyboard focus, and selection distinct. Show uncertainty labels and missing location information in plain text.

### Buttons, fields, and filters

Primary action: Ink with white text. Secondary action: Surface with a Control border. Selected option: Lavender with Ink text and a Violet border. Preserve visible focus on all states. Disabled controls must still be readable and must expose their disabled state.

Keep input labels above fields. Keep long values readable in the filter pickers. Follow the [discovery spec](../openspec/specs/website/discovery/spec.md) for pending and applied values, button summaries, and filter actions.

### Map and preview

Use a light map with low visual noise. Keep place names readable. Use Violet for festival points and clusters, with a thin white border. The selected point has a larger circle and an extra Violet ring with a white gap. Keep its outer diameter at 20 px. Check contrast against land and water. Preserve cluster counts, location precision, and accessible selection behavior.

On desktop and tablet, the selected preview is a white panel with the same date, type, and status treatments as the full page. Show all available facts and links without an expand or collapse control. Keep its close control visible. Use a small violet Open page text link with the new-page icon. Both the title and Open page links open a new tab. Provide clear loading and error states.

On mobile, show the selected card in place of the results list in the bottom sheet. Start each new selection with name, dates, place, and Open page. Provide expand, collapse, and close controls. Expansion shows types, music, known size, base price, and external links. Keep the header and Open page outside the scrolling content. Keep part of the map visible. Closing the card restores the list view and scroll position. Keep catalog errors and Retry accessible while the card is open. Missing coordinates must not remove an otherwise eligible event from the list. Moving the map must not change result eligibility.

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
- Long names, filter summaries, missing facts, provisional dates, and empty results remain clear.
- Selection agrees between the row and map marker. Open page navigates separately.
- Keyboard focus, touch targets, contrast, zoom, and reduced motion work.
- Mobile panels fit the available height and leave a visible close or recovery action.
- Map attribution and existing discovery behavior remain intact.
- The interface works without photographs and with fallback fonts.

Use shared CSS tokens for colors, space, type, radii, and states when implementing. Keep feature behavior in its existing modules. This design file does not require a new component library, a dark mode, or a change to catalog data.
