# Design

## Change size

Small. This changes browser initialization and adds one public page. There are no catalog writes or new dependencies. The PostHog project must also accept cookieless events.

## Approach

Keep one SDK instance with `cookieless_mode: "on_reject"`, `opt_out_capturing_by_default: true`, and profiles set to never. Disable recordings, autocapture, errors, performance capture, surveys, and remote flags. Keep the explicit event allowlist and URL scrubber in both modes.

Use SDK consent storage `eventroam.analytics.choice` as the single saved choice. Missing choice means pending and basic cookieless capture. Accept calls `opt_in_capturing` without an extra opt-in event. Reject calls `opt_out_capturing`, removes the persistent identity, and keeps basic events. Keep cookies scoped to each host. Use SDK identity reconciliation for other tabs; remove remaining SDK window IDs in basic mode. If storage is blocked, keep the banner choice in memory. Privacy off/basic/on links select disabled/basic/extended capture before initialization. Store full opt-out as `disabled` in the same preference key. The SDK treats it as no consent and stays cookieless; the application rejects every event in `before_send`. This also blocks new events in other tabs and with blocked storage. Events collected before opt-out can still finish delivery; already collected events are not deleted. Initialize only once; do not use destroy, reset, or duplicate clients for consent transitions.

The banner uses the existing Ink, Canvas, Lavender, and Violet colors and Space Grotesk font. Use a narrow full-width bottom strip, concise text, and equally sized buttons. Reserve its measured height so the discovery controls remain available.

Serve one privacy page on each known host with that host's canonical URL. Use existing catalog typography. Add a small footer link on the presentation and record pages and a header link on discovery, whose viewport layout has no regular footer. Include the notice in both sitemaps.

Use hello@eventroam.org as the direct privacy contact for Aleksandr Ivanov. Explain the purpose, daily hash, full opt-out, and limits of identification without a claim of full anonymity. Document that the legal basis for cookieless collection remains under review. Describe basic request data, website storage, provider links, and rights. Do not invent an event retention period, hosting location, or operator address. State the limits of the notice and check account settings separately.

## Risks and validation

Use SDK integration tests to check storage and outgoing payloads, including page views with private query text and off/on reloads. Use existing HTTP smoke checks for host routing, metadata, links, and sitemap entries. Check the notice on desktop and mobile in the built-in Browser. Verify that the target PostHog project accepts cookieless events before release.

Keep the notice compact with a short summary and a provider table. Report verified storage settings without treating a query window as a deletion guarantee. Provider region and transfer claims need separate evidence.
