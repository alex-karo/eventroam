## Context

Date shortcuts resolve to ordinary inclusive bounds. The native month control is uncontrolled and does not reflect its resolved selection.

## Goals / Non-Goals

Provide six visible month choices with year context and exact-bound selection feedback. Preserve custom dates, pending preview, Apply/Cancel and duration shortcuts. No multi-month selection.

## Decisions

Use the visitor’s local current month and next five months, captured when the picker mounts. Each button replaces both date bounds with the full calendar month. Use aria-pressed for exact-bound selection and the existing pill styling with a selected tint. Clearing custom fields still restores default upcoming/ongoing matching.

## Risks / Trade-offs

Months may have zero editions; retain the honest zero count and enabled apply action. Custom dates cover months beyond the six shortcuts.
