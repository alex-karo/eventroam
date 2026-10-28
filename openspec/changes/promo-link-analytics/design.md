# Design

## Change size

Small. Two existing links share one event contract and use the installed browser SDK.

## Approach

Keep the presentation on the server and move only the contact anchor into a client component. Each click sends destination and placement, then follows the existing link. Use UTM parameters on public GitHub links; PostHog already captures these on page views.

## Risks and validation

Check both placements in the browser and inspect event delivery. Run types, lint, dependency, documentation, and spec checks. A direct self-review found no need for a shared analytics framework or new dependency.

Use the SDK opt-out storage per origin. An explicit URL choice changes browser capture without requiring an account, an IP address rule, or a report filter. Disable the entry page view when the URL opts out.
