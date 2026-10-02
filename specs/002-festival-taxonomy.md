---
type: Specification
title: Festival taxonomy
description: Starter Occurrence vocabulary and assignment policy pending launch-data validation.
status: draft
tags: [taxonomy, festivals]
---

# Festival taxonomy

Status: Expected starter vocabulary and assignment policy, version 0.1  
Date: 2026-10-01  
Basis: The owner accepted the simpler Occurrence-only classification model on 2026-10-01. The terms below make that model concrete; validate their usefulness against the launch dataset before implementation.

Implementation note (2026-10-02): The evidence requirements below are deferred until the catalog database update workflow is built. Current classification writes and publication use the structural rules without source evidence.

## 1 Context and outcome

This file defines the starter vocabulary and evidence rules for classifying each Occurrence. The [domain model](001-domain-model.md#53-occurrence-classification) owns records and invariants; the [foundation](000-product-foundation.md) owns scope and publication. The [rival research](../docs/research/2026-09-19-filters-and-classification.md) informed the vocabulary, but its Event-inheritance proposal is superseded. This taxonomy does not select public filters or expand the catalog to concerts, conferences, retreats, or club nights.

## 2 Facets and starter terms

Facet keys are fixed. New terms within those facets are curated data; a new facet or cardinality change requires a specification and application change. An empty facet means unknown or unspecified. There is no `unknown`, `other`, or `not-applicable` term and no separate applicability state in v1.

| Facet key | Question | Assignment limit |
| --- | --- | --- |
| `event_type` | What kind of event is this edition? | At most one |
| `format` | Where is the programme presented? | At most one |
| `topic` | What substantial programme does it offer? | Multiple |
| `genre` | Which musical styles substantially characterize it? | Multiple |
| `culture` | Which defined participation model characterizes it? | Multiple; initially one available term |

### Event type

| Slug | Label | Assign when |
| --- | --- | --- |
| `festival` | Festival | The organizer describes and programmes the edition as a festival. Do not infer this solely from duration, crowd size, or camping. |
| `gathering` | Participatory gathering | The central programme is a temporary gathering created through participants' contributions, rather than primarily a presented festival programme. |

Choose the type that best matches the organizer's description and programme. A festival may also have burning-like culture; it does not need a second event type. When both descriptions are plausible, prefer `festival` if that is the organizer's explicit designation. A non-musical burn can be a participatory gathering. Ambiguous type remains unset until the evidence resolves it.

### Physical format

| Slug | Label | Assign when |
| --- | --- | --- |
| `outdoor` | Outdoor | The core public programme is outdoors. Tents, covered stages, or indoor support facilities do not alone make it mixed. |
| `mixed-indoor-outdoor` | Mixed indoor/outdoor | Substantial parts of the public programme occur in both indoor and outdoor spaces. |
| `indoor` | Indoor | The core public programme is indoors; any outdoor activity is incidental. Useful for internal candidates and recording a change of format. |

Preserve raw source wording. “Hybrid” may mean online plus in-person; an open-air name or photograph alone does not establish the current edition's setting. `indoor` and unknown format do not make an indoor music festival eligible for publication. Use programme/site evidence, not an invented percentage threshold, to judge substantial outdoor activity.

### Programme topics

| Slug | Label | Assign when |
| --- | --- | --- |
| `music` | Music | Live or recorded musical performances form a substantial advertised programme. |
| `arts` | Arts | Installations, visual art, performance art, or other non-musical artistic participation form a substantial advertised programme. |

Music does not imply arts; decoration alone does not establish an arts programme. Workshops, yoga, food, and wellness remain descriptive evidence, not starter terms or grounds for including an out-of-scope event.

### Music genres

These are editorial discovery groups, not a universal hierarchy of music. Use explicit organizer/programme language and the rules in section 3. Do not infer style from an event's country, appearance, audience, or a single artist.

| Slug | Label | Parent slug | Inclusion boundary |
| --- | --- | --- | --- |
| `electronic` | Electronic | — | Broad electronic programme when a narrower supported term is unavailable. |
| `house` | House | `electronic` | Programme explicitly described as house or a supported house style. |
| `techno` | Techno | `electronic` | Programme explicitly described as techno; not a synonym for all electronic music. |
| `trance` | Trance | `electronic` | Explicit trance programme without sufficient evidence for a narrower supported style. |
| `psytrance` | Psytrance | `electronic` | Explicit psychedelic trance programme. It is a direct child for shallow discovery; generic trance does not establish psytrance. |
| `drum-and-bass` | Drum & bass | `electronic` | Explicit drum & bass programme; generic bass music is insufficient. |
| `rock` | Rock | — | Explicit rock programme; “independent” production alone does not establish indie rock. |
| `metal` | Metal | — | Explicit metal programme; a distinct discovery root so users can select it directly. |
| `punk` | Punk | — | Explicit punk programme; audience aesthetics alone are insufficient. |
| `pop` | Pop | — | Explicit pop programme; popularity alone is insufficient. |
| `hip-hop-rap` | Hip-hop / rap | — | Explicit hip-hop or rap programme; avoid ambiguous “urban” mappings. |
| `folk` | Folk | — | Explicit folk programme; do not collapse all traditional music into folk by geography. |
| `jazz` | Jazz | — | Explicit jazz programme. |
| `blues` | Blues | — | Explicit blues programme. |
| `soul-rnb` | Soul / R&B | — | Deliberately broad discovery group for explicit soul or R&B programming, not a claim that the styles are synonyms. |
| `reggae` | Reggae | — | Explicit reggae programme; do not confuse dub with dubstep. |
| `country` | Country | — | Explicit country music programme, independent of the location field. |
| `classical` | Classical | — | Explicit classical music programme. |
| `ambient` | Ambient | — | Explicit ambient programme. Kept at the root because it can be acoustic or electronic; electronic may also be assigned when separately supported. |
| `experimental` | Experimental | — | Explicit experimental music programme, not a fallback for unfamiliar styles. |

Store the most specific supported genre, not redundant ancestors; derive parent membership for filtering. Sibling/root genres may coexist. Psytrance is a direct child of electronic and does not automatically match a `trance` filter. For unrepresented styles, retain source wording, report the unmapped label, and assign a broader term only when defensible. Do not hide missing culturally specific styles in a generic bucket.

### Participatory culture

| Slug | Label | Assign when |
| --- | --- | --- |
| `burning-like` | Burning-like | The organizer explicitly describes a burn/Burning Man-inspired participation model, or source material documents an equivalent model centered on participant-created art/community with practices such as gifting, participant contribution, and communal self-reliance. |

Camping, electronic music, fire imagery, workshops, or “transformational” marketing alone are insufficient. The evidence should describe how the event works, not just its atmosphere. An ambiguous resemblance remains unclassified and is reported in the run summary.

The term applies to official and independent events when supported. It makes no claim of Burning Man recognition, endorsement, or legal affiliation. Absence from an official directory does not prove independence. Affiliation is outside this taxonomy and remains a separate, deferred model.

## 3 Assignment and normalization rules

1. **Use edition-relevant evidence.** Prefer the official edition page, programme, or organizer account. An enduring official description may support a current edition when it clearly applies; old assignments and aggregator tags alone do not establish that it still does.
2. **Classify substantial programming.** An explicit central musical identity or clearly substantial programme section can support a genre. One incidental performer or workshop cannot. No lineup-percentage calculation, numeric confidence threshold, or mandatory artist database is required.
3. **Keep dimensions independent.** Psytrance does not imply burning-like culture. Camping does not imply outdoor programming. A gathering need not have music, and missing genre must not exclude a supported non-musical burn.
4. **Use the exact known term.** Map harmless spelling variants through a small versioned application mapping. Examples: `D&B` and `drum and bass` map to `drum-and-bass`; `psy-trance` maps to `psytrance`; `open air` maps to `outdoor` only when it describes the programme. Ambiguous `EDM`, `indie`, `hybrid`, and `urban` require context. No alias table is needed in v1.
5. **Preserve uncertainty.** If a source only establishes electronic music, do not guess techno. “Multi-genre” is evidence of breadth, not a list of known genres; assign the specific styles supported or leave the facet unset. Do not seed multi-genre as a substitute for unknown.
6. **Replace only intentionally.** A missing label in a new extraction is not an instruction to delete an accepted assignment. Additions, removals, and complete set replacements use the domain's evidence, conflict, and owner-correction rules. A failed source fetch never clears terms.
7. **Separate editions.** Copying a prior edition's assignments is allowed only as initial values for a new draft. Publication requires applicable supporting evidence, including when no copied value changes. Updating one edition never changes another or supplies implicit Event defaults.

Canonical term IDs and slugs remain stable. New terms require a deliberate taxonomy-edit operation, not automatic creation from extraction output. New term definitions belong in this file. Preserve a used term's meaning, facet, and parent; semantic changes use new terms and explicit, audited Occurrence reassignments under the domain rules. Display-label corrections preserve meaning and are recorded in the versioned vocabulary definition. No term-audit entity is introduced.

## 4 Classification examples

Fictional Occurrence examples, not verified real-event records:

| Example and assumed evidence | Event type | Format | Topics | Genres | Culture |
| --- | --- | --- | --- | --- | --- |
| Forest Signal: official outdoor festival centered on psytrance | `festival` | `outdoor` | `music` | `psytrance` | Unset |
| Common Ground Burn: participant-created art and gifting, no music programme | `gathering` | `outdoor` | `arts` | Unset | `burning-like` |
| Valley Weekender: substantial indoor/outdoor stages, rock and jazz | `festival` | `mixed-indoor-outdoor` | `music` | `rock`, `jazz` | Unset |

## 5 Public behavior and acceptance

The public UI displays human-readable labels and queries stable IDs/slugs. Parent genre filters include descendants. Unknown assignments do not match a positive term selection; leaving a facet unrestricted includes records with no assignment. Apply all selected classification conditions to the same Occurrence. Do not satisfy a genre from one edition and a format from another.

An Event page displays classifications from the specific published Occurrence it presents, selected using the domain's date/status rules. Historical classifications remain attached to their historical edition; drafts never supply public badges. Changing the displayed edition changes its classification summary without changing the Event's identity.

The filter interaction spec will choose useful public controls; this vocabulary does not require one for every term. Classification does not replace publication gates for scope, evidence, dates, and location.

## 6 Writes and observability

Validated application operations accept term IDs or resolve known `(facet, slug)` pairs. They validate facet cardinality and parent rules before writing. Normal classification writes only attach existing terms; unmatched labels appear in process output rather than silently creating vocabulary.

Apply assignment changes and their Occurrence `CatalogChange` atomically under the existing expected-version and operation-key contract. Accepted changes retain source evidence and actor attribution; unchanged sets create no duplicate assignments or audit entries. Run summaries distinguish applied changes, unmapped labels, source conflicts, and failed retrievals. There is no review entity or per-change approval step.

## 7 Validation and rollout

- Verify unique `(facet, slug)` pairs, configured facets, same-facet parents, and no cycles. Test cardinality, parent matching, aliases, unknown labels, edition isolation, intentional removals, idempotent replacements, rollback, owner corrections, and draft/withdrawn exclusion.
- Use small attributable saved fixtures; normal tests must not fetch live sites. Before launch, classify roughly 30 varied official-source examples, including non-musical burns, independent gatherings, mixed programmes, missing genres, and styles outside the starter list. Record disagreements and unmapped labels, then refine the vocabulary.
- Create the two classification tables in reviewed migrations. Load starter terms through a separate idempotent data operation keyed by facet/slug. Imported candidates require refreshed evidence before publication.
