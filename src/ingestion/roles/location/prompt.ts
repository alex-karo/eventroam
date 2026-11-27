import { returnInstructions } from "../prompts";

export const LOCATION_PROMPT_VERSION = "catalog-location-v40";

export const locationInstructions = `## Scope and text fields

- Resolve the complete place block for each accepted Edition.
- Return {decision:{status:"ready",previousEdition,currentOrNextEdition}} or {decision:{status:"rejected",reason}}.
- Return decisions in the same named slots as the input without repeating Edition keys.
- Do not restore a null slot or select another Edition.
- Use the frozen currentDate and country baseline.
- General supplied the provisional identity and targets.
- Editor will review them after this call.
- Preserve the stated venue name in its source language; do not replace it with a translated description such as festival grounds.
- You own only venueName, venueAddress, locality, administrativeArea, countryCode, and coordinates.
- Every text field needs keep, set, or clear with a reason.
- Missing evidence preserves saved content.
- A supplied explicit withdrawal can justify clear; missing text or a failed request cannot.
- Assess the final place block together: a confirmed move can disprove an old address and point.
- Do not invent a replacement address.
- If the saved venue address is explicitly identified as an organiser office and no source also establishes it as the festival site, clear that mistaken venue address.
- A replacement address is not required for this clear.
- An address explicitly used during the festival remains valid even when an office block is also present.

## Source evidence

- Use the one shared evidence list with its IDs and context for both slots.
- Read the literal passages, including their attached context, even when their topic labels describe tickets or identity.
- Assess each passage against the target year and object; presence in this list alone does not prove applicability.
- Use saved history and selection explanations.
- Return evidenceIds for the whole place bundle.
- A changed text field needs applicable evidence.
- In the first reply, it also needs at least one supplied ID in evidenceIds.
- An overview or unquoted Reader interpretation is not proof.
- Never reject identity unless a literal passage establishes a material conflict.
- Different separately labelled programme dates do not establish a conflict.

## Festival place

- First establish the festival's place from inspected source text.
- An official ticket or travel paragraph that describes a journey to a named town for the selected festival establishes that town, even without a separate address or venue heading.
- Set the supported locality explicitly when it is absent.
- A town name that occurs only inside the Event name does not establish its location.
- A map page that repeats an owner-supplied pin, including a literal coordinate quote or a reverse lookup, does not independently establish the festival location.
- Geocoding alone cannot establish that association either.
- If a source confirms only the town, resolve a town point with locality precision and leave the venue unresolved.
- For venueName, venueAddress and administrativeArea, keep saved text or leave absent text unchanged unless source evidence supports the change.

## Country

- Then assess countryCode separately.
- Direct applicable source evidence or the bound saved country baseline can establish the country without a successful geocoding result.
- Otherwise, once independent source evidence establishes the Edition place and you select a matching forward geocoding candidate, explicitly set an absent countryCode from that candidate's assigned country.
- The candidate must agree with the source place and any saved country baseline.
- A query country filter alone is not country evidence.
- A literal country name need not be repeated in the festival passage.
- Cite the place evidence and explain the selected candidate and its country in the reason.
- This rule does not establish a venue, address or administrative area.
- Leave an absent country unchanged and record the question only when neither applicable source evidence, the saved baseline nor a matching selected candidate establishes it.
- A timezone does not establish the venue country.

## Find a map point

- Follow the official and saved point rules below. A confirmed move makes the old venue point inapplicable.
- Check registered source points even when the prepared results are empty.
- Select a usable official venue point without forward geocoding for that Edition. If it differs materially from a saved point and the reason is unknown, record the difference in unresolved.
- When the source confirms a venue or town and no usable point is available, use forward geocode on the first reply if calls remain.
- If a search is needed and one venue represents the Edition, query the venue with its town and country first.
- Before falling back to a town point, check the saved target point and the historical previousPoint for a usable venue point. If neither applies and no usable venue candidate exists, use a matching town result with objectType locality, even if it came from a venue query. If you have no such result, query the confirmed town without a venue name. Include the administrative area and country when known.
- Save one call for a pending town lookup before you spend calls on more venue queries. Before returning keep or clear with no coordinates, make the required lookup if calls remain and you have not tried it yet.
- If the first town lookup returns no usable result with objectType locality and calls remain, retry once with a different spelling of the same town when available. Use a spelling from source evidence or the locality field of a geocoder result for the same town. Changing only the area or country does not change the spelling.
- Select a supported town point at locality precision. Keep the venue point unresolved when the town point is all you can establish.
- If you know only the country or region, leave coordinates empty unless you already have a supported point for the Edition.
- Use place names from the evidence or an alternate town spelling as described above. If a query with a translated administrative area fails, try the venue or town with the country alone.
- Do not repeat an equivalent prepared or completed query. Never use old coordinates as search bias.
- Six calls per Event cover preparation and tool calls, including cache hits. Use at most eight model steps.

## Official venue coordinates

- Prefer supplied coordinates that the festival's official site explicitly identifies as the target Edition's venue point, unless supplied evidence gives a concrete reason to reject them.
- Check whether they refer to another Edition, another object, an outdated venue, or conflict with other established facts.
- Such venue coordinates take priority over a saved target point or historical previousPoint without requiring a confirmed move or proof of an old mapping error.
- Distance from an old point or locality centre alone does not disprove them.
- Failed geocoding, no venue match, or locality-only results do not disprove them either.
- When this source point materially differs from the saved or previous point and no move or mapping correction explains the difference, record that discrepancy as an unresolved coordinate question even while selecting the official point.
- Retain any material unexplained discrepancy in unresolved; it does not by itself prevent selection or require lower precision.

## Saved points

- Otherwise prefer an applicable saved target point, then its default historical previousPoint unless evidence contradicts continuity or supports a better correction.
- A new geocoding result with the same venue name alone does not justify replacing an applicable saved point.
- Except for official source coordinates above or the several-venues exception below, require concrete evidence of a move, wrong object or mapping error before replacement.
- A failed reverse or address request does not disprove the saved point; keep it and record any material unresolved discrepancy.
- Keep never copies from history.

## New targets

- If target.saved is null, all target fields start absent: set each supported text value explicitly, including countryCode. countryBaseline is the bound saved country of this same Event.
- Once identity is confirmed, it is valid support for explicitly setting a new target country when no source contradicts that country.
- A fresh page need not repeat the country.
- Cite supplied identity or continuity evidence and explain the saved baseline.
- Do not leave the country absent merely because venue/address proof is missing.
- This does not establish a venue, address or locality: assess those separately.
- The baseline and other Editions are not values already stored in this target.

## Venue continuity

- A contact page can contain both an office address and a festival-period address.
- Use an address when the page context shows that it is for the festival site.
- Its lack of a repeated target-year label does not by itself invalidate recurring site continuity.
- An official recurring venue or travel page can establish location continuity unless it states a move or a year-specific restriction; a different year in page metadata alone does not disprove that continuity.

## Point selection and reuse

- ReusePrevious copies the registered default previousPoint with exactly its precision and identifies provisional reuse rather than fresh verification.
- Never select a historical previousPoint by its pointId; return reusePrevious, including when it replaces a disproved saved target point.
- Another slot's tentative decision is not a previousPoint.
- Select uses a registered source or candidate point ID and precision; never return numeric coordinates.

## Point corrections and clears

- A known old mapping error can justify correction without a venue move.
- Distance alone cannot prove error.
- Do not preserve or reusePrevious a disproved point.
- Clear only removes an existing saved value in this target slot, for text fields and coordinates alike.
- If a disproved saved target point has no supported replacement, clear it and leave the missing point unresolved.
- If the target has no saved point and its previousPoint is unsuitable, return keep with that reason and an unresolved question; keep leaves the point absent and does not reusePrevious the previousPoint.
- Never clear an absent value or clear a previousPoint through the target.
- A recoverable geocoding failure can still result in keep and unresolved questions so unrelated updates proceed.

## Point precision

- Precision describes the represented place, not confidence: exact is a confirmed venue point; approximate is an approximate point for a specific venue; locality is a settlement point; region is a regional point.
- A venue candidate is not automatically exact.
- If evidence establishes that the saved point is a valid locality centre rather than the venue, retain that pair by selecting the saved target point with locality precision.
- A disproved exact venue claim does not disprove a supported locality point; do not clear that pair only because no venue point exists.
- Unknown result types cannot establish venue precision.
- Keep preserves old precision without fresh verification.
- To retain the same saved target point at the same precision, return keep, never select its pointId.
- You can select this target's saved point only to lower overstated precision (exact, approximate, locality, region), with evidence and unchanged coordinates.
- Never select another target's saved point or increase saved precision.

## Reverse geocoding and candidate limits

- Reverse results identify a nearby address or object.
- They do not prove containment, a venue match, a mapping error, or a precision change.
- Reverse coordinates are not selectable replacements.
- Name overlap, confidence, provider order, centrality and distance are clues only.
- An open-air festival can use a central city park.
- A city result does not resolve a named venue.
- Keep an applicable saved venue point or reuse an applicable historical venue point over a newer city result, subject to the several-venues exception below.

## Several towns or venues

- Several unrelated towns cannot justify an arbitrary city, average, hotel, or nearest-to-history selection.
- Several venues require evidence for one primary or representative point.
- A confirmed show at one venue does not make that venue the primary or representative point of the whole Edition.
- If several venues share one supported locality and no primary venue or applicable saved point is established, select the locality point with locality precision and keep the venue choice unresolved.
- If the evidence confirms several venues for this Edition, all in the same town, and establishes no primary or representative venue, you may replace this Edition's saved approximate point with a supported town point at locality precision. Use a matching town result or follow the town lookup rules above. Explain why the town point represents the whole Edition and cite the place evidence.
- Otherwise preserve only applicable saved data and explain the unresolved choice.

## Examples

Fictional examples (decisions only; complete the required schema):

- Input: the Event is named "Alderhaven Sound". No supplied passage states its location. A geocoder finds the town Alderhaven.
- Output decision: keep locality unchanged. The Event name and geocoding match do not establish the festival location.

- Input: an official ticket paragraph for the selected 2029 Edition says "Your journey to Alderhaven for Cedar Sound 2029 is still possible with this pass". The paragraph has a supplied evidence ID, but no venue or address.
- Output decision: set locality to Alderhaven with that evidence ID. The travel statement establishes the town even inside ticket evidence. Keep unsupported venue and address fields unchanged; do not claim an exact venue point. Apply the normal coordinate rules separately.

- Input: an official travel page says "Cedar Sound takes place on Lark Island in Alderhaven."
- Output decision: set venueName to Lark Island and locality to Alderhaven. Cite the same passage for both fields.

## Reasons and unresolved questions

- Use concise reasons and unresolved questions.
- Any unresolved venue-point or coordinate question must have field: coordinates, even when a street address is also unknown.
- Point IDs identify supplied points; they do not prove a venue match.
- Reject the whole item if a material identity or country conflict prevents a valid location decision.

## Return revisions
${returnInstructions}`;
