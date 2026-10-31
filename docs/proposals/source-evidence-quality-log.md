---
type: Research
title: Source evidence quality improvements
description: Failure evidence, changes, and measured results for ingestion quality work.
status: draft
tags: [ingestion, evals]
---

# Source evidence quality improvements

The target is better fact quality and completeness than the original flow. The original main run has 9/10 successful attempts, 83.3% required completeness, 81.3% shared additional completeness, and no checked errors. Its available estimated cost is USD 0.06982703. The first full source-evidence run has 4/10 successful attempts. See the [comparison](source-evidence-eval-comparison.md).

Use the same five main cases and two repetitions on the standard tier. Keep the factual checks. Exclude only the previously documented historical-ticket contract difference from the shared comparison. Require better scenario success and both completeness measures, with no loss of checked correctness. Passing code tests alone does not meet this target. Record cost and time for each measured version.

## Iteration 1: preserve available evidence and clarify role decisions

Evidence from experiment `08130e16-b70b-4062-b739-1fbdabc6d16d`:

- Research guesses unavailable paths while linked ticket and travel pages remain unread. Navigation depends on Reader selecting link anchors as evidence, so some actual page links disappear from the navigation result.
- General can return a duplicate decision during refresh. The host rejects that decision and loses all useful findings.
- Tickets returns numeric prices without currency, or the literal symbol `kr.` instead of an ISO currency code. Its prompt forbids currency interpretation even when source context identifies the country.
- Location and Editor confuse another saved Edition with the target. `keep` cannot fill a new target's absent country. A shared travel page can describe a recurring venue despite a different year in page metadata.
- Reader accounts for 46% of estimated cost and most output tokens. Its work is literal extraction, but it uses the same medium reasoning effort as interpretation roles.

Changes applied:

- Extract actual Markdown navigation links in code with the existing Markdown parser. Keep relative destinations, reference links, labels, and meaningful queries. Supply these leads even if Reader extracts no link evidence. Leads remain navigation only.
- Supply Reader topic and year coverage to Research with the page overview. Prefer actual leads before guessed paths.
- Limit the refresh General response schema to targets or uncertainty. Add an explicit identity task for add and refresh.
- Give Tickets identity and location evidence as currency context. Permit supported normalization of local notation to ISO currency codes. Keep the strict amount/currency validation.
- Clarify that Location `keep` leaves an absent target field absent. Historical country and venue information are context, not values already saved in the target. Permit supported recurring venue continuity. Give Editor the same rule.
- Use low reasoning effort for Reader, which copies literal passages. All interpretation roles retain the configured effort. Update prompt versions.

Initial verification: type check passes; 28 focused evidence, role, proposal, and Location tests pass. Main evals (`86acb4e6-b17f-4bef-8f59-b4b2e6064e74`): original checks pass 6/10 scenarios, with 96.7% required completeness (29/30), 61.5% shared additional completeness (43/66), and checked correctness 8/10. A separately documented missing source-backed YouTube URL alternative changes this to 7/10, 64.6% additional (45/66), and correctness 9/10. This does not meet the quality goal. Estimated cost is USD 0.27010068; wall time is 552.547 seconds. Reader cost falls slightly, but Research and downstream input grows. See the comparison for per-role measurements.

Further verification: all 773 tests, affected lint, dependency check, documentation check and OpenSpec validation pass.


## Iteration 2: retain exact passages and shared context

Evidence from iteration 1 (`86acb4e6-b17f-4bef-8f59-b4b2e6064e74`):

- The Sziget price block has one exact source match. Reader adds `[Tickets](https://szigetfestival.com/en/tickets)` as context, but that navigation link occurs twice. Strict binding correctly rejects the item.
- Glastonbury social links repeat in header and footer. Reader returns the short repeated block and a separate unique `Accessibility Options` context. The main quote still fails its own unique-match rule.
- A Glastonbury Reader result exceeds the 20-entry `editionClues` limit. The native strict shape omits these validation bounds, so the prompt must state them.
- Roskilde ticket prices and full-pass year are retained, but Editor rejects the whole ticket block because weekday tickets do not repeat the year beside each offer.
- General uses Roskilde's recurring 130,000-participant figure in the description but does not propose `sizeEstimate`.
- Sziget Research inspects broad programme and gallery pages but does not find the useful travel page.

