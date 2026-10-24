---
type: Proposal
title: Festival taxonomy vocabulary proposal
description: Starter Edition vocabulary loaded by catalog migrations, with assignment guidance.
status: draft
tags: [taxonomy, festivals]
---

# Festival taxonomy vocabulary proposal

This document holds the selected starter terms and their assignment guidance. Ordinary catalog migrations load all 71 starter terms, including 56 genres. Implemented facet and classification behavior belongs to OpenSpec. Launch-data review may refine the vocabulary later.

Status: Starter vocabulary implemented in migrations; launch-data review pending, version 0.5

Date: 2026-10-22

Basis: The owner accepted the simpler Edition-only classification model on 2026-10-01, added `reenactment`, `wellness`, and `moto` as programme topics on 2026-10-03, and added `snow-sports`, `surfing`, `food-and-drink`, and `topic/outdoor` on 2026-10-11, and selected `openair` as the proposed physical-format slug to distinguish it from the activity topic. On 2026-10-22, the owner accepted 56 genres and the existing 15 terms in the other facets for loading through ordinary database migration. Launch-data refinement remains future work.

Implementation note (2026-10-22): Migration `0001_starter_taxonomy` adds missing starter terms by facet/slug, preserving existing IDs, labels, parents, and Edition assignments. Development fixtures reuse those terms. Loading the dictionary does not assign terms or publish Editions.

Historical implementation note (2026-10-11): Fresh development and eval vocabularies include `format/openair` and the four new activity topics. Current publication checks require one event type and at least one topic or culture term. Physical format is optional. Evidence assessment remains model-led, while writes enforce structural rules. The rest of the starter vocabulary remains subject to launch-data validation.

## 1 Context and outcome

This proposal defines starter vocabulary and future evidence rules for classifying each Edition. [Edition classification](../../openspec/specs/catalog/classification/spec.md) owns implemented facet and assignment behavior, while [publication and details](../../openspec/specs/catalog/publication/spec.md) owns current scope and public visibility. The [rival research](../research/2026-09-19-filters-and-classification.md) informed the vocabulary, but its Event-inheritance proposal is superseded. This proposal does not select public filters or expand the catalog to concerts, conferences, retreats, or club nights.

## 2 Facets and starter terms

Facet keys are fixed. New terms within those facets are curated data; a new facet or cardinality change requires a specification and application change. An empty facet means unknown or unspecified. There is no `unknown`, `other`, or `not-applicable` term and no separate applicability state in v1.

| Facet key | Question | Assignment limit |
| --- | --- | --- |
| `event_type` | What kind of event is this edition? | At most one |
| `format` | Where is the programme presented? | At most one |
| `topic` | What substantial programme or defined participant offering does it offer? | Multiple |
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
| `openair` | Open-air | The main public programme operates in an open-air site setting. A single physical feature or support facility does not decide format. |
| `mixed-indoor-outdoor` | Mixed indoor/outdoor | Substantial parts of the public programme use both open-air and enclosed indoor settings. This value takes priority when both settings are supported. |
| `indoor` | Indoor | The main public programme operates in enclosed indoor spaces. Outdoor support areas alone do not make it mixed. |

Naming note (2026-10-11): `format/openair` replaces the former `format/outdoor` in application publication checks and fresh fixture vocabularies. The starter migration adds `format/openair` but does not rename or reassign the former `format/outdoor` in existing catalogs.

Preserve raw source wording. “Hybrid” may mean online plus in-person; an open-air name or photograph alone does not establish the current edition's setting. Physical format is optional for publication. An unknown format remains unassigned. Use programme and site evidence. Branding, camping, or one physical feature alone is insufficient. Do not invent a percentage threshold.

### Programme topics

