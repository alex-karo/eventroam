# Proposal

## Why

The catalog uses one Event summary for both the festival page and its search and social previews. A reader needs enough detail to understand the festival. A preview needs one or two sentences that summarize its format.

## What Changes

- **BREAKING** Replace the single Event summary with separate detailed and short descriptions.
- Ingestion writes both texts from the latest known festival format and any announced changes.
- Ingestion requires evidence of at least one completed, ongoing or announced Edition. Without it, the run ends without catalog changes and records the reason.
- The website uses the available text for either purpose. If both fields are empty, it builds a neutral sentence from public catalog data.

## Requirements

- An Event has independently optional detailed and short descriptions. Each can be set, cleared, or accepted without the other; missing text does not block creation or eligible publication.
- Add and full refresh produce three to five detailed sentences and one or two short sentences in English, without the festival name. Leave unsupported text empty.
- Descriptions explain the latest supported festival format and announced changes. Exclude obsolete history, temporary Edition facts, promotional claims, and invented experiences.
- Ingestion needs a selected Edition or a saved scheduled or announced Edition. A specific announcement can qualify without complete dates; annual recurrence alone cannot. Without qualifying evidence, leave the catalog unchanged and report the reason.
- Add and full refresh keep the latest completed and ongoing or nearest announced Edition separate. Current refresh updates only its selected current or next Edition, leaving festival descriptions and unrelated history unchanged.
- A current refresh with a qualifying saved Edition but no selected target can finish unchanged. Unresolved research remains visibly incomplete; do not add historical research only to fill the empty selection.
- Public pages prefer detailed text, then short text, then a neutral sentence from public facts. Historical Edition pages use the current festival text.
- Search and social previews prefer short text and lead with the public name. Edition previews retain year, date qualifications, and status; structured data uses the displayed festival text. Missing text adds no publication or indexing gate.
- Developers can assess both descriptions independently in main eval and inspect Classification proposals separately. A text match probability of at least 80% passes; lower scores count as missing required facts.

## Acceptance criteria

- Existing summaries remain available as detailed text after migration. Setting or clearing one description leaves the other intact, and review can accept one while rejecting the other.
- Generated texts meet the requested lengths, reflect supported current features and announced changes, and omit temporary Edition details or unsupported claims. Missing descriptions still permit eligible records.
- Add/full can save the two selected Editions without mixing facts, preferring an ongoing Edition over a later announcement. Current refresh leaves Event data and unrelated Editions unchanged.
- No qualifying Edition produces an insufficient-information report and no catalog or publication changes. A specific undated announcement or qualifying saved Edition permits processing; annual recurrence alone does not.
- With a qualifying saved Edition, a current run with no selection finishes unchanged without extra historical work. Unresolved selection retains incomplete checks and questions; a completed absence check alone does not make research incomplete.
- Detailed, short, and automatic text appear correctly on Event and Edition pages without filling stored fields. Historical About text stays current while historical dates and status remain specific to that Edition.
- Search and social descriptions agree, avoid duplicate names, and retain Edition dates and status. Eligible structured data uses the rendered text; insufficient confirmed facts omit it without changing indexing.
- Separate Classification results show expected categories and both text assessments. Missing or low text assessments fail that check. Main eval reports each text separately and distinguishes missing text, missing references, and provider failures.

## Impact

Readers see separate page and preview text. Owners can review each description independently, and developers get separate text assessments. Storage, ingestion, public reads, and website metadata change; existing identity, publication, history navigation, place precision, and Edition category reuse rules remain applicable.