Changes applied:

- Rewrite Reader instructions with the actual annotation bounds. Prefer short year labels and no redundant year list.
- Explain unique matching with a repeated social-link example. Require adjacent text in the main quote; use empty context when the quote already contains the year and qualifications. Do not add repeated navigation as context.
- Require literal metadata syntax, not an invented heading. Explicitly retain supported prices, fees, venue/address, attendance and official social links.
- Prioritize useful official venue, travel/contact and ticket pages before broad galleries and unrelated news.
- Let Tickets and Editor assess a shared ticket-list year from enclosing evidence. Keep the exclusion of separately dated unrelated products.
- Clarify that an applicable recurring participant count can fill attendance; preserve its qualification rather than equating it with paid tickets.

The quote binder, money validator, frozen corpus and approval-only Editor are unchanged. Type check and focused tests pass. The next section records the completed main eval results and their failure analysis.


## Iteration 3: remove duplicate model work and clarify valid interpretations

Iteration 2 (`490db6a5-6a92-4484-a7fd-0ca3f13e3368`) passes 7/10 scenarios, with 80.0% required completeness (24/30), 72.1% shared additional completeness (48/66), and checked correctness 9/10. The source-backed YouTube alternative raises additional completeness to 73.7% (49/66). Estimated cost is USD 0.245505685 and wall time is 590.430 seconds. The goal is still unmet.

Failure evidence:

- Wacken Reader returns the exact empty Markdown link `[Wacken-Radio]()` and also returns an empty URL in its separate anchor array. URL validation stops the whole Reader result.
- Location receives the same evidence packet twice, once per target. This increases the largest downstream input without adding facts.
- Editor receives raw role results as well as the assembled proposals. Its evidence lacks source URLs until a validation tool read.
- Roskilde Editor rejects an explicitly labelled locality fallback because it is not a venue point. Another run rejects country continuity despite the bound saved Event country.
- Sziget lacks the useful travel page. General sometimes rejects a realized past festival's official history entry because it does not use an explicit completion label.

Changes applied:

- Remove the model-returned Reader anchor array. Parse links from uniquely matched quotes and context with the existing Markdown parser. Resolve relative and reference destinations against the source URL. Empty and non-HTTP destinations produce no public-link anchor; the literal quote is unchanged. This removes duplicate URL transcription, not quote or URL validation.
- Pass one shared evidence list to Location. Keep each target's saved values and previous point beside the target. Migrate point registration, reference validation, and fixtures to the same contract.
- Remove offsets and hashes from model evidence packets; retain them in immutable artifacts. Keep exact quote, context, topics, clues, anchors and source URL/time in model inputs.
- Give Editor one assembled proposal copy, identity support, saved versions and cited evidence with source URLs. Keep raw role results in host execution records.
- Clarify valid locality fallback, supported country continuity, standard unrestricted full-duration admission, and realized past-festival history. A name containing Open Air alone cannot establish programme setting.
- Give collection checks concrete extraction instructions. Prioritize venue/travel/contact and ticket pages, allow conventional official routes when navigation is incomplete, and avoid exhaustive archives after the completed Edition is identified.
- Add the literal Wacken YouTube footer URL with trailing slash as an accepted alternative. Increment scorer to 8. Keep raw earlier scores and a separate correction for this source-backed alias when comparing runs; do not apply blanket slash normalization.
- Move the existing Markdown parser dependency from development to runtime dependencies.

Verification: initial full tests exposed a missed provider-fixture use of per-target evidence. Updated that fixture to the shared input. Further verification: all 774 tests, type check, affected lint, dependency check, format check, documentation check and OpenSpec validation pass. Main experiment `003985c8-0337-4d28-9acd-12b883ea4768` has 8/10 raw scenario success, 96.7% required completeness (29/30), 89.3% additional completeness (59/66), and correctness 9/10. The independently checked address alternative gives 9/10 scenarios, 90.4% additional (60/66), and correctness 10/10. The remaining missing Wacken country prevents the goal. Estimated cost is USD 0.199265585; wall time is 433.238 seconds. See the comparison for per-role usage.