| Slug | Label | Assign when |
| --- | --- | --- |
| `music` | Music | Live or recorded musical performances form a substantial advertised programme. |
| `arts` | Arts | Installations, visual art, performance art, or other non-musical artistic participation form a substantial advertised programme. |
| `reenactment` | Historical reenactment | Re-creations of historical events or ways of life, such as living-history camps, period demonstrations, or staged historical encounters, form a substantial advertised programme. |
| `wellness` | Wellness | Guided well-being practices, such as yoga, meditation, breathwork, or restorative movement, form a substantial advertised programme for attendees. |
| `moto` | Motorcycling | Motorcycle rides, custom-bike shows, stunt or racing displays, or hands-on riding activities form a substantial advertised programme. |
| `snow-sports` | Snow sports | Skiing, snowboarding, or other snow sports form a substantial advertised programme or an official festival package includes a ski pass for riding during the edition. Organized lessons or competitions are not required for the included-pass case. |
| `surfing` | Surfing | Surf competitions, demonstrations, lessons, or organized surfing sessions form a substantial advertised programme or participant offering. |
| `food-and-drink` | Food & drink | Culinary demonstrations, chef-led sessions, cooking workshops, tastings, or a curated food-and-drink programme form a substantial advertised part of the festival's identity or programme. |
| `outdoor` | Outdoor activities | Guided hikes, climbing, kayaking, paddling, survival-skills sessions, or comparable outdoor recreation form a substantial advertised programme or organized participant offering. |

Music does not imply arts; decoration alone does not establish an arts programme. Historical costume, fantasy theming, or an isolated demonstration does not establish reenactment; do not infer arts from reenactment without a separately supported artistic programme. A single yoga session, spa service, relaxing setting, or wellness marketing does not establish a substantial wellness programme. Biker attendance, motorcycle parking, a sponsor display, or a single incidental ride does not establish moto.

A ski-resort location, nearby slopes, a ski-pass discount, or a link to buy a separate resort pass does not alone establish snow-sports. An official festival ticket or package that includes a ski pass valid for riding during the edition is sufficient. A beach location, surf imagery, or nearby surf schools does not alone establish surfing. Ordinary food stalls, bars, or one incidental tasting do not establish food-and-drink. Other workshops remain descriptive evidence unless they meet an existing topic's definition. Any supported topic or culture term can meet that part of the publication requirement.

