# Design

## Change size

Large. The change replaces the model contracts across collection, interpretation, review, reports, and evaluations. It adds private source artifacts and changes Location ordering. Catalog field types, write operations, and publication gates remain in use. The remaining uncertainty is extraction recall. The owner accepts the current inference cost; further cost optimization and controlled cost comparisons are not completion requirements.

## Approach

Keep three product stages: collect evidence, propose changes, and review changes. Research selects pages. Reader receives one full parsed page per call, within a configured input limit, and saves quotations. Specialists use one fixed evidence corpus. Editor approves or rejects their proposals and reads source text only for validation.

The owner still starts `add`, `refresh/full`, or `refresh/current`. Code converts that input into concrete assignments. Tickets cover only `currentOrNextEdition`, including an ongoing Edition. Historical ticket prices, availability, offer URLs, and the Edition ticket link remain unchanged. See the [proposal](proposal.md) for scope and the [delta specs](specs/) for behavior.

This is a fixed workflow, not an agent network. It has eight model roles. Reader returns one structured result per page. General, Tickets, Classification, and Links each return one structured result when assigned. Only Research, Location geocoding, and Editor source checks need bounded iteration. No specialist starts another research round.

### Specification boundary

The specifications describe the complete ingestion result by domain. They define which facts can change, required support, preserved data, publication, errors, and owner inspection. Agent names, prompts, tool schemas, call order, and internal proposal types are design decisions in this document. A later internal refactor can change them while satisfying the same specifications.

Delta specs change only the requirements affected by this flow. They retain existing requirement names where possible. Unchanged requirements and already synced follow-up rules remain in the main specs. Historical ticket exclusion, removal of per-offer URLs, saved source artifacts, and removal of optional source-tool capture are explicit scope and inspection changes. Existing temporal selection, classification limits, location integrity, and atomic writes remain the baseline.

## Architecture

```mermaid
flowchart TD
    Input[Owner request and saved catalog] --> Assignment[Code builds concrete assignments]
    Assignment --> Research[Research: choose source]
    Research -->|inspectPage| Reader[Reader: page overview and exact quotations]
    Reader -->|compact page result and leads| Research
    Reader --> Corpus[(Private Markdown and evidence)]
    Research -->|finish collection| Freeze[Freeze corpus and return source list]
    Corpus --> Freeze
    Freeze --> General[General: identity, Edition selection, common facts]
    General -->|confirmed duplicate add| Skip[Skip duplicate without writes]
    General --> Tickets[Tickets: currentOrNextEdition only]
    General --> Classification[Classification]
    General --> Location[Location]
    General --> Links[Links: public URL selection]
    General --> Assemble[Code assembles typed proposal groups]
    Tickets --> Assemble
    Links --> Assemble
    Classification --> Assemble
    Location --> Assemble
    Assemble --> Editor[Editor: approve or reject]
    Editor -. saved source checks .-> Corpus
    Editor --> Validate[Code validates approved plan]
    Validate --> Write[Preview or atomic write]
```

Code selects evidence by the assigned topics and includes its inline context. Tags are nonexclusive; packets from the same frozen corpus may overlap. If a required packet exceeds its input bound, the stage reports a limit failure instead of silently dropping evidence. Location receives one shared evidence packet for both targets; each target retains its own saved values and previous point. Code supplies relevant saved fields to each specialist; the arrows from General carry the fixed target context, not a new summary of the evidence. A confirmed duplicate add exits after General without specialists, Editor, or writes. Otherwise, Tickets, Classification, Location, and Links run in parallel after General. No branch consumes another branch's result. Code joins the results before Editor. Links can propose assigned public links even when Tickets is skipped or proposes no price block.

Every add uses the normal collection checks and stop rules before General compares Event identity with supplied catalog candidates. This keeps one collection path and removes the suspected-duplicate handoff. Actual duplicates can require additional source reads and Reader calls. Existing limits and partial-result rules still apply.

Use the installed Mastra workflow steps and parallel branches. Existing source access owns safe URLs, HTTP/Firecrawl retrieval, Markdown extraction, maps, caching, and cancellation. Existing catalog operations own versions, country checks, publication, and atomic writes. Application code adds assignment building, the corpus, exact reference binding, typed proposals, and review assembly. It does not add a scheduler, vector store, shell tool, or generic dependency engine.

Replace the old broad `ResearchCandidate` handoff and Editor `set`/`clear` output. Remove their duplicate domain instructions. Reuse field schemas, location point validation, taxonomy validation, money conversion, and catalog operations instead of keeping a compatibility path.

### Application module ownership

Two application modules own the handoff from specialist proposals to catalog operations. These are ordinary functions, with no new service layer. Paths below are under `src/ingestion/`.

