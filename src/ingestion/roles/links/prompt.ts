import { boundary, returnInstructions } from "../prompts";

export const LINKS_PROMPT_VERSION = "public-links-v22";

export const linksInstructions = `## Scope

- Select only the assigned public URL slots. Assess links independently of ticket prices.
- When eventFields is false, return event with only socials: {}. Do not set or check Event website or social links. Do not ask to confirm them in checks or unresolved questions.
- In that scope, currentLinks covers only the ticket destination for currentOrNextEdition. Saved Event links do not expand the assignment.

## Official links

- Use source context to verify that the destination is official and applies to the correct Event or Edition.
- Copy the supplied destination URL. Keep its scheme, host and path. Do not add or remove www. A familiar spelling does not establish an alias.
- Preserve meaningful query parameters. Remove tracking only when there is a clear purpose. Never invent a destination.
- Use a set action for a verified URL unless it is already saved as official in the correct assigned slot.
- Set the website slot when its verified URL is saved as unofficial or under a different link kind, even if the URL text is the same.
- For each supported official social slot, propose its URL or explain the material ambiguity. Do not claim verification for a slot you omit without an explanation.
- Do not publish articles, maps, source pages, office contacts or unrelated same-brand pages as miscellaneous links.

## Ticket links

- Use the current official ticket overview when it lists admission options. Copy its inspected finalUrl even if all purchase links lead to product checkouts.
- When a language variant is archived for another year, prefer the official current-year destination that the page identifies. Use it even if the current checkout does not load.
- If there is no supported overview, one distinct supported product destination may be the Edition ticket link. Count each destination once, even if several anchors point to it.
- An official link can support a checkout URL even when you cannot read the checkout. An unread checkout cannot support ticket prices.
- Preserve historical ticket links. Do not return per-offer URLs.

## Checks and omissions

- Verify currentLinks without a ticket URL when sources state that admission is free without booking or that no ticket shop is published.
- Missing optional links do not make currentLinks unfinished.
- In omitted, list only materially ambiguous candidates for an assigned public slot. Give one short reason for each. Return [] if there are none.
- Do not list routine navigation, articles, archives, maps, contacts, duplicate anchors or clearly unrelated URLs in omitted.

## Example

This example shows only the decision. Complete the required schema.

- Input. Event link edits are allowed. The saved unofficial other link is https://www.cedarsound.example/. Inspected evidence gives https://cedarsound.example/en/ as the finalUrl of the official homepage.
- Decision. Set event.website to https://cedarsound.example/en/ and cite the supporting evidence. Use the old www spelling or remove /en/ only if evidence supports that URL.

## Shared evidence and finding rules

${boundary}

## Return revisions
${returnInstructions}`;
