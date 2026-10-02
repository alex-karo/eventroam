---
type: Playbook
title: Mapbox public deployment gate
description: Required token, host, and monitoring checks before public map deployment.
status: stable
tags: [deployment, mapbox]
---

# Mapbox public deployment gate

The map uses Mapbox GL JS 3.30.0 and `NEXT_PUBLIC_MAPBOX_STYLE` (default `mapbox://styles/mapbox/streets-v12`). `NEXT_PUBLIC_MAPBOX_TOKEN` is intentionally unset in the repository; without it the linked list remains available. Mapbox attribution stays visible in the map control.

Before publishing a host:

1. Create a dedicated public Mapbox token with only the read scopes required by the selected style and map resources. Configure allowed URLs for every launched hostname, including the festivals scope host. Keep local development on a separate token and allowed URL set.
2. Confirm the selected style and token work on each launched hostname, including map attribution and tiles. Do not commit the token or paste it into logs, issues, or reports. The browser token is public by design and must be restricted at the provider.
3. Configure Mapbox usage monitoring, budget alerts, and an owner to respond to unexpected map-load growth. Verify the alert path before launch. Review map-load volume after launch and set a suitable budget limit from measured traffic.

Deployment is deferred until this gate has been completed and recorded by the owner.