`topic/outdoor` describes active outdoor recreation; `format/openair` describes where the core public programme takes place. They have distinct slugs and display labels. Camping, a natural setting, nearby trails, or an isolated walk does not establish the topic. Snow-sports, surfing, and moto do not automatically imply `topic/outdoor`; assign it only for a separately supported recreation programme. It is not their taxonomy parent. An outdoor-activities topic does not by itself establish an open-air programme format.

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
| `funk` | Funk | — | Explicit funk programme; a rhythmic or danceable description alone is insufficient. |
| `disco` | Disco | — | Explicit disco programme; a dance floor or retro theme alone is insufficient. |
| `ska` | Ska | — | Explicit ska programme; do not infer it from reggae or punk alone. |
| `dub` | Dub | — | Explicit dub programme; not a spelling variant of dubstep. |
| `dancehall` | Dancehall | — | Explicit dancehall programme; generic reggae does not establish it. |
| `afrobeat` | Afrobeat | — | Explicit Afrobeat in the funk, jazz, and West African band tradition; distinct from Afrobeats. |
| `afrobeats` | Afrobeats | — | Explicit Afrobeats as contemporary West African pop styles; distinct from Afrobeat and not inferred from artist nationality. |
| `downtempo` | Downtempo | `electronic` | Explicit downtempo music programme; a quiet area or relaxation activity alone is insufficient. |
| `breakbeat` | Breakbeat | `electronic` | Explicit breakbeat programme; generic bass music is insufficient. |
| `dubstep` | Dubstep | `electronic` | Explicit dubstep programme; generic bass music or dub does not establish it. |
| `uk-garage` | UK Garage | `electronic` | Explicit UK garage programme; unqualified garage needs musical context. |
| `jungle` | Jungle | `electronic` | Explicit jungle music programme; scenery or an event name is insufficient. Kept alongside drum & bass under electronic. |
| `hardstyle` | Hardstyle | `electronic` | Explicit hardstyle programme; hard techno or unqualified hard dance is insufficient. |
| `deep-house` | Deep House | `house` | Explicit deep house programme; unqualified deep is insufficient. |
| `tech-house` | Tech House | `house` | Explicit tech house programme; separate house and techno stages do not establish this style. |
| `progressive-house` | Progressive House | `house` | Explicit progressive house programme; unqualified progressive is insufficient. |
| `afro-house` | Afro House | `house` | Explicit Afro house programme; Afrobeat or Afrobeats does not establish it. |
| `organic-house` | Organic House | `house` | Explicit organic house programme; nature imagery or an outdoor setting is insufficient. |
| `minimal-techno` | Minimal Techno | `techno` | Explicit minimal techno programme; unqualified minimal needs musical context. |
| `hard-techno` | Hard Techno | `techno` | Explicit hard techno programme; hardstyle or unqualified hard dance is insufficient. |
| `melodic-techno` | Melodic Techno | `techno` | Explicit melodic techno programme; a melodic description alone is insufficient. |
| `goa-trance` | Goa Trance | `psytrance` | Explicit Goa trance programme; a location in Goa is insufficient. Grouped under psytrance for discovery. |
| `progressive-psytrance` | Progressive Psytrance | `psytrance` | Explicit progressive psytrance programme; unqualified progressive is insufficient. |
| `darkpsy` | Darkpsy | `psytrance` | Explicit darkpsy or dark psytrance programme; dark imagery alone is insufficient. |
| `forest-psytrance` | Forest Psytrance | `psytrance` | Explicit forest psytrance programme; a forest venue or theme is insufficient. |
| `hi-tech` | Hi-Tech | `psytrance` | Explicit hi-tech psytrance programme; technology references or a generic fast tempo are insufficient. |
| `alternative-rock` | Alternative Rock | `rock` | Explicit alternative rock programme; unqualified alternative needs musical context. |
| `indie-rock` | Indie Rock | `rock` | Explicit indie rock programme; independent organization or unqualified indie is insufficient. |
| `psychedelic-rock` | Psychedelic Rock | `rock` | Explicit psychedelic rock programme; psychedelic visuals or psytrance do not establish it. |
| `hard-rock` | Hard Rock | `rock` | Explicit hard rock programme; generic loud or heavy descriptions are insufficient. |
| `heavy-metal` | Heavy Metal | `metal` | Explicit heavy metal programme; broad metal may remain at the parent when the source does not distinguish the style. |
| `thrash-metal` | Thrash Metal | `metal` | Explicit thrash metal programme. |
| `death-metal` | Death Metal | `metal` | Explicit death metal programme. |
| `black-metal` | Black Metal | `metal` | Explicit black metal programme; visual styling alone is insufficient. |
| `doom-metal` | Doom Metal | `metal` | Explicit doom metal programme. |
| `hardcore-punk` | Hardcore Punk | `punk` | Explicit hardcore punk programme; unqualified hardcore requires context and may refer to electronic music. |

Store the most specific supported genre, not redundant ancestors; derive parent membership for filtering. Sibling/root genres may coexist. Psytrance is a direct child of electronic and does not automatically match a `trance` filter. For unrepresented styles, retain source wording, report the unmapped label, and assign a broader term only when defensible. Do not hide missing culturally specific styles in a generic bucket.

These 56 genres use editorial discovery parents. Goa Trance and the other psytrance children do not match a generic Trance filter. Jungle does not automatically match Drum & bass. Root Ska, Dub, and Dancehall do not automatically match Reggae. Ambiguous `progressive`, `indie`, `hardcore`, and `psychedelic` require musical context; never guess a specific child from these words alone.

