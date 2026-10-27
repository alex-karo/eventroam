---
type: Guide
title: Analytics
description: PostHog setup, browser events, GitHub campaign links, and owner opt-out.
status: stable
tags: [analytics, posthog]
---

# Analytics

Set `NEXT_PUBLIC_POSTHOG_KEY` to the project token and `NEXT_PUBLIC_POSTHOG_HOST` to the ingestion host. Leave both empty to disable PostHog. Browser settings are compiled at build time; rebuild after changing them. The website records page views, automatic interaction events, selected discovery actions, and browser errors.

Ingestion exports traces only when `CATALOG_TRACING=true` and both PostHog settings are present. Search generation events contain model, token counts, timing, and correlation IDs. They exclude prompts and model replies. Search results do not wait for remote telemetry delivery.

For Compose, set `EVENTROAM_POSTHOG_KEY` and `EVENTROAM_POSTHOG_HOST`. These supply browser build arguments and Studio runtime settings. Rebuild the web image after changing them. Ingestion tracing still requires `EVENTROAM_CATALOG_TRACING=true`.

The project presentation records `promo_link_clicked` for LinkedIn contact links (`destination: "linkedin"`, `placement: "hero" | "footer"`) and the catalog link (`destination: "festivals"`, `placement: "example"`). These events record clicks, not activity on LinkedIn.

Use these public links to separate GitHub traffic:

- Profile: https://eventroam.org/?utm_source=github&utm_medium=profile&utm_campaign=eventroam
- Repository README: https://eventroam.org/?utm_source=github&utm_medium=readme&utm_campaign=eventroam&utm_content=eventroam

PostHog captures the UTM parameters on page views. Use session entry source when comparing GitHub visits with later contact clicks. Anonymous browser IDs do not reveal a visitor's GitHub account.

To stop analytics in your own browser after deployment, open both links once:

- https://eventroam.org/?analytics=off
- https://festivals.eventroam.org/?analytics=off

PostHog stores the opt-out choice in local storage for each origin. It blocks page views, custom events, and browser error capture on later visits. Repeat this in each browser or after clearing site storage. Use `?analytics=on` on each origin to restore capture. Existing events remain in PostHog; this choice affects new events only.