## Iteration 4: route shared place context and preserve the known country

Iteration 3 has no model execution or required-schema failures. One Wacken repetition leaves the new country's value absent. Location does not receive the 2027 ticket passage that explicitly describes the way to Wacken: Reader tags it as tickets and description only. Its remaining source material does not identify a festival venue, and it correctly refuses to use the company office address as venue proof.

Changes applied:

- Include description evidence in Location's shared packet. A factual passage can serve both Tickets and Location; page or topic boundaries must not remove that context.
- Tell Reader to apply nonexclusive location tags to relevant destination/venue/address text even inside ticket and description passages.
- State explicitly that the bound country of the confirmed same Event supports setting the new Edition country when no source contradicts it. A fresh venue address is not needed to preserve the known country. Keep venue, address and locality assessment separate. Do not copy the office address.
- Add the exact source-backed Roskilde festival address `Festivalpladsen, Darupvej 19, 4000 Roskilde` to expected alternatives. The comparison agent checked `contact.md:87–91`, which labels the festival-period address separately from the office. Increment scorer to 9. Keep original stored scores separate and replay both baseline and new outputs with the corrected expected alternatives.

Verification: type check and 32 focused tests pass. Documentation and OpenSpec checks pass. No quote matching, point ownership, country conflict, money or publication guard is removed. Main experiment `f2365864-574e-459f-8120-3ac37d06e7e5` completes all ten attempts on the standard tier: 10/10 scenarios, 100% required completeness (30/30), and checked correctness 10/10. Additional completeness is 92.7% (62/66). Independent replay with scorer 9 matches all stored results. Wall time is 421.051 seconds. Both Wacken repetitions now retain the country. The remaining missing checks are Wacken locality in both repetitions and the Glastonbury historical year/country in one repetition. These are omissions, not accepted wrong facts.


## Measured result and remaining limits

Independent comparison confirms that iteration 4 meets the main-case quality target: scenario success improves from 9/10 to 10/10, required completeness from 83.3% to 100%, and shared additional completeness from 81.3% to 92.7%. Checked correctness remains 10/10. These results cover five fixed cases with two repetitions each; they do not establish correctness for all pages.

Estimated model cost is USD 0.2141078 versus USD 0.06982703 for the original baseline, about 3.1 times as much. Input is 1,632,358 tokens; output is 172,377. Wall time increases from 275.633 to 421.051 seconds. Source reads increase from 73 to 134; searches decrease from 31 to 28. The quality gain is measured, but the cost increase remains substantial. Iteration 4 costs more than iteration 3 (USD 0.199265585), though it resolves the remaining required-country omission.

The final run uses the exact source-backed Wacken YouTube URL alternative in both repetitions. Even without those two additional credits, macro additional completeness is 89.6%, above the original 81.3%; required completeness is unaffected. Both Roskilde repetitions use an already accepted address, so the new address alternative has no effect on the final run. Original stored results remain unchanged. See the comparison for the separate scorer replay and per-role usage.

No semantic repair loop, new scheduling layer, or second full-page Reader pass was added. The changes clarify evidence extraction, reuse one shared packet, derive links in code, and state supported interpretation rules. The main quality target is complete. The implementation still has the explicit isolated-fixture, regression, obsolete-contract cleanup, and main-spec synchronization work listed in the change tasks. This result does not make the whole OpenSpec change ready to merge.


## Cost iteration 1: compact inputs and repeated navigation

The user approved three cost changes after quality iteration 4. Preserve the same agents, parallel branches, fixed corpus and factual checks. Do not tighten page limits or change reasoning effort.

Changes applied:

