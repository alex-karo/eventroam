---
type: Guide
title: Analytics
description: PostHog setup, browser events, GitHub campaign links, and owner opt-out.
status: stable
tags: [analytics, posthog]
---

# Analytics

Set `NEXT_PUBLIC_POSTHOG_KEY` to the project token and `NEXT_PUBLIC_POSTHOG_HOST` to the ingestion host. Leave both empty to disable PostHog. Browser settings are compiled at build time; rebuild after changing them. The website uses `cookieless_mode: "on_reject"` and `opt_out_capturing_by_default: true`. Basic cookieless events run before a choice and after Basic statistics. Allow cookies enables a persistent random browser identifier for return-visit analysis. A bottom banner offers Disable analytics, Basic statistics, Allow cookies, and a Privacy policy link. Full opt-out blocks all new analytics events. It records page views and explicit discovery and promo actions. Profiles, session recordings, automatic interaction events, browser errors, performance events, and surveys are disabled. URL properties exclude query strings and fragments; search events contain counts, not search text.

For each target project, enable **Settings > Project > Web analytics > Enable cookieless tracking** in the matching PostHog project. Without this setting, ingestion drops cookieless events. See [PostHog cookieless tracking](https://posthog.com/tutorials/cookieless-tracking). The daily visitor hash limits repeat-visit analysis; weekly and monthly visitor counts can count the same person more than once.

The current Eventroam EU project uses stateless cookieless ingestion (`cookieless_server_hash_mode: 1`). This account setting is separate from the code and does not require deployment.

Both public hosts serve `/privacy` with links to disable analytics or choose basic or extended analytics. The policy describes website storage separately from analytics. Review provider agreements, retention, and operator contact details before release; cookieless mode alone does not establish legal compliance.

Ingestion exports traces only when `CATALOG_TRACING=true` and both PostHog settings are present. Search generation events contain model, token counts, timing, and correlation IDs. They exclude prompts and model replies. Search results do not wait for remote telemetry delivery.

For Compose, set `EVENTROAM_POSTHOG_KEY` and `EVENTROAM_POSTHOG_HOST`. These supply browser build arguments and Studio runtime settings. Rebuild the web image after changing them. Ingestion tracing still requires `EVENTROAM_CATALOG_TRACING=true`.

The project presentation records `promo_link_clicked` for LinkedIn contact links (`destination: "linkedin"`, `placement: "hero" | "footer"`) and the catalog link (`destination: "festivals"`, `placement: "example"`). These events record clicks, not activity on LinkedIn.

Use these public links to separate GitHub traffic:

- Profile: https://eventroam.org/?utm_source=github&utm_medium=profile&utm_campaign=eventroam
- Repository README: https://eventroam.org/?utm_source=github&utm_medium=readme&utm_campaign=eventroam&utm_content=eventroam

PostHog captures the UTM parameters on page views. Use the UTM event properties to compare campaign traffic. Basic cookieless analytics does not use a permanent browser ID. Advertising click IDs and search terms from referrers are removed.

To disable all new browser analytics after deployment, open both links once:

- https://eventroam.org/?analytics=off
- https://festivals.eventroam.org/?analytics=off

The SDK and banner share `eventroam.analytics.choice` in local storage (`1` for accepted, `0` for basic, `disabled` for full opt-out). Missing choice means cookieless capture and a visible banner. Allow cookies calls `opt_in_capturing({ captureEventName: false })`; Basic statistics calls `opt_out_capturing()`. Full opt-out also calls `opt_out_capturing()` and saves `disabled`; the SDK treats that value as no consent. The event filter blocks every new event while this choice is active. The SDK handles identity changes, including changes in other tabs. Do not call `reset()` or reinitialize the SDK for consent changes. The application clears remaining SDK window IDs from session storage in basic mode. Cookies are scoped to each host; set the choice on both origins. Acceptance enables SDK cookies, local storage, and session storage, but never profiles or recordings. If storage is blocked, the banner choice applies to the current page only and the SDK can remain in cookieless mode. Clearing site storage returns to basic mode. Use `?analytics=on` on each origin to accept the persistent identifier. Use `?analytics=basic` to restore basic capture. Events collected before opt-out can finish delivery and remain in PostHog.

The default cookieless behavior was fixed in SDK 1.369.4; this project uses 1.440.0. See [PostHog issue 2841](https://github.com/PostHog/posthog-js/issues/2841). Do not add a manual page view at startup: the SDK captures it. Consent transitions can emit a page view for the new mode, except when analytics is disabled.

## Current storage settings

Checked on 28 October 2026. The Eventroam organization is on the Free plan. Its billing entitlement lists Product Analytics data retention as one year. PostHog describes this as an event query window, not a deletion guarantee. See [event data retention](https://posthog.com/docs/data/events-retention). The connector does not expose the separate `events_retention` endpoint; the period here comes from the live billing entitlement and current documentation. The 30-day recording setting does not apply to website events, and recording is off.

The production Docker daemon and the web, Studio, and Caddy containers use `json-file` with no log options. No size limit, rotation count, or automatic deletion period is set there. The deployed Caddy configuration does not enable request access logs. No explicit retention override is set in journald. These checks read configuration, not log contents, and did not change the server. Cloudflare account log retention was not checked. Set and verify a deletion policy before promising a fixed server-log period.

Production ingress uses Cloudflare and Caddy on Hetzner. The public provider table also lists PostHog and Mapbox. The EU PostHog project does not establish that all providers process data only in the EU; review provider agreements and transfer terms separately.

## Legal assessment

The owner operates Eventroam from Portugal. Cookieless capture remains enabled by the owner's choice. A daily identifier is not a guarantee of anonymous data. The notice describes the actual processing without a claim of full anonymity. The legal basis for cookieless capture, including Portuguese ePrivacy rules, remains under review. Full opt-out and a privacy notice do not establish an exemption from prior consent. Review the actual data flow and document any legitimate-interest assessment before relying on that basis.
