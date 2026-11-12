# Proposal

## Why

Measure GitHub visits and LinkedIn contact clicks on the project presentation.

## What Changes

Track contact and catalog links, document distinct GitHub profile and README URLs, and let owner browsers stop future capture.

## Requirements

- The owner can distinguish LinkedIn contact clicks in the hero and footer from catalog entry clicks. Keep link destinations and require no visitor identification.
- GitHub profile and README visits can be measured separately. Document the campaign URL for each placement.
- An owner browser can stop future capture with `?analytics=off` and resume it with `?analytics=on` or cleared site storage. The choice persists separately on each public origin; earlier events remain stored.

## Acceptance criteria

- Each contact or catalog click appears with its destination and placement and still follows the correct link, including the configured Festivals origin.
- The analytics guide provides separate GitHub profile and README campaign URLs.
- Opt-out suppresses the entry page view and later events on that origin without affecting another origin or browser. The choice survives a reload, opt-in resumes capture, and earlier events remain stored.

## Impact

Project presentation, existing PostHog browser SDK, and development guide. No new dependencies.