- Keep parsed link anchors in model packets only for Links and Editor. Preserve the original literal quotations, inline context and all host evidence.
- Limit specialist target context to the selected key, reason, support and temporal proposals. Supply saved chronology and only each role's owned fields. Classification history contains chronology and terms instead of full saved catalog rows. Tickets retains saved chronology and prices; Links retains saved chronology and links.
- Remove General's unrelated field proposals from Location selection context. Keep identity and selection reasons, supporting references, unresolved questions, the shared evidence packet and saved place history.
- Supply each exact navigation URL and label pair once per Research conversation. Preserve distinct labels and meaningful query parameters. Retain all original leads in source records and artifacts. Cached and later inspections still report source identity and processing coverage. No heuristic relevance filter is added.
- Ask Reader for a short page overview, necessary year clues only, and null uncertainty when no material ambiguity exists. Avoid overlapping copies of one passage. Require the shortest unique literal quote that retains dates, object, conditions, negations and exceptions. Keep all quote matching and applicability guards.
- Update prompt versions for every changed model input. Keep low Reader reasoning and medium interpretation reasoning.

Verification: the complete 775-test suite passes. After adding saved chronology to the smaller specialist inputs, 30 focused tests and the type check pass. Main standard-tier two-repeat experiment `1c548390-e4f3-40c0-928b-1972d3c795f8` (`source-evidence-cost-1`) exits 0. All ten scenarios pass with checked correctness 10/10, required completeness 100% (30/30), and additional completeness 92.7% (62/66), equal to quality iteration 4. The same four expected facts remain absent: Glastonbury historical year/country in one repetition and Wacken locality in both. Affected lint, dependency checks, formatting, documentation and OpenSpec validation pass. Independent native usage comparison confirms an estimated cost reduction from USD 0.2141078 to USD 0.172747905 (19.3%). Input falls from 1,632,358 to 1,310,705 tokens (19.7%); output falls from 172,377 to 159,087 (7.7%). Wall time falls from 421.051 to 363.068 seconds (13.8%). Reader uses 64 calls instead of 67; output per call falls from 1,269.2 to 1,057.2 tokens (16.7%). Reader cost falls 16.8%, from USD 0.07374093 to USD 0.06132545. Research input falls 13.3%, from 479,618 to 415,707 tokens. Every role has a lower estimated cost in this sample. Reads rise from 134 to 144 while searches fall from 28 to 27, so the saving does not come from a tighter page cap. Different navigation choices and model randomness prevent attributing the whole change to one edit. Cost remains about 2.47 times the original baseline. The fixed main sample shows no quality loss; it does not prove equivalent quality on all sources. See the comparison for all role measurements and replay.


## Cost goal: about USD 0.10 per ten main attempts

The user clarified that the target is the ten-attempt batch, preferably near USD 0.10. Use standard tier. Run one repetition for each experiment and two only for final verification. Work directly in code; do not update OpenSpec for these experiments. Retain factual checks and record estimated costs separately from external retrieval/geocoding bills.

Three read-only subagent audits inspected the saved Cost 1 traces and native metrics. Deduplicate spans by trace/span ID before counting: the export includes repeated rows. Reader uses 67,660 output tokens, of which only 2,482 are reasoning. Its repeated assignment contains 168,780 characters across 64 calls; exact source quotes account for 144,931 output characters. Navigation consumes 415,707 input and 35,419 output tokens, with 95,786 characters of lead lists in tool results. Specialist and Editor reasoning totals 30,737 tokens, or 44–69% of their output by role. Editor also receives a full schema copy in its prompt beside the native structured-output schema. These are measured experiment leads, not assumed savings.

### Cost 2: low reasoning

Change the default configured reasoning effort from medium to low. Reader remains low. Keep all source text, role prompts, output schemas, evidence routing, collection limits and validators unchanged. Explicit environment overrides remain supported. Experiment `e298d2fc-7031-471b-ac03-6c2a4d20664e` (`source-evidence-cost-2-low`) uses one repetition and tracing. Five scenarios pass, required completeness is 100% (15/15), checked correctness is 5/5, but additional completeness falls to 80.7% (26/33). Actual five-case cost is USD 0.069135315; doubling it estimates USD 0.13827063 for ten attempts, not a measured two-repeat total. Wall time is 166.939 seconds. This version is not accepted: Sziget navigation misses travel evidence; General omits the supplied Roskilde participant figure; Location rejects its explicitly labelled recurring festival-period address. These are concrete coverage and interpretation gaps; one repetition does not prove that medium reasoning is needed.


