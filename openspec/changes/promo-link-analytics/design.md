# Design

## Change size

Small. Two existing links share one event contract and use the installed browser SDK.

## Approach

Keep the presentation on the server and move only the contact anchor into a client component. Each click sends destination and placement, then follows the existing link. Use UTM parameters on public GitHub links; PostHog already captures these on page views.

## Contracts

Use the installed SDK and the existing `promo_link_clicked` event:

```ts
type PromoLinkProperties =
  | { destination: "linkedin"; placement: "hero" | "footer" }
  | { destination: "festivals"; placement: "example" };
```

Keep the LinkedIn URLs and use the configured Festivals origin for the catalog link. Publish these campaign query strings in the analytics guide:

| GitHub placement | Query |
| --- | --- |
| Profile | `utm_source=github&utm_campaign=eventroam&utm_medium=profile` |
| README | `utm_source=github&utm_campaign=eventroam&utm_medium=readme&utm_content=eventroam` |

## Risks and validation

Check both placements in the browser and inspect event delivery. Run types, lint, dependency, documentation, and proposal checks. A direct self-review found no need for a shared analytics framework or new dependency.

Use the SDK opt-out storage per origin. An explicit URL choice changes browser capture without requiring an account, an IP address rule, or a report filter. Disable the entry page view when the URL opts out.
