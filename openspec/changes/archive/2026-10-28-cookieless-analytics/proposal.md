# Proposal

## Why

Eventroam needs basic usage statistics with optional persistent browser identity and without visitor profiles or session recordings. Visitors need a clear privacy notice.

## What Changes

- Use cookieless capture before a choice and after Reject. Accept enables a persistent browser identifier. Keep page views and existing explicit discovery and promo events.
- Disable automatic interaction and error capture, profiles, recordings, and other optional capture.
- Keep the existing analytics off/on links. Use SDK consent storage and allow tracking storage only after acceptance. Add a full analytics opt-out in the banner and policy.
- Add a compact bottom banner with Reject, Accept, and a Privacy policy link.
- Add a Privacy policy page and links on both public sites.

## Capabilities

### New Capabilities

- `website/privacy`: Public privacy notice and cookieless browser analytics.

### Modified Capabilities

- `website/discoverability`: Include the Privacy policy in each public host sitemap.

- `website/promo-analytics`:
  - **Before**: The SDK stores the owner opt-out choice and blocks capture on that origin.
  - **After**: The SDK stores the choice and uses no new analytics events for off, basic cookieless capture for basic, and a persistent browser identifier for on.

## Impact

Browser instrumentation, the global error page, public page links, analytics documentation, and PostHog project settings. No new dependencies or catalog storage changes.