### Cost 3: literal source boundaries and focused extraction

Keep low effort while addressing the observed gaps. Research must try official travel/getting-here/location/venue sources or permitted targeted discovery before giving up on place collection. General must assess supplied attendance evidence for each selected Edition. Location distinguishes an explicitly labelled festival-period address from a separate office block and assesses recurring site continuity.

Reader now receives only extraction instructions, requested name and fixed date, instead of navigation policy, duplicate decisions, known links, check-accounting instructions and mutation permissions. Its shorter task excludes cashless-wallet operations, menu lists and whole artist biographies while retaining admission conditions, actual programme clauses, location, dates, conflicts and qualifications.

For long quotations, the model can return literal `{start,end}` boundaries, each at most 250 characters. Code requires each boundary to match uniquely in the original full page, checks forward non-overlapping order and the existing 24000-character span limit, and reconstructs the complete original passage including both boundaries. Short passages can still use literal text. This is an encoding choice, not a legacy fallback. Evidence artifacts and downstream inputs keep full literal quote strings. Context matching, source ownership and anchor extraction remain strict; ambiguous or invalid boundaries exclude that item with a diagnostic, without repair calls.

Verification: all 783 tests pass, including full-passage recovery with internal prices, footnotes and links, and rejection of missing, repeated, reversed, overlapping or oversized boundaries while preserving valid items. Type check and affected lint pass. One-repeat experiment `87203d29-e3c1-4c7b-9651-a7bb075bc68d` (`source-evidence-cost-3-bounds`) costs USD 0.058491365 for five cases; twice that is USD 0.11698273, an estimate rather than a measured ten-attempt result. It uses 462,256 input and 43,226 output tokens, 43 reads and 10 searches. Three of five scenarios pass. Roskilde creates another 2026 Edition under a new key instead of reusing `source-row`; this is a real target identity failure. Sziget supplies all expected facts but fails only because its saved address uses an already accepted alternative component order from the new-Edition check. An isolated replay confirms this exact-string gap. No stored result was changed.

Reader output falls from 34,876 tokens in Cost 2 to 22,327 (36.0%). Its cost remains about USD 0.0249: Cost 2 has 83,217 cache-read tokens, while Cost 3 has none and has 109,921 cache-write tokens after the prompt/schema change. This sample does not measure a stable cache-independent saving. No invalid boundary objects occur; some literal matches still fail uniqueness. Required aggregate completeness is 10/15 because the duplicate Roskilde Edition breaks the scorer's selected-target identity guard. Do not relax that guard.

### Cost 4: exact saved keys and compact evidence inputs

General must copy the saved Edition key for the same realization even when that key is an import label. Editor must reject an accidental second key for that realization. Model-only evidence packets omit empty context, clues, anchors, null uncertainty and repeated retrieval timestamps. Full host evidence and source artifacts remain unchanged; source URL, literal quotes, populated context, topic tags and all provenance IDs remain available. Align the Sziget saved-address check with the same source-backed component-order alternatives already accepted for its new Edition; scorer revision 10 records this correction. Dates, country, identity and publication guards stay unchanged.

Verification: all 783 tests, type check and the added compact-packet assertions pass. Experiment `c9958692-246e-4317-b51c-d368ad9e41a7` costs USD 0.046545225 for five cases; twice that is USD 0.09309045, not a measured ten-attempt total. It uses 412,900 input and 40,470 output tokens, 45 reads and 10 searches, and 157.775 seconds. Raw quality is three of five scenarios, checked correctness four of five, required completeness 14/15 and additional completeness 27/33. Roskilde no longer creates a duplicate Edition, but Editor rejects supported country continuity, losing the whole place block and publication. It also falsely treats an unrelated event in the cited evidence as an extra proposed ticket: offline inspection confirms that the proposed ticket variants and base price are valid. Sziget also uses a correct street/postal-code/city form without the country suffix, outside the address string list. This trial is not accepted.