| Owner                                   | Input                                                                                                    | Output and responsibility                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposals.ts`: `assembleProposals`     | General and specialist domain results, assignment, frozen evidence, saved context, and registered points | `PreparedProposals`: fixed targets and proposal groups with their resolved support, owners, and versions. Validate ownership and references before Editor.                                                                  |
| `proposals.ts`: `applyReview`           | `PreparedProposals` and Editor decisions                                                                 | `AcceptedProposals`: accepted targets and changes with their bound support and diagnostics. Validate decision keys and apply target and temporal prerequisites. Preserve rejected optional groups under the existing rules. |
| `catalog-plan.ts`: `prepareCatalogPlan` | `AcceptedProposals`, assignment, saved catalog, and vocabulary                                           | `ReadyCatalogPlan`: catalog operations, explanations, and diagnostics. Reuse current money conversion, publication preparation, and operation validation.                                                                   |

These application contracts do not inherit model execution records or the old `CheckedResearch` and `AcceptedEditorPlan` types. Keep actual model responses and technical execution data in the existing execution records. Reuse `StageResult` for continue, skip, and reject outcomes; a rejected item produces no ready operations.

Move the applicable operation-building code from `editor/prepare.ts` to `catalog-plan.ts`. The `editor/` module owns its prompt, decision schema, and model invocation. It does not own the combined proposal or catalog plan. Location keeps point validation in its existing module. `workflow.ts` coordinates these functions; the report projects their results and execution records. Neither application module calls a model, reads source files, or writes the database. The catalog writer keeps transaction ownership and version checks.

## Contracts

### Concrete assignments

Mode and scope remain host inputs and report fields. Research receives `instructions`, `checks`, `sourcePolicy`, `identityContext`, `knownLinks`, `currentDate`, and remaining limits. It does not receive `mode: add`, `scope: full`, or `scope: current`, and its prompt has no branches on those labels.

| Host request | Concrete collection and interpretation work                                                                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add          | Collect identity evidence, Event description/shared links, and evidence for the latest completed and current-or-next Editions under the normal stop and limit rules. Collect ticket evidence only for the latter. General compares the collected identity evidence with supplied catalog candidates after collection. |
| Full         | Verify the targeted Event, description and shared links; inspect both Edition roles except historical ticket work. Allow source recovery under current discovery rules.                                                                                                                                               |
| Current      | Inspect the current-or-next announcement, dates, status, place, tickets, and classification. Do not audit Event fields or history. Do not recover the website. Report an identity contradiction and request a full refresh.                                                                                           |

The host also supplies matching instructions to General and field-specific assignments to specialists. Current scope permits targeted discovery for unresolved programme dates, another publication-required Edition fact or a concrete festival place, as defined by source access. It forbids replacement-site recovery after an identity contradiction. In scopes that permit recovery, an inspected official programme can complete identity recovery even when the original homepage stays blocked. That blocked homepage alone does not authorize later social-account searches or an absent-link collection blocker. Research receives distinct saved country and locality clues for the targeted Event; a wrong saved URL must not replace that identity baseline. Code enforces the original scope regardless of model instructions. History needed for identity, country, classification reuse, and earlier saved points is retained. Context overflow fails explicitly rather than dropping saved targets.

Research seeks a concrete place for an inspected ongoing or announced next festival, even when its country is known. It reads useful travel, getting-here, location or contact leads before targeted search. A venue with city or area, a source-supported address or a map point meets the goal; a field or forest needs no street address. An office, hotel or parking area is not the festival site without source support. Location coverage distinguishes a collected festival venue/address from country, town or office alone. Research treats collected venue/address coverage as a completed source need without requiring the literal place or Edition year in that short label; Location checks applicability from the quotations. Place discovery stops at that goal, explicit organizer nonpublication, no useful permitted next step or the shared budget. Venue remains optional for publication. Other optional gaps and an unannounced festival still do not authorize discovery. Reader, search, tool concurrency and time limits are unchanged.


Example Research instruction: "Inspect the saved official site. Find the ongoing festival, or the nearest announced future festival if none is ongoing. Collect its programme dates, status, place, ticket offers, official ticket overview, and programme content. Do not investigate historical tickets or Event social accounts. Do not find a replacement website. Report relevant blocked checks."

### Source artifacts and evidence

Each run has a private artifact directory under the configured ingestion data root. It contains `sources/<sourceId>.md` and separate evidence files for each source. The root is resolved independently of process working directory and kept on persistent private storage for hosted runs. Files remain until explicit owner cleanup.

The collection step returns `sources[]` in its saved workflow result; no separate manifest file is written. Each entry retains source identity, retrieval outcome, coverage, and Markdown/evidence paths when available. Failed reads remain visible without invented artifact paths. Partial, failed, and cancelled collection results retain the available entries. Failure finalization must preserve this list in saved workflow results even when collection does not return normally. Downstream processing and inspection use these references. Deleting workflow history removes its source list but does not delete corpus files, catalog records, or reports; each Markdown file retains its own provenance.

Save the full parsed Markdown within existing retrieval bounds before model projection. Frontmatter separates application provenance from website metadata. Application fields include source ID, requested/final URL, retrieval time, method, status, limits, and a body hash. Website title, description, and date retain their source meaning. The body and website metadata view are immutable once stored; evidence offsets address this canonical text, not a later reformatting.

```text
CollectionResult: sources[], collection checks, host stop diagnostics, limits, questions
Source: id, URLs, retrieval metadata, Markdown/evidence paths,
        content hash, extraction coverage
Evidence: id, sourceId, exact quote, span, topics[], context[]
Inline context entry: exact quote, span in the same source
PageOverview: sourceId, content description, topics, stated years, coverage limits
LinkCandidate: sourceId, URL, label, evidenceIds[]
Lead: URL, label, purpose hint
```

Reader can return a quote as a literal string or as `{ start, end }` literal boundaries. Each boundary must have one unique exact match in the original canonical page and normally contain at most 250 characters. Separate boundaries appear in order without overlap. A complete opening string with the closing string as its exact suffix, including identical strings, is accepted as a normal full literal quotation; partial overlap remains invalid. Code restores the complete passage, including both boundaries, within the 24,000-character quote limit. Saved evidence and downstream inputs always contain the full restored quote; the boundary form is only a Reader output optimization. For multi-line or escaped Markdown, Reader can use short boundaries instead of reproducing internal formatting. The opening boundary is only the opening heading or sentence, not a full passage with a closing boundary nested inside it. Invalid boundaries exclude that item under the same rules as an invalid literal quote. Code can restore one extra newline escape or doubled Markdown-punctuation backslash only when the original supplied string has no match and the complete restored string has one exact source match. Already ambiguous literal text is not repaired. The saved quotation is always exact source text. No fuzzy matching, semantic correction, or second extraction pass is added.

A self-contained Reader item returns only `quote` and `topics`. An item that needs extra context, Edition clues or uncertainty returns all three metadata fields as well. The two strict object variants avoid mandatory empty placeholders on every item; provider schemas cannot express ordinary optional properties without nullable placeholders. Code restores empty arrays and null uncertainty for short items before binding and storage. Required nonempty context still needs its exact unique match; a failed context match still excludes the whole item.

Reader keeps adjacent sentences that correct, reject or limit an extracted claim in the literal evidence with the same relevant topic. A shorter quote must not remove that qualification. Coverage can also describe the correction, but cannot replace its quotation. For unresolved questions, model schema descriptions require `field: null` when no single field applies; code retains the existing normalization of optional fields.

Reader attaches a local year heading to an undated attendance, completion or status passage when the heading establishes its scope. A year in a summary or separate evidence item does not replace that context. For official links, Reader retains each destination once and prefers a unique descriptive anchor or an existing factual passage. It does not add repeated menu links when the same destination is already supported. Exact unique binding remains required; code does not infer year context or repair ambiguous quotes. Link evidence keeps the original source label, including image labels, rather than rebuilding a destination as its label. Reader includes explicit source country details in location coverage and retains an explicit all-information-on-this-page statement. Empty coverage arrays are [], never a list with an empty string. Page silence does not establish nonpublication.

The Reader response nests context quotes under each quotation and supplies no offsets or evidence IDs. Reader copies enough adjacent source text to make each quote and context quote unambiguous. A bare price or repeated label is insufficient when a longer literal passage can identify it. Reader does not paraphrase or join separate passages into one quote; separate headings, years, and qualifications belong in `context[]`. Code finds exact text in the canonical page input and assigns the evidence ID. Only a unique match becomes an anchored span. A missing or ambiguous quote or context match excludes that evidence item from usable support and retains a diagnostic; code does not infer missing text or assign the first match. Other valid evidence items remain usable. Relevant failed extraction checks remain unfinished. Use half-open UTF-16 offsets against the immutable JavaScript string; displayed line numbers are derived by code.

Evidence topics are nonexclusive hints. The same ID can support description, location, and ticket work. Prefer one coherent passage, such as a paragraph or small table, over separate quotations for each fact or price. Several facts can cite that passage without separate evidence IDs. Keep unrelated sections separate and avoid copying a large section merely to group facts. Each item contains its own headings, table headers, and qualifications in `context[]`, without separate context IDs or nested references. This removes context-reference resolution, but the same heading may be stored with several items. Evidence packets retain uncertain material relevant to the assignment and source metadata/body conflicts. Exact matching proves that text exists, not that its interpretation is correct.

Context quotes can come from distant parts of the same full-page input. Code binds each literal passage separately; distance does not require joining passages or creating another reference type. Reader must identify uncertain applicability when a year, table header, or qualification cannot be associated with the fact. A nearby heading or the page overview must not replace that missing basis. Uncertain material can remain in the corpus, but does not authorize a change without supported interpretation.

Each retained link candidate contains its URL, label, and source context. Two occurrences with the same URL can retain different contexts. Research follows URLs and Links selects public URLs directly. No cross-role link ID or offer-link decision map is needed.

Persist page extraction outcomes separately from retrieval outcomes. Reader receives the full canonical page and source metadata in one call, without chunks or a running overview. Code checks a configurable page-input limit before the call and reserves space for instructions and output within the selected model's context allowance. If the page does not fit, keep its full saved Markdown, record the processing limit, and mark the whole page as unprocessed without a Reader call or a truncated-prefix fallback. Its relevant checks remain unfinished. Other usable sources can still support a partial result under the existing failure policy. A successful fetch or completed Reader call does not prove complete factual checking. The returned short page overview is navigation context, never a sufficient basis for a catalog change.

Repeated inspection of a cached requested/final URL returns the saved result without another extraction pass. Targeted Editor checks may inspect any saved page from the current run. There is no repeated full-page scan, except the existing bounded recovery for explicit model-provider unavailability. All downstream roles use one frozen corpus. No corpus revision loop is introduced.

### Execution results and check outcomes

Code owns technical execution status, safe errors, and reasons for skipped calls. It records model and tool failures, invalid or missing required output, storage failures, cancellation, and reached limits from actual execution. Reuse the existing execution records and failure policy; do not add another status layer or a workflow state machine. Keep the actual model response when available, even if its structured output is invalid.

Models return only their typed domain result: proposals, identity and target decisions, review or place rejections, assigned check findings, and unresolved questions. They do not return a general execution `status`, technical `errors[]`, or workflow skip reasons. A domain discriminator such as `scheduleStatus` or a Location rejection remains part of the result. A valid domain rejection is a completed model call, but can still block writes or fail the item under the existing domain rules.

Check findings remain required where assigned. Research accounts for source acquisition checks with nullable blockers. General and specialists own semantic sufficiency. A collection check without a blocker does not certify interpretation; a specialist finding cannot remove a real acquisition blocker. Missing collection checks remain incomplete. General and specialists retain the source basis for verified unchanged values and identify unfinished mandatory work. Code combines these findings with the assignments, observed source outcomes, and processing coverage. A missing proposal or check finding does not certify verification. Successful model execution alone does not mean that research is complete. Missing optional facts alone do not make research partial.

Code decides which calls are required from the assignment and selected targets. When a role is skipped, code records its reason and makes no model call. A recoverable tool failure remains an observation and does not by itself invalidate a usable role result. A required failure without a valid result follows the existing whole-item failure policy. Source retrieval statuses and owner-facing domain outcomes remain separate from technical model execution.

### Proposals and final decisions

```text
TargetContext: identity decision, observedEventName and its basis,
               previousEdition, currentOrNextEdition,
               fixed date, saved versions, selection reasons and evidence