Sources informing the selected additions: [Beatport genre catalog](https://greenroomsupport.beatport.com/hc/en-us/articles/41043520429076-Beatport-Genres-Including-NEW-Open-Format-Genres), [MusicBrainz genre list](https://musicbrainz.org/genres), and [Boom’s Gardens programme](https://www.boomfestival.org/programme/the-gardens/music), which explicitly advertises Downtempo. These sources inform term selection; they do not prescribe our parent hierarchy.

### Participatory culture

| Slug | Label | Assign when |
| --- | --- | --- |
| `burning-like` | Burning-like | The organizer explicitly describes a burn/Burning Man-inspired participation model, or source material documents an equivalent model centered on participant-created art/community with practices such as gifting, participant contribution, and communal self-reliance. |

Camping, electronic music, fire imagery, workshops, or “transformational” marketing alone are insufficient. The evidence should describe how the event works, not just its atmosphere. An ambiguous resemblance remains unclassified and is reported in the run summary.

The term applies to official and independent events when supported. It makes no claim of Burning Man recognition, endorsement, or legal affiliation. Absence from an official directory does not prove independence. Affiliation is outside this taxonomy and remains a separate, deferred model.

## 3 Assignment and normalization rules

1. **Use edition-relevant evidence.** Prefer the official edition page, programme, or organizer account. An enduring official description may support a current edition when it clearly applies; old assignments and aggregator tags alone do not establish that it still does.
2. **Classify substantial programming.** An explicit central identity or clearly substantial programme section can support a topic; musical styles also require substantial musical programming. A substantial participant offering in an official festival package can also support an activity topic where its definition permits it, including a ski pass for snow-sports. One incidental performer, demonstration, or workshop cannot. No lineup-percentage calculation, numeric confidence threshold, or mandatory artist database is required.
3. **Keep dimensions independent.** Psytrance does not imply burning-like culture. Reenactment does not imply arts or a music genre; wellness does not imply burning-like culture; moto does not imply rock, sports, or a participatory gathering. Camping does not imply outdoor programming. A gathering need not have music, and missing genre must not exclude a supported non-musical burn.
4. **Use the exact known term.** Map harmless spelling variants through a small versioned application mapping. Examples: `D&B` and `drum and bass` map to `drum-and-bass`; `psy-trance` maps to `psytrance`; `open air` maps to `format/openair` only when it describes the programme setting, never to `topic/outdoor`. Ambiguous `EDM`, `indie`, `hybrid`, `urban`, and an unqualified `outdoor` require facet and source context. No alias table is needed in v1.
5. **Preserve uncertainty.** If a source only establishes electronic music, do not guess techno. “Multi-genre” is evidence of breadth, not a list of known genres; assign the specific styles supported or leave the facet unset. Do not seed multi-genre as a substitute for unknown.
6. **Replace only intentionally.** A missing label in a new extraction is not an instruction to delete an accepted assignment. Additions, removals, and complete set replacements use the domain's evidence, conflict, and owner-correction rules. A failed source fetch never clears terms. In ingestion, accept/set supplies a complete list. Preparation removes selected ancestors at any depth and keeps selected descendants and siblings. It rejects unknown IDs, duplicates, and single-value facet conflicts before this normalization. Broad-only terms remain valid. Omitted classification stays unchanged. Direct catalog writes still reject redundant ancestors.
7. **Separate editions.** Research can explicitly reuse a comparable prior Edition's terms when inspected announcement evidence supports continuity. The finding must name the donor key and explain that basis. Refuted terms must be removed. Omission does not copy terms. Publication still uses the current catalog requirements. Updating one edition never changes another or supplies implicit Event defaults.

Canonical term IDs and slugs remain stable. New terms require a deliberate curated vocabulary change, not automatic creation from extraction output. New term definitions belong in this file. Preserve a used term's meaning, facet, and parent; semantic changes use new terms and explicit, audited Edition reassignments under the domain rules. Display-label corrections preserve meaning and are recorded in the versioned vocabulary definition. No term-audit entity is introduced.

## 4 Classification examples

Fictional Edition examples, not verified real-event records:

| Example and assumed evidence | Event type | Format | Topics | Genres | Culture |
| --- | --- | --- | --- | --- | --- |
| Forest Signal: official outdoor festival centered on psytrance | `festival` | `openair` | `music` | `psytrance` | Unset |
| Common Ground Burn: participant-created art and gifting, no music programme | `gathering` | `openair` | `arts` | Unset | `burning-like` |
| Valley Weekender: substantial indoor/outdoor stages, rock and jazz | `festival` | `mixed-indoor-outdoor` | `music` | `rock`, `jazz` | Unset |
| Hearthfield Festival: outdoor live music and a substantial living-history programme | `festival` | `openair` | `music`, `reenactment` | Unset | Unset |
| Quiet Fields Burn: participant-created art and gifting with daily guided meditation and yoga | `gathering` | `openair` | `arts`, `wellness` | Unset | `burning-like` |
| Roadlight Festival: outdoor live music, organized rides, and custom-bike shows | `festival` | `openair` | `music`, `moto` | Unset | Unset |
| Alpine Signal: substantial indoor/outdoor music programme and an official festival ticket including a ski pass for the festival dates | `festival` | `mixed-indoor-outdoor` | `music`, `snow-sports` | Unset | Unset |
| Coastal Pulse: outdoor music festival with a substantial surf competition and lessons programme | `festival` | `openair` | `music`, `surfing` | Unset | Unset |
| Table & Sound: outdoor music festival with a dedicated chef stage, cooking workshops, and tastings | `festival` | `openair` | `music`, `food-and-drink` | Unset | Unset |
| Trail Echo: substantial indoor/outdoor music programme plus daily guided hikes, climbing, and kayaking | `festival` | `mixed-indoor-outdoor` | `music`, `outdoor` | Unset | Unset |
| Resort Beats: outdoor music festival near ski slopes, a beach, and ordinary food stalls, without included activities or a culinary programme | `festival` | `openair` | `music` | Unset | Unset |

## 5 Public behavior and acceptance

The public UI displays human-readable labels and queries stable IDs/slugs. Parent genre filters include descendants. Unknown assignments do not match a positive term selection; leaving a facet unrestricted includes records with no assignment. Apply all selected classification conditions to the same Edition. Do not satisfy a genre from one edition and a format from another.

An Event page displays classifications from the specific published Edition it presents, selected using the domain's date/status rules. Historical classifications remain attached to their historical edition; drafts never supply public badges. Changing the displayed edition changes its classification summary without changing the Event's identity.

The filter interaction spec will choose useful public controls; this vocabulary does not require one for every term. Publication also requires an Edition year, complete dates, and country.

## 6 Writes and observability

Validated application operations accept term IDs or resolve known `(facet, slug)` pairs. They validate facet cardinality and parent rules before writing. Normal classification writes only attach existing terms; unmatched labels appear in process output rather than silently creating vocabulary.

Apply assignment changes and their Edition `CatalogChange` atomically under the existing expected-version and operation-key contract. Accepted changes retain source evidence and actor attribution; unchanged sets create no duplicate assignments or audit entries. Run summaries distinguish applied changes, unmapped labels, source conflicts, and failed retrievals. There is no review entity or per-change approval step.

## 7 Validation and rollout

- Verify unique `(facet, slug)` pairs, configured facets, same-facet parents, and no cycles. Test cardinality, parent matching, aliases, unknown labels, edition isolation, intentional removals, idempotent replacements, rollback, owner corrections, and draft/withdrawn exclusion.
- Use small attributable saved fixtures; normal tests must not fetch live sites. Before launch, classify roughly 30 varied official-source examples, including non-musical burns, independent gatherings, mixed programmes, substantial versus incidental reenactment, wellness, moto, snow-sports, surfing, food-and-drink, and outdoor activities, included ski passes versus discounts or nearby slopes, outdoor format without outdoor activities and vice versa, missing genres, and styles outside the starter list. Record disagreements and unmapped labels, then refine the vocabulary.
- The classification tables already exist. Migration [0001_starter_taxonomy](../../src/db/migrations/0001_starter_taxonomy.sql) adds missing starter terms through the existing migration command, matching by facet/slug and preserving existing IDs and assignments. Loading terms does not assign classifications or publish Editions; no ingestion run is part of this change.