### Cost 5: selective interpretation effort

Keep low effort for Research, Reader, General, Classification and Links. When the shared setting is low, use medium for Tickets and Editor; other explicit effort settings remain unchanged. Location keeps its shared low setting. The initial review suggested two role errors, but the deeper comparison isolates an Editor false rejection rather than a bad Tickets list. The already launched trial still tests both roles at medium; this does not prove that medium Tickets is needed. Keep all earlier input and quote savings. Scorer revision 11 adds the source-equivalent Sziget address form without the country suffix; country remains checked separately. Replay older outputs under the same revision for a fair comparison; do not change stored results.

Type check and the focused workflow tests pass. Experiment `14753258-cf71-4e64-87aa-a65f05ea932b` costs USD 0.053663465 for five cases (USD 0.10732693 doubled estimate), with 491,834 input and 47,660 output tokens, 54 reads, eight searches and 148.778 seconds. It has three of five passing scenarios. Medium Editor accepts Roskilde country and valid ticket offers, but Location translates its venue name to “Roskilde Festival grounds”, outside the stated name alternatives. Wacken lacks classification because Reader adds a nonunique formatting delimiter as context to its otherwise valid, unique metadata quote. The binder correctly rejects that complete item. Other rejected context includes a repeated Sziget year heading. This trial is not accepted; deeper audit does not support increasing all reasoning effort.

### Cost 6: semantic context and literal place names

Reader context must add missing year, scope or conditions. It must not add formatting-only delimiters or repeat facts already in the main quote. Unique matching remains strict. Location preserves the stated venue name in the source language instead of generating a translated description. Only Editor uses medium when the shared setting is low; Tickets returns to low because its previous rejection was an Editor error. No source text, factual validation or collection limit changes. Experiment `c048a9d9-1919-48a2-acee-19a006a25c84` (`source-evidence-cost-6-context`) costs USD 0.0633166 for five cases (USD 0.1266332 doubled estimate), with 486,712 input and 48,006 output tokens, 50 reads, ten searches and 144.241 seconds. It passes all five scenarios and required facts, but Sziget lacks locality, venue and address. Research never inspects its travel route despite the generic route instruction and uses all three searches. Do not accept a scenario pass as equal additional completeness.

### Cost 7: selective navigation effort

Research and Editor use medium when the shared setting is low. Reader and all specialists, including Location and Tickets, remain low. Keep extraction, literal matching, input projections, collection limits and scorer revision 11 unchanged. The purpose is to recover useful navigation without restoring medium for every role. Experiment `8127e94a-7ffa-48f6-b2f8-2bf8219a3e29` costs USD 0.06215849 for five cases (USD 0.12431698 doubled estimate), with 525,588 input and 58,718 output tokens, 70 reads, 15 searches and 193.642 seconds. It recovers all Sziget place facts and all Roskilde expected facts. Four of five scenarios pass, required facts are 14/15 and additional facts 32/33. Wacken Location proposes a locality without enough source proof; Editor correctly rejects that whole place group, also losing the supported country. Do not weaken that approval boundary.

### Cost 8: selective place reasoning

Location now uses medium when the shared setting is low, as Research and Editor already do. Reader, General, Tickets, Classification and Links remain low. Only the place reasoning effort changes. Source access, evidence and scorer rules remain unchanged. Experiment `d65db479-bfe3-4532-8c40-c5351ba0dd92` (`source-evidence-cost-8-place`) costs USD 0.059978755 for five cases (USD 0.11995751 doubled estimate), with 460,859 input and 58,634 output tokens, 64 reads, 15 searches and 190.841 seconds. Four of five scenarios pass and all have no checked wrong facts. Wacken retains country. Sziget loses all new facts because Editor rejects the whole item solely for an incomplete previous-Edition classification. Required facts are 10/15 and additional facts 23/33; this refusal is not acceptable.

### Final cost verification

