# Tasks

## 1. Cookieless analytics

- [x] 1.1 Configure the browser SDK and preserve off/on control. Add focused tests for payload limits, no tracking storage, and opt-out. Update the analytics guide. Verify focused tests and types.
- [x] 1.2 Check the target PostHog project and enable cookieless ingestion if needed. Verify the saved project setting.

## 2. Privacy notice

- [x] 2.1 Add the notice, public links, and sitemap entries. Extend HTTP smoke checks for both hosts and unknown hosts. Verify the notice in the built-in Browser and run the smoke checks.

## 3. Integration

- [x] 3.1 Update main specs and run type, lint, documentation, and OpenSpec checks. Review the final diff for consistency with the notice.

- [x] 3.2 Add the short privacy summary and provider table. Check current PostHog and production log storage settings. Verify layout, types, documentation, and specs.

## 4. Analytics banner

- [x] 4.1 Add the compact banner and require acceptance before SDK startup. Preserve off/on controls and cross-tab withdrawal. Update the policy and guide. Verify consent, SDK payload limits, and responsive Browser layout.

- [x] 4.2 Use cookieless capture before choice and after Reject, and persistent identity after Accept. Update the banner and notice. Verify real SDK transitions, reloads, shared choice, and payload limits.

## 5. Full analytics opt-out

- [x] 5.1 Add disabled choice, banner and policy controls, and clear privacy text. Update specs and docs. Verify transitions, reloads, other tabs, blocked storage, and UI layout.