Change<T>: set value or permitted clear, reason, evidenceIds[]
Classification reuse: optional reuseFrom { editionKey, reason }
Role output: fixed domain fields and decisions, assigned check findings, unresolved[]
Execution record (code): technical outcome, validated output when available,
                         actual response, safe diagnostics, skip reason when applicable
Review: item decision, fixed target decisions,
        fixed field/group decisions, unresolved[]
```

Each role has a strict typed result. General owns `event.summary` and the common fields under `previousEdition` and `currentOrNextEdition`. Tickets owns only `currentOrNextEdition.tickets`. Classification and Location own their named groups under the two Edition slots. Links owns the permitted Event link fields and `currentOrNextEdition.links.tickets`. Roles cannot add other fields or select another target.

These are boundaries, not complete replacement schemas. Field values reuse the existing catalog types. The host binds each fixed slot to General's selected key and validates field ownership and support references. There is no generic `proposals[]` list, proposal ID, repeated target address, or `targetContextId`. A missing proposal preserves data without claiming verification. `clear` is allowed only for a clearable field and requires affirmative evidence. Unknown data belongs in unresolved questions. A null Edition slot means no selected target; `tickets.basePrice: null` remains a valid value inside a complete price block.

Code binds saved fields by their fixed slot and field name. It identifies retained classification terms by comparing the complete list with that target's saved assignments. Retained values and terms need no fresh quotation or extra model reference. Point actions identify their basis directly: `keep` uses the target point, `reusePrevious` uses the supplied `previousPoint`, and `select` uses its `pointId`. Code supplies the resolved values, owners, provenance, and applicable versions to Editor and the existing write validators.

When a classification proposal reuses terms from an earlier saved Edition, it includes `reuseFrom: { editionKey, reason }`. Otherwise that field is absent. Code resolves the key to an eligible supplied saved Edition of the same Event. An unknown or ineligible key is invalid. The reason and announcement evidence must establish continuity; the key alone does not justify copying. Omission does not cause reuse.

Interpretation inputs place IDs beside the data they name. Evidence includes its quote, inline context, and source identity. Link candidates include URL, label, and supporting quotations. Saved values and registered points include their owners and applicable versions; vocabulary IDs include their facet and meaning. Models copy supplied IDs rather than derive them from labels or array positions. Editor can search all saved current-run source files through the native Mastra workspace grep tool. Code supplies source IDs beside their relative file paths. Search results include paths, line numbers, matching lines and requested context. Code resolves artifact paths, source offsets, and saved-version checks. An existing ID can still name the wrong fact or place, so Editor must check meaning as well as reference validity.

Tickets returns one complete `variants + basePrice` block without per-offer URLs. Explicitly supported free full-programme admission can use an empty `variants` list when no ticket categories are published; other replacements require at least one observed offer. The free claim still requires source evidence and Editor approval. Code reuses price and money validation with an ingestion offer schema that excludes `url`. A supported replacement contains the observed offers without their URLs; without a supported replacement, the saved block stays intact. Historical ticket blocks remain untouched. Catalog price operations and schemas outside ingestion keep their existing contract.

The price block is one review group. The Edition ticket link is a separate Links proposal and can change without a price block. Product pages remain useful sources and can supply the Edition link under the existing single-destination fallback. No association between an offer and a product URL is collected for the result.

Dates, the full ticket block, the full classification list, and each complete Location decision bundle are review units. General's identity and Edition selection form shared prerequisites. Rejection of an identity blocks the whole item. Rejection of a slot or a temporal premise used to select it rejects dependent proposals, including reuse of earlier saved points. No proposal is reassigned to another target. If preserving a rejected group would conflict with an accepted change, reject the dependent slot rather than compose an inconsistent result. These are fixed ownership rules, not a model-generated dependency graph.

Editor returns decisions in the same fixed field/group shape, not a list of addresses. For example, a submitted `currentOrNextEdition.tickets` change requires a decision at that same key. The schema permits only `approve` or `reject` with a reason at each submitted group. Fixed target decisions cover the Event and each selected Edition slot. Unknown fields, decisions for absent proposals, and missing required decisions are invalid. It can accept a target while rejecting its field changes; this preserves the existing addressed-target publication behavior. Accepting a supported new target still requires its creation reason, but does not require every optional field. Declining the target skips creation and publication. Invalid required agent output or an invalid final plan stops the whole item; ordinary uncertainty in a valid result does not.

## Agents

Every prompt treats source text as data, uses the frozen date, and forbids unsupported claims. Each role receives only its task rules and required context. No role writes to the catalog or source files.

### Research

**Description:** Select sources and account for the assigned collection work.

**Prompt outline:** Follow the concrete assignment. Prefer relevant known links. Use discovery only for the allowed source, identity, date, or publication need. Do not search only for an absent optional price or an unannounced next Edition. Track blocked and unattempted checks. Do not interpret prices or taxonomy and do not propose mutations.

**Input:** Compiled instructions and checks, identity and country clues, known links, fixed date, compact page overviews, page coverage and leads, remaining limits. No raw page bodies, taxonomy vocabulary, or mode/scope labels.

**Output:** `checks[]` and `unresolved[]` only. Each collection check contains `check`, relevant `sourceIds` and `blocker`. A null blocker means no specific relevant source acquisition gap remains. A non-null blocker is one short text reason. Its field description recommends at most 300 characters; longer reasons remain valid and are retained in full. It names the source need and cause, not a proposed value. The owner selected text without category labels: consumers need the reason and blocker presence, so Research need not classify the cause into a separate enum. Apply it only to the affected check. A checkout can block prices while an inspected referring page establishes its link. An archive gap concerns historical collection, not current links. Missing optional facts, broader description or fresh genre names alone do not create a source need. General and specialists decide evidence sufficiency, continuity, identity and chronology. Preserve real source blockers even when a specialist can propose a useful value.

`unresolved` contains only `{ message }` for distinct owner decisions. Its field description recommends one short sentence, normally at most 300 characters. Do not repeat blockers or source facts. Research does not return `finding`, `completionReason`, `evidenceIds`, question field names, Edition keys, successful-check explanations or another source list. Code records technical execution and source outcomes, and adds the inspected source list to the workflow result. Report completion combines collection blockers, required check presence, semantic findings and processing coverage. Source summaries retain Reader overviews, blocker reasons and specialist explanations.

**Tools:** `inspectPage(url)` and existing bounded `searchWeb`. `inspectPage` invokes source access and Reader, then returns the source ID and URLs, page overview, coverage, lead URLs with labels, retrieval and processing outcomes and limits, and remaining budget. It does not return evidence IDs or the full Markdown to Research. Code retains the evidence for interpretation and review. Research can request independent pages through several tool calls in one step; the host bounds their concurrency.

Code also adds each blocked collection check and its cause to the report's unresolved items. This retains the reason even without an informative source overview or a separate owner question. Research states that reason once; report assembly does not need another model summary.

**Completion:** Finish when no useful permitted step remains or assigned checks are resolved or blocked. Do not generate a separate completion summary. Code enforces the collection allowance and records a forced cutoff. Unfinished checks remain explicit. Permission to search does not require a search. Leave time for interpretation and review.

### Reader

**Description:** Read one saved page and describe its content while extracting exact evidence.

**Prompt outline:** Describe what the page contains, including archives, unrelated material, and limits. Extract relevant passages for all assigned topics in the same pass. Keep a coherent paragraph or small table as one quotation when it supports several facts; do not create an evidence item for each price. Copy sufficiently complete literal quotations for unique matching; include adjacent offer names or conditions instead of an isolated amount when needed. Keep separate literal headings, years, and qualifications in `context[]`, without joining distant passages into one quote. Retain negations, table relationships, object labels, and anchor destinations. Do not choose catalog values, Edition keys, or taxonomy IDs. Do not resolve contradictory statements by omission. Retain a literal Event name from a title or heading when the body does not repeat it. Do not repeat a separate identity passage as context for self-contained dated facts.

**Input:** One full canonical page within the configured input limit, source metadata, the requested name and fixed date, and extraction topics and exclusions. Do not pass Research navigation instructions to Reader. Its overview describes page content, without judging the requested Event identity. No full catalog, earlier model overview, or other page history.

**Output:** Bounded page overview, `coverage: { found: string[], notPublished: string[] }`, exact quotations with inline context quotations, topic tags, literal Edition clues, relevant anchor quotations, and uncertainty notes. Code binds citations and parses anchors from the matched quotes and context. Reader does not return a separate anchor array. Code also extracts actual Markdown links as navigation leads, independently of Reader evidence selection. These leads do not prove destination content. Reader does not create links between evidence items. Historical ticket material found incidentally remains source context; it does not authorize a historical ticket proposal.

**Tools:** None. Code handles loading, input-limit checks, persistence, exact matching, and ID assignment.

**Completion:** One structured response per page admitted for processing. Code records pages not processed because of input or execution limits. Invalid structured output follows failure policy without a semantic repair call. Valid output with individual unanchored quotations retains usable evidence and the extraction limitation.

### General facts and Edition selection

**Description:** Establish common target identity and temporal roles, then propose common descriptive facts.

**Prompt outline:** Own the final Event identity decision, including confirmation of a duplicate add against supplied catalog candidates after ordinary collection. Distinguish supported Event identity from Edition changes: venue, locality, genres and programme format can change within the same country. An absent saved locality is unknown. These changes alone do not require a full refresh. Explicit unrelated-Event evidence and country conflicts still stop current refresh. For a confirmed duplicate, return only the matched Event and identity basis. Otherwise match stable Edition keys and select the latest actually completed Edition and the ongoing or nearest announced future Edition as assigned. Preserve inclusive local dates and one realization across multiple programme periods. Do not infer an unannounced Edition. Propose a factual English description and participant-scale estimate only with support. Preserve existing Event names, aliases, slugs, and time zones.

**Input:** Identity task and context, fixed date, field permissions and General's assigned check keys. Candidate records retain Event IDs, names, aliases, description, version, publication state and official URLs; saved Editions retain their owners, keys, versions, chronology, time zones, common facts and place identity. Prices, taxonomy, coordinates, timestamps, other roles' instructions and navigation settings stay in the host. Frozen evidence covers identity, dates, status, description, and participant scale.

**Output:** Either an identity-only duplicate result with a supplied matched Event ID, identity basis, and observed name when available, or the fixed `TargetContext`, `observedEventName` with its evidence or supplied identity basis, creation/matching reasons, `event.summary`, and common fields under the selected Edition slots: year, dates, scheduleStatus, displayName, and sizeEstimate. Changes carry their reasons and support references. Checks and questions retain source support for unchanged values. A supported observed name supplies the name of a new Event. For an existing Event, it only supplies private name-mismatch metadata under the existing rule. Event summary is excluded when not assigned. No public URL actions.

**Tools:** None.

**Completion:** One result from the frozen corpus, without another collection round. Unresolved temporal ordering or Edition matching leaves that slot null with an unfinished question; it does not reject an established Event identity. Code validates the matched Event reference before an identity-only duplicate skip. That branch runs no specialists or Editor, returns no Edition targets, and preserves existing names and name-mismatch diagnostics. An uncertain identity cannot authorize creation or a duplicate skip. An unresolved Edition role stays null. A material identity conflict stops the item. General's temporal result is provisional until Editor approves it, but downstream agents cannot change it.

### Tickets

**Description:** Interpret offers only for the selected current-or-next Edition, including an ongoing one.

**Prompt outline:** Separate general full-programme admission from day tickets, packages, and concessions. Preserve offer conditions and per-offer availability. Normalize local notation only when source context identifies the currency; an ambiguous symbol alone is insufficient. Numeric amounts require a supported ISO currency code. Closed sales differ from sold out. Replace only the offers supported by this check; do not copy unchecked old offers. Without a supported price, preserve the saved block.

**Input:** The selected current-or-next target, its saved ticket prices and offer conditions, ticket evidence, and the applicable field assignment. Per-offer URL fields, the previous-Edition price block, and the Links result are not sent for interpretation.

**Output:** Optional `currentOrNextEdition.tickets` change containing a complete `variants + basePrice` block without per-offer URLs, plus support references and unresolved questions. Tickets produces no link actions or work for Links.

**Tools:** None.

**Completion:** One result for `currentOrNextEdition`. The observed offers need not cover an inaccessible checkout. Limited passes, concessions and admission/stay packages remain offers; only the base price requires full-programme general admission. Each variant needs observed price, explicit availability or concrete admission terms. A category name, product link or referral to unread details alone does not establish an offer, even with null amount and currency. Keep such categories in unresolved questions. Unknown-price offers with explicit availability or admission terms remain valid. If that slot is null, do not call the agent. Historical prices and links are neither audited nor modified, and their omission is not an incomplete check.

### Classification

**Description:** Prepare the full classification list for each assigned Edition.

**Prompt outline:** Use supplied term IDs. Apply facet limits and programme/physical-format definitions. Preserve unchallenged saved terms. Reuse classification from an earlier saved Edition only with an explicit continuity basis. Keep detailed outdoor, snow, surf, and food guidance here rather than in Research or General. Do not create terms or Event defaults.

**Input:** Fixed targets, relevant programme and format evidence, existing terms, eligible earlier saved Editions, and vocabulary. Both selected Editions share one call when assigned.

**Output:** Optional `previousEdition.classification` and `currentOrNextEdition.classification` changes with complete lists, evidence for new terms, optional `reuseFrom` with the earlier saved Edition's key and continuity explanation, and unresolved questions. Code identifies retained target terms from saved assignments.

**Tools:** None.

**Completion:** One result. Code validates term IDs and facet counts, then applies existing ancestor normalization. Editor can reject a semantically unsupported valid list but cannot repair it.

### Location

**Description:** Prepare a coherent place bundle for every selected Edition before final review.

**Prompt outline:** Own venue, address, locality, administrative area, country, and coordinates together. Distinguish venue from office, parking, camping, and other years. Preserve applicable saved points; prefer explicit official venue points under existing rules. Precision describes the represented place. Use registered point IDs when selecting a source or geocoding candidate. Use `reusePrevious` only when the supplied `previousPoint` applies. Do not generate coordinates or infer a location from distance alone.

**Input:** Fixed selected targets and their temporal premises, location evidence, saved place history, country baseline, registered source/target points, a nullable `previousPoint` for each slot, initial reverse observations, and remaining geocoding allowance. Code selects the default `previousPoint` from a unique suitable earlier saved Edition under the existing chronology rules. It need not be the `previousEdition` update target. No Editor result is available at this stage.

**Output:** `previousEdition.location` and `currentOrNextEdition.location` bundles for the selected slots, with explicit keep/set/clear text decisions, keep/clear/select/reusePrevious point decisions, source evidence IDs, reasons, and questions. `reusePrevious` contains only its action and reason. Code binds it to that slot's `previousPoint` and records the earlier Edition, version, copied pair, and precision. A missing previous point makes that action invalid. `select` retains a supplied `pointId` and precision because several registered candidates can be available. Code obtains the selected point's basis from its registered record.

**Tools:** Existing bounded forward `geocode`. Code prepares reverse context for a saved target point or `previousPoint`. Location chooses the forward query from evidence, so no old Research location-finding contract is needed before this call. Existing six-call and eight-step limits remain; initial reverse requests consume the same allowance.

**Completion:** A valid result or an explicit rejection within the limits. Source coordinates are registered only from literal validated pairs with source object and year context; code reuses the parser's coordinate checks. A source point reference establishes provenance, not Edition applicability. Editor reviews the whole place bundle. Rejecting a temporal premise also discards dependent place decisions.

### Links

**Description:** Classify candidate URLs and choose which public links belong in the result.

**Prompt outline:** Distinguish Event website, official social account, and Edition ticket destination. Verify association and owner from evidence. Prefer the official ticket overview for the Edition ticket slot when one is established. Do not assign product URLs to individual offers. Do not publish article, map, evidence, organizer-contact, or unrelated brand URLs as miscellaneous official links. Preserve meaningful path/query parameters. Remove tracking only when its purpose is clear; do not invent a destination. An unread checkout does not invalidate an officially linked URL, but supplies no price evidence.

**Input:** Fixed identity/targets, permitted public-link slots, saved links, URL candidates with anchor quotations, labels and nearby text, and source metadata. No Tickets result or offer IDs are included.

**Output:** Changes under assigned Event website/social fields and `currentOrNextEdition.links.tickets`, with URL values, support, material ambiguous candidate reasons, and unresolved questions. `omitted` is empty when there is no material ambiguity for an assigned slot. Do not enumerate routine navigation, articles, archives, maps, contacts, duplicate anchors or clearly unrelated URLs. Each supported official social slot gets a proposal or a material ambiguity explanation. No per-offer URL fields or product-link decision map is returned. Historical ticket links remain unchanged. Evidence and geocoder transport URLs are never public-link actions.

**Tools:** None. Links uses the frozen corpus and does not fetch destinations. Missing association stays unresolved for this run.

**Completion:** One result in parallel with Tickets, Classification, and Location after General. A single supported product destination can serve as the Edition ticket link only when no supported overview exists. Count distinct supported destinations rather than anchor occurrences. This preserves usable booking links while enforcing the known Roskilde overview rule. No new Event or Edition link kinds are added.

### Editor

**Description:** Validate the proposed result and approve or reject it without writing values.

**Prompt outline:** Check Event/Edition identity, source support, scope, and consistency. Review the fixed field/group proposals and their reasons. Use source reads to verify the proposal under review, not to discover extra field values. Event identity approval is independent of an unresolved null Edition slot. Supported observed offers do not promise a complete inaccessible checkout. Check support for every variant: price, explicit availability or concrete admission terms. Reject the whole ticket block if a category has only a name or referral to unread details. Editor cannot remove or rewrite individual variants. Approve or reject at the supplied field/group key. Reject dependent work when its premise fails. Never change a value, key, link destination, or classification list, and never request another research round.

**Input:** The authoritative fixed `currentDate`, General's target decisions, assembled proposals with reasons and evidence IDs, validation results, and unresolved checks. Code includes the saved values, classification reuse source, selected point records, and safe geocoding observations bound to those proposals under the rules above. Their owners, provenance, and applicable versions remain available for review and write validation. Record creation/update timestamps and source dates do not replace `currentDate` for temporal selection. Editor does not load them through a tool. Code also lists every saved current-run Markdown path, URL and available Reader overview, including uncited pages and saved pages with incomplete processing. Failed fetches without saved Markdown add no path. The full page bodies and unrelated saved history are not included. Include the relevant rules for the groups under review and the used taxonomy definitions; do not repeat every discovery or specialist instruction.

**Output:** Item decision, fixed Event/Edition target decisions, and field/group decisions that mirror the supplied proposal keys, plus reasons and unresolved questions. The output schema has no field for replacement values or arbitrary proposal addresses.

Code supplies that schema once through native structured output. The user input does not repeat it as `decisionShape`. The complete fixed decision keys and local validation remain required.

**Tools:** Use the native `mastra_workspace_grep` from `createWorkspaceTools` without changes to its search implementation, arguments or output. Its arguments are `pattern`, `path`, `contextLines`, `maxCount`, `caseSensitive` and `includeHidden`. A read-only `LocalFilesystem` is rooted at this run's source directory; only grep is enabled. A workspace hook requires an exact listed current-run Markdown path and checks the existing source hash before each call. Code supplies `sourceFiles: { sourceId, path, url, overview }[]` with source IDs, relative paths, URLs and available overviews. Access includes uncited and unprocessed saved pages from this run. Each inspected passage can validate a fixed proposal; it does not certify complete page processing. No custom search, shell, new dependency or workspace tool schema is added. The normal six-step Editor allowance stays in force.

Use focused regex patterns only when a submitted proposal needs more context; normally request three context lines and ten matches. These are prompt guidance, not added tool limits. Native output includes path and line numbers and can shorten matching lines. A missing or shortened match does not establish absence. Application provenance in the file header is separate from website claims. Editor still reviews supplied proposals only; it cannot add values or start another research round. The owner selected native grep after the [standard-tier comparison](../../../docs/proposals/source-evidence-eval-comparison.md#native-mastra-grep-experiment-2026-11-01). That run shows working source validation, but no cost saving or proven quality gain. `readEvidence` is removed.

**Completion:** One bounded review session. Missing proof means rejection or an unresolved preservation decision, not a guessed correction. Tool or generation failure that prevents a valid complete review stops the item.

## Key decisions

### One extraction pass, limited downstream context

The user requested one full page reading and shared evidence. Reader gets one page in one call so that distant headings and qualifications remain available together. Its separate context prevents Research from sending the full page again on later steps. The page-input limit bounds this work; oversized pages remain saved but unprocessed. Cited validation reads remain allowed. Extraction can miss relevant text; retaining Markdown makes the omission inspectable but does not automatically repair it.

The alternatives were bounded windows with carried exact context, or windows followed by targeted reads to recover missing context. Carried context needs rules for retaining and binding earlier headings and later qualifications. Recovery reads add calls and decisions about what to reread. Use the full-page call for this version: it removes context transfer between windows, at the cost of leaving pages above the input limit unprocessed. A larger page must not silently fall back to chunking or a truncated prefix.

### Model text length guidance

Field descriptions recommend short decision reasons, owner questions, source summaries and diagnostics. Longer text remains valid and is retained in full. Reader uses the same rule for overviews, coverage labels, scope hints, uncertainty, year labels, limitations and literal boundary text. Exceeding a style recommendation must not reject an otherwise valid role response or discard its evidence.

Keep required nonempty text and strict result shapes. Catalog values retain their operation validation, including text lengths. Exact quotation matching, the 24,000-character quote limit, item counts, model context budgets and external tool contracts remain enforced. The boundary text recommendation does not relax the restored quote limit.

### Compact model inputs

Keep the complete frozen corpus and saved records in the host. Model inputs contain only the fields the role needs. Classification receives saved chronology and terms; Links receives saved chronology and links; Tickets receives saved chronology and prices. Selected-target context keeps the key, selection reason, support and temporal proposals. Location receives selection explanations without General's unrelated field proposals. Quotation text, necessary context, topic routing and uncertainty remain available. Parsed anchors are included for Links and Editor only; other roles still receive the exact linked source text.

Model evidence packets omit empty context, Edition clues and anchor arrays, null uncertainty, and repeated retrieval timestamps. They retain evidence/source IDs, the final source URL, the complete quote, topic tags and all nonempty semantic context. Complete provenance and anchored spans stay in the saved corpus. Omitted empty fields do not mean missing source coverage.

Research receives each exact navigation URL and label pair once in its conversation. Keep different labels and query parameters. Source records retain every original page lead; navigation suppression changes neither artifacts nor evidence. Later page results retain their source identity, overview and processing coverage even when all their leads were shown earlier. No relevance filter or new page limit is added.

Reader uses a short page overview and avoids repeating facts in Edition clues or uncertainty notes. Prefer the shortest unique literal passage that retains its object, dates, conditions, negations and exceptions. Use one evidence item with several topic tags rather than overlapping copies. These instructions do not permit truncating source text, removing necessary context or dropping ambiguous facts. Compare main quality and native usage before accepting a cost improvement.

Reader supplies short page-coverage lists so Research can distinguish collected detail from an extraction gap. `found` names the information collected, with an Edition clue only when needed. `notPublished` summarizes only explicit source statements that information is unavailable or not announced; silence uses an empty list. Field descriptions recommend entries under 100 characters, with at most nine found entries and six explicit absence entries. Longer entries remain valid. Coverage is local to that page and is navigation context, not evidence or a collection verdict. An unread or unprocessed page has null coverage. Keep real extraction problems in `limitations`; ordinary absent optional facts do not make processing limited. Research still follows useful leads and retains blocked mandatory checks. It does not require a separate page when inspected sources already cover the assigned question. Compare one identical main and affected-regression selection before and after this experiment; retain factual checks and inspect search counts and native usage.

### Selected inference settings and cache policy

The default model is `openai/gpt-6-luna`. The shared reasoning default is `low`. When that setting is low, Research, General, Editor and Location use `medium`; Tickets, Classification and Links use low. Reader always uses medium after the isolated evidence follow-up. The other stages preserve explicit reasoning settings other than low. The 2026-11-01 repeated main experiment measures the Research setting in the [eval comparison](../../../docs/proposals/source-evidence-eval-comparison.md#cost-experiment-after-reset-2026-11-01). Eval model overrides still apply to every role, including Location. These are implementation settings, not catalog acceptance rules.

Reader disables prompt caching with OpenRouter `prompt_cache_options: { mode: "explicit" }` and no content cache breakpoints. Other roles keep provider caching. This is prompt caching only: source-session caching and one Reader call per admitted source remain unchanged. The native provider integration test checks request forwarding and absence of breakpoints.

The shared model output limit is 16,000 tokens per step; Reader has a separate 12,000-token output limit. Collection admits at most 18 Reader calls, bounds full-page input at 360,000 characters with a 72,000-character instruction/output reserve, and reserves 180 seconds for downstream work. Research allows 15 ordinary steps, Editor six, Location eight, and the other roles one. Research and Editor use the shared tool concurrency limit of three. The common run deadline remains ten minutes. Standard-tier evals set the tier explicitly; the runtime default remains flex. Explicit provider-unavailability recovery remains separate from these ordinary step limits.

For cost review, separate ordinary input, cache writes, cache reads, output and available reasoning tokens by role. Separate agent invocations from model steps. Provider-reported cost remains outside catalog reports. Cache writes are not cache hits. Verify uncached Reader accounting against ordinary input/output usage rather than treating absent cache metrics alone as proof.

The selected native-grep profile passes the latest single standard-tier main run with Reader caching disabled: five scenarios, required facts 15/15 and additional facts 31/33. Estimated model cost is USD 0.051433835 for five attempts. A ten-attempt result and a cost saving are not established by this single run. See [the evaluation comparison](../../../docs/proposals/source-evidence-eval-comparison.md#native-mastra-grep-experiment-2026-11-01) for actual tool use, usage and comparison limits.

### Native grep with application access checks

Mastra provides filesystem grep. Editor uses that tool with a read-only workspace and the current-run source access and hash checks in a workspace hook. The application does not implement search. Keep proposal ownership and quote binding in the existing validators. Do not add a shell or a general search subsystem. Evidence packets and bounded overview sizes are configuration details; limits must be visible rather than silently dropping assigned work.

### Independent price and link proposals

The owner removed per-offer URLs from ingestion to avoid an offer-to-link join. Tickets prepares a complete price block and Links selects the Event and Edition links in parallel. The Roskilde overview rule and its resolution are recorded in [the archived issue](../../../docs/archive/known-issues/2026-10-27-roskilde-edition-ticket-link.md).

### Parallel page inspection

The installed Mastra supports concurrent tool calls within one model step. Use its `toolCallConcurrency` setting to bound Research tools, rather than adding a scheduler. A model can return several independent `inspectPage` calls, but support does not guarantee that it will choose to do so. Each Reader call receives one page; different pages can be processed in parallel.

Extend the source session's shared in-flight result to cover loading, Reader work, and persistence for each page. Reserve shared allowances before asynchronous work and pass cancellation through retrieval and Reader calls. Each inspection writes its own source files and binds IDs before exposing results. Freeze only after admitted inspections settle or stop. No background task can add evidence after the freeze. These rules prevent duplicate extraction and incomplete snapshots without changing the source permissions or adding a total page-count cap.

### Bounded work and failure policy

Keep the shared deadline and search/geocode limits. Add a finite Reader call allowance, a configurable full-page input limit, and bounded output settings, with a collection cutoff that reserves time for specialists and Editor. No independent fixed page-count or link-depth cap is added. Track configured limits and actual calls; reserve scheduling counters are not billed-cost reports. Tune numeric allowances using fixture measurements before rollout.

No semantic retry, specialist repair, or research-after-freeze loop is added. Keep workflow step retries disabled; additional retries for temporary specialist failures are deferred. Existing explicit provider-unavailability recovery is separate and remains bounded. Finalization waits for all active branches to finish or stop. A valid partial result can permit unrelated supported changes. Invalid required role output, corpus failure, country conflict, or invalid final assembly stops the whole item. A blocked fetch is still a source outcome, not automatically a failed entire run.

### Private artifacts and reports

The corpus is required execution data. Persist source files before exposing evidence references; a persistence failure stops dependent work. Workflow results retain references and bounded metadata without separate source-body copies. Required workflow-history failures keep their existing failure policy. Reports retain their existing source descriptions. Owner inspection can open saved files without new source/model calls. Traces keep their separate policy.

Remove `CATALOG_CAPTURE_TOOL_OUTPUTS`, its optional writer, and capture plumbing. Required source artifacts and saved workflow results provide inspection without another storage option. They do not retain the exact ordered tool-response dump, including discovery responses and repeated cached results. Evaluation fixtures and their recording remain separate from this removed debug feature.

Keep the current report version and owner-facing fields. Research, editorial, and location statuses describe collection, update validation, and place-check outcomes, rather than technical model execution. Code derives research completion from usable findings, assigned check outcomes, source limitations, and processing coverage. Useful findings with a known unfinished mandatory check remain partial even when every model call completes. Report assembly combines execution observations with validated domain results and retains actual final response text without fabricating earlier responses. A valid Location rejection still produces the existing rejected location outcome and host-generated diagnostic from its reason; it does not replace a successful research outcome. Catalog operations, changes, source summaries, errors, and unresolved questions keep their existing meanings.

When General cannot confirm Event identity after usable evidence collection, keep `researchStatus: partial` and `outcome: failed`. The domain refusal does not erase the collected findings. Editor and writes do not run. Without usable evidence, research remains failed. Regression checks state the expected collection status separately from the failed catalog outcome.

Use General's actual final response for the report's `modelResponse`, including its identity-only response on a duplicate add. When General has not run, that response remains unavailable. Use the actual Editor and Location responses for their existing response fields. Derive returned-target counts from the selected roles; a duplicate has zero selected targets and no Editor or Location response. Record the prompt and model settings of the represented calls in the existing report fields. Keep navigation, Reader, and other specialist responses and settings in saved execution results. Do not build a synthetic model response from several calls.

Build source summaries from the saved source records and Reader descriptions. Include applicable validated check findings and exclusion explanations. Report and Location inputs no longer depend on a source list returned by Research. Inspected sources remain distinct from unread leads, and summaries remain available for no-op and failed-write outcomes.

Detailed specialist results, skip reasons, fixed field/group decisions, corpus references, and processing coverage belong in private source artifacts and saved workflow results. CLI and Studio continue to use the same final report. Do not add a report-version change solely because internal agents change. Historical reports remain unchanged. Token/cost totals and execution replay remain outside the report contract.

### Regression checks in code

All 45 regression cases define their conditions in TypeScript beside the case inputs, as main already does. Each pipeline case function contains its catalog mutation, source-check and tool-use conditions. Direct Location cases have their own registered functions. JSON retains only inputs, source references, geocoding fixtures and captured role results. Remove the JSON assertion schema and interpreter, including `required`, `forbidden` and `toolUse` expectation blocks. Keep small helpers for observed changes, findings and tool order rather than a second comparison language.

Pipeline conditions inspect dry-run mutations, not just final values. Resolve a new Edition through its creation operation and writer reference, and retain key/year selection for saved Editions. Direct Location conditions require an actual point or precision change for completion and correction. Preservation checks retain the point and precision. Keep explicit price, link, unresolved-question and deliberate-refusal conditions without passing them to models. Reject an unregistered evaluator in every group before model calls. Save individual check messages and pass/fail values in the existing scenario result.

Scorer revision 13 and the dataset hash identify this migration. Hash shared scoring code as well as case code and inputs. Rechecking saved outputs verifies the migration only; it does not establish quality for the current prompts or close the fixed-corpus and geocoding fixture work in task 6.1. Original experiments remain unchanged.

Scorer revision 14 corrects selected saved-value checks and deliberate-refusal checks. An omitted date or year proposal can retain the value of the exact selected saved Edition; an explicit proposal or clear takes precedence. Required mutations still need actual changes. A successful Location keep can retain a saved venue. Editor fixtures use schema version 3 with fixed page order, Reader quotations, collection results and specialist proposals. Research and Reader use those results without model calls; normal binding and source artifacts remain in use. Editor and eligible Location execution stay live. Validate the fixed corpus and citations before provider setup. Label added synthetic Location evidence and query aliases in provenance. Keep incomplete research and unsupported changes visible as failures.

## Simpler options

Keeping one Research agent and only adding files would reduce implementation work, but retain the broad prompt and repeated page context. Letting each specialist read full pages would remove the Reader contract, but repeat the expensive reading the user wants to avoid.

Keep description and small facts with General instead of creating another role. Do not create agents per field, facet, or Edition. Reuse the current parser, geocoder, Mastra control flow, and catalog validators. A second research round could recover missed evidence, but adds synchronization and repeat-work rules; it is deferred. Rejected or missing facts remain unresolved in the first version.

## Risks and validation

- **Extraction loses qualifications or distant context:** use full-page fixtures with facts after the old prefix limit, distant year headings, table footnotes, repeated short prices with unique surrounding text, and metadata/body conflicts. Verify one Reader call for an admitted page, exact quote binding, and the saved but unprocessed outcome above the input limit. Keep source coverage separate from factual recall.
- **Mode policy leaks into models:** inspect injected Research inputs for concrete tasks and absence of mode/scope labels. Test full/current source recovery and the historical-ticket exclusion.
- **Technical success hides unfinished work:** verify partial research after completed model calls with an unfinished mandatory check, verified unchanged fields without proposals, and a valid domain rejection distinct from malformed output. Verify host-generated skip reasons and safe errors without asking models to report execution status.
- **A parallel branch fails while another is active:** keep step retries disabled and verify finalization waits for active branches to finish or stop. Preserve available results and diagnostics without catalog writes when a required branch fails. Recovery from other temporary specialist failures requires a new ingestion run; the existing bounded provider-unavailability recovery remains in place.
- **Wrong ownership or partial assembly:** test unknown evidence/point IDs, forbidden role fields including per-offer URLs, missing or extra review keys, public links for another Edition, rejected temporal premises, and complete Location/ticket groups. Verify identical assembled results when parallel branches complete in a different order. These checks extend existing validators rather than duplicating money or parser algorithms.
- **A summary becomes proof:** use a page overview that omits or misstates a qualification and verify that a mutation still needs anchored evidence. Correct reference syntax alone must not pass wrong-year or wrong-festival evaluation cases.
- **Link selection differs from price selection:** cover an overview plus product URLs, an inaccessible checkout, official socials, unrelated same-brand links, and meaningful query parameters.
- **Evaluation changes hide a regression:** remove historical ticket expectations, including the Glastonbury special price check, and add preservation checks. Change dataset/scorer revision and compare both implementations on the same revised task boundary. Keep main quality and regression results separate.
- **Extra short calls cost more:** measure per-role duration and available input/output/cost observations on the same fixtures. No numeric cost or quality improvement is claimed before those runs. Historical ticket and per-offer URL work are deliberately removed; do not count those scope reductions as extraction quality gains.

Implement in contract, corpus, agents, assembly, and consumer stages as listed in [tasks](tasks.md). Do not expose the new pipeline through normal execution until the required contract and integration checks pass. Existing old reports remain inspection data, not inputs for migration or replay.

## Follow-up decisions, 2026-11-02

The owner accepted four follow-up choices. An unresolved historical check needs a clear historical question and preservation of the unchecked record, without an exact Edition key. Search limits depend on the unresolved permitted need; synthetic cases retain their declared zero/one-query limits when their sources suffice. General and Editor use `scheduled` for a complete programme date range, including provisional dates, and `announced` without one; explicit cancellation/postponement takes priority.

Geocoding replay first uses the exact request, then a normalized forward-query comparison under the same explicit country filter. Normalize Unicode accents, case, punctuation, word order and country labels in English, Spanish, Portuguese, French and German. Keep all other place tokens, so city requests do not become venue requests. Conflicting normalized responses return `unavailable`; reverse requests stay exact. This broadens matching without a model call, new query aliases or live fallback. It does not infer arbitrary place-name translations. Scorer revision 16 and the dataset hash separate the new checks and replay behavior from earlier experiments.

A controlled low-versus-medium Research comparison remains a separate experiment. These choices do not establish new model quality or close the remaining full-change validation tasks.


## Isolated Reader evaluation

The `regression/reader` group uses three existing full-page fixtures without source copies: Sziget homepage, Roskilde ticket overview and Harbor Echo venue confirmation. Each page has a small TypeScript requirement list. The runner supplies the production Reader input and limits, binds literal output and saves the execution plus accepted evidence as a normal Mastra experiment. It does not run collection, other roles or writes, and it does not expose requirements to Reader.

Code checks complete passage groups available to their named recipient through production topic routing, usable literal evidence, empty model limitations and nonpublication lists for these readable pages, and nonempty navigation coverage. All parts of a requirement stay in one item and its context; checks do not combine unrelated facts from a whole packet. Complete product descriptions can identify an offer without its commercial label. Complete confirmation and rejection claims about the same Event can have separate requirements. The source page URL is already available in metadata, so Reader need not duplicate it as a link quotation. Other link destinations still need literal evidence.

Mastra presents scenario success, evidence recall and literal validity. Literal validity is diagnostic; a discarded extra quote does not fail the scenario if all requirements remain in accepted evidence. Saved binding limitations and production partial-processing rules stay unchanged. A passing Reader case establishes required evidence, not flawless extraction or full-flow success. Unique source coverage and extracted text with repeated context remain diagnostics. No judge model, repair call or new package is required. This narrow group does not replace full-flow quality checks or claim exhaustive page recall.


### Full-suite quality follow-up

General requires nonempty source support for every selected temporal target, including a saved Edition. An unsupported saved candidate remains null with an unfinished check and question; it must not invalidate another supported target. Each candidate uses its supplied timezone, or UTC when absent, to decide whether it is ongoing before considering future candidates.

Classification assesses facets separately: a music genre does not replace the music topic. Location keeps an applicable saved point over a new geocoder name match without evidence of a move, wrong object or mapping error; the official-source-coordinate priority remains in use.

Main checks accept supported subsets of allowed optional historical terms. Wacken also accepts its named Loyalty, Faster and Harder categories with sold-out availability and no amount/currency pair. This is an explicit case rule, not permission for arbitrary unpriced offers. The synthetic size-history page states actual realization directly so its size-estimate check does not depend on an ambiguous completed-programme statement.

General distinguishes programme continuity from Edition identity: a later annual occurrence is new unless source evidence corrects or reschedules the same realization. General returns only assigned check keys and does not audit history when previousEdition permission is false. Report status uses assigned role gaps, so an extra unfinished out-of-scope check alone does not cause partial status.

For several venues in one supported locality, Location uses the locality fallback when no primary venue or applicable saved point exists. One confirmed show does not establish a representative venue for the whole Edition.

Editor treats a published numeric price with unresolved currency as an observed offer. It can approve the source price and uncertainty retained in terms with no amount/currency pair and a null basePrice. This does not permit a category supported only by a label or an unread link.

General uses medium reasoning when the configured effort is low after repeated unsupported nullable-target outputs. The source-support minimum stays enforced. Wacken can use an explicitly declared exact or from representation at the same allowed amounts, currency and full-programme coverage. This is a case scoring alternative, not general permission for other amounts or price kinds.

Saved-precision includes its synthetic locality-point proof in evidence. Building-complex has a coherent synthetic 2025 venue statement instead of separate catalog field labels. Both retain strict point checks and captured geocoding responses.

Reader navigation coverage keeps an explicit realized, cancelled or postponed status with the programme year. Research does not require the short coverage to repeat a completion statement after a dated historical source has been inspected. General checks realization from the full quotations; a concrete unread or inaccessible historical source remains a collection gap.

For unknown ticket currency, Tickets retains the literal published price and currency uncertainty in that variant's terms, with amount and currency absent and basePrice null. A private reason alone does not preserve the public price information. Links copies source destinations exactly. Editor rejects an unsupported host, scheme or path change, including an added or removed www; a familiar address is not a verified alias.

General's size field distinguishes a supported attendance estimate from a measured current total. An explicit prior participant figure and similar-scale expectation can support an estimate even when no current count is published. The size-only regression checks these facts without certifying complete collection. Full-history status checks remain strict.


Reader retains an Event-name heading as literal identity support when the body does not repeat the name. This rule precedes text-reduction guidance; a name only in coverage is insufficient. Its context field requests only missing scope or qualifications and preserves original Markdown heading markers. Generic page headings do not add context to an already complete quote. Invalid context still excludes the item; no automatic heading correction is added.

Tickets retains the configured effort. A medium trial does not fix a false Editor rejection. Editor reviews only proposed variants at prepared.plan.<slot>.fields.tickets.value.variants; saved offers, evidence mentions and unresolved categories are not part of that replacement. Its saved-state basis remains available for preservation checks.