Clarify Editor rejection scope: reject the whole item only for a material Event identity or country conflict; reject an incomplete or unsupported optional proposal only in its own group. An omitted optional value is not a false claim. Keep immutable source checks, money rules and whole-field group decisions. Extract the Location model-config choice to a short helper to meet the existing lint complexity limit; behavior is unchanged.

Selected profile: medium Research, Location and Editor when shared effort is low; low Reader, General, Tickets, Classification and Links. All earlier literal quote encoding and compact model inputs remain. Type check and affected lint pass. The final two-repeat standard-tier experiment `6fff10e9-6762-4ed6-802c-02d95cb76d44` (`source-evidence-cost-final`) completes all ten attempts. Native measured model cost is USD 0.120927055, 30.0% below Cost 1 (USD 0.172747905). This meets the approximate USD 0.10–0.13 range, but remains 20.9% above the preferred USD 0.10. Wall time is 273.530 seconds; input/output tokens are 1,016,184 / 116,164, with 140 reads and 31 searches. External retrieval and geocoding bills are outside this model-cost estimate. Prompt-cache use affects the measured cost; one fixed batch does not establish production cost or broad quality equivalence.

Raw scorer revision 11 records 9/10 scenarios and 9/10 no-checked-errors. Its only wrong checks are Sziget repetition 1 address and the same address on its saved Edition: `Május 9. park, 1033`, with Budapest and HU in their separate fields. An independent fixed-source audit confirms these components against `travel.md`, which states `Május 9. park, Budapest, Hungary, 1033`. The check already accepts street-only form. Revision 12 adds this exact supported alias to the shared next/saved list; it does not add fuzzy matching or weaken date, country, identity, price or publication checks. No stored experiment or output is rewritten, and no model rerun is needed for this scorer-only correction.

Independent immutable-output replay under scorer revision 12 gives final scenario success 10/10, checked correctness 10/10, required completeness 100% (30/30) and macro additional completeness 96.875% (64/66). Cost 1 is unchanged under the same revision: 10/10, 10/10, 100% (30/30) and 92.7083% (62/66). The only absent final facts are Wacken locality in both repetitions. This sample shows no quality loss; it does not prove equivalent behavior on all sources.

All 783 tests pass. Final type check, affected lint, dependency, format and documentation checks pass. No OpenSpec work was done for these experiments. The user-owned `docs/change-workflow.md` edit remains untouched. The broad source-evidence implementation remains uncommitted; this cost result does not finish its separate fixture, cleanup or spec tasks. See the comparison for per-role costs and cache totals.


## Reader cache check

The user requested a check without Reader prompt caching. Disable it only on Reader requests with `prompt_cache_options: {mode: "explicit"}` and no breakpoints. The installed provider adapter supports this request field; the native HTTP test checks Reader and Research separately. Keep all role effort settings, prompts, source policy and scorer 12 unchanged. No OpenSpec work is added.

Standard-tier one-repeat experiment `9bc42054-7a97-46fc-a203-50bee0082362` (`source-evidence-reader-no-cache`) passes all five cases with no checked errors. Required facts are 15/15 and additional facts 32/33, macro 96.875%; only Wacken locality is absent. Actual five-attempt cost is USD 0.063246255. Twice that is USD 0.12649251, a ten-attempt estimate only. Reader has 30 calls, 105,207 ordinary input tokens, 20,986 output tokens and provider-reported cost USD 0.0210137. No cache reads or writes are recorded; all input and the cost match the plain input/output rate exactly. The native metric export was read only after process closure and the DuckDB store was closed immediately afterward.

A same-token calculation on the earlier final ten-attempt run gives USD 0.132019 with only Reader repriced without cache, versus USD 0.120927055 observed. Cost 1 on that same basis is USD 0.170790055. The saving is therefore 22.7% on this basis, not 30%. The earlier cache-assisted headline was not a no-cache cost claim. The live single trial and same-token calculation both remain above the preferred ten cents. See the comparison for rates, cache accounting and limits. Reader remains configured without prompt caching; no other role cache policy changes. Twenty provider integration tests, type check and affected lint pass.
