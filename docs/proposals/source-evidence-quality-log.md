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

## Cost experiment after reset, 2026-11-01

The worktree was restored to branch commit 23fd56c. The removed changes were backed up in `/tmp/eventroam-before-cost-experiments-20261101`; saved eval records remain available. Three sub-agents assessed shorter Reader boundary output, lower Research reasoning, and removal of the duplicate Editor output schema. The [comparison](source-evidence-eval-comparison.md#cost-experiment-after-reset-2026-11-01) records estimates, risks and measured results.

The fresh standard-tier, uncached-Reader baseline runs five main cases twice: USD 0.122234125, 9/10 passes, required facts 25/30 and additional facts 53/66. Sziget repeat 2 fails with a missing or unknown evidence reference. The prompt-only short-boundary Reader trial passes 10/10 but costs USD 0.126016145 and collects additional facts 55/66. Boundary use remains rare, so its intended savings are not established; the Reader prompt is restored.

The retained experiment removes only Research's automatic low-to-medium promotion. It costs USD 0.112733915 for ten attempts, 7.8% below the fresh baseline, with 10/10 passes, required facts 30/30 and additional facts 61/66. Research steps stay at 51; its cost falls 41.9% and output falls 63.6%. Reader remains v10 and uncached, Editor and Location retain medium effort, and no link ranker is present. All eight accessible attempts reach the specialists and Editor. Optional omissions are three Glastonbury social links, Wacken locality and Wacken base price. There are no checked wrong values. This sample does not establish stable perfect success or a quality gain caused solely by lower reasoning. The USD 0.10 target is still unmet. Affected tests and static/documentation checks pass; outstanding active-change tasks remain open.

## Research stopping experiment, 2026-11-01

Trial `5426351d-de57-4849-b4bd-d79ae04d96fb` adds code-derived bound-evidence topics to navigation results and a prompt rule against repeating an empty search for the same gap. The standard-tier, uncached-Reader main batch repeats all five cases twice on the same dataset and scorer as the retained Research-low baseline. Cost falls from USD 0.112733915 to USD 0.108512180 (3.7%); Research steps fall 51 to 47, searches 22 to 16, and input tokens 300,669 to 253,551. Research cost itself rises 6.4% with more cache-write and fewer cache-read tokens. Reader calls fall 59 to 54 and provide the largest saving.

The trial passes 9/10 scenarios with required facts 30/30 and additional facts 62/66. Sziget repeat 1 reads travel but loses the three location quotations during strict binding; locality, venue and address are absent. Roskilde repeat 1 has the correct source quote, but Tickets excludes the extra DKK 100 fee from its Smart Ticket amount and Editor approves it. The unchanged scorer records a wrong offer. These failures do not establish that early stopping caused them, but they prevent accepting this batch as a cost reduction without quality loss.

Restore Research v8 and remove the trial navigation field, stopping prompt and trial-only test. Keep the accepted low-effort setting, Reader v10 and disabled Reader caching. No scorer, fixture or validator changes. Trial code and patch are saved in `/tmp/eventroam-research-coverage-stop-trial-20261101`, and all ten outputs and native metrics remain in eval storage. During the trial, 23 focused tests and static checks pass; they do not override the model failure. See the [comparison](source-evidence-eval-comparison.md#research-stopping-experiment-2026-11-01) for the full measurements and limits.

## Editor surrounding-context experiment, 2026-11-01

Retain Editor v8: review the supplied quotations and inline context directly, and call `readEvidence` only for more surrounding text needed to assess a specific proposal. Code has checked unique literal source matches; Editor still checks meaning, Event, year and scope. The tool returns only text before and after the quotation, with source identity and URL. It requires positive context and retains cited-ID access, output limits and saved-file hash checks. The duplicate output schema, medium effort and all other roles stay unchanged.

Standard-tier main experiment `54ae84c5-65b8-4dfc-ac8f-2a5a64e8271a` repeats five cases twice with Reader caching disabled. Against the retained Research-low batch, Editor input falls 183,776 to 63,508 tokens, steps 20 to 9, tool calls 23 to 1, and cost USD 0.018289260 to USD 0.013651655 (25.4% less). Seven reviews need no tool call. The remaining call reads surrounding Roskilde contact-page text for a festival-address quotation. Editor output and reported reasoning increase, and cache reads decrease, so the input reduction is larger than the cost reduction.

Both batches pass 10/10 scenarios with no checked wrong values and required facts 30/30. Additional facts rise 61/66 to 65/66. The sole candidate omission is Sziget repeat 1 base price: Tickets omits the standard-pass handling fee from its variant terms, and Editor rejects the whole ticket group from the supplied evidence. Upstream variation prevents attributing the pooled completeness gain to Editor alone. No facts, expected values or scorer rules change.

Whole-run cost rises from USD 0.112733915 to USD 0.115000840 (2.0%). Reader calls rise 59 to 64, Research steps 51 to 52 and Location steps 13 to 16. Other roles add USD 0.00690453 and exceed the Editor saving. All eight accessible attempts reach Editor; no skipped work explains its reduction. Retain this as an Editor-stage optimization, not a measured whole-pipeline saving or proof of broad quality equivalence. The USD 0.10 target remains unmet. All 21 focused tests, type check, affected lint, formatting, documentation checks and OpenSpec validation pass. See the [comparison](source-evidence-eval-comparison.md#editor-surrounding-context-experiment-2026-11-01) for native usage, cache counts and limits. Remaining active-change tasks stay open.


## Minimal Research output, 2026-11-01

Research v9 removes successful-check explanations, completion summaries, empty evidence references, and question field/Edition keys. It retains check findings and sources, short unfinished causes, and distinct owner questions. Code copies unfinished check causes into report unresolved items, so the model does not state them twice. Specialist evidence and validation stay unchanged.

The first repeated main batch measures final Research output down 55.9%, total Research output down 39.2%, and Research cost down 22.0%. Quality is not preserved in that batch: 6/10 scenario passes, required facts 25/30, additional facts 55/66, and one checked wrong offer. Two failures expose missing report questions after removing model duplicates; the host fix retains those causes. Wacken has an unknown General evidence reference, and Roskilde accepts an installment offer without its handling fee. No factual scorer or reference guard was relaxed.

The repeated main check after the host fix passes both blocked-source cases and three accessible attempts. The remaining five attempts fail with provider HTTP 403 responses, so the final version has no complete quality comparison. Keep the implementation as requested, but do not claim quality preservation or the ten-cent target. See the [full comparison](source-evidence-eval-comparison.md#minimal-research-output-2026-11-01) for IDs, costs, failure details and limits.

## Smaller role inputs and outputs, 2026-11-01

Implement short self-contained Reader items, General-specific instructions and saved context, one native Editor decision schema, and Links omission notes only for material ambiguities. Keep full source text, nonempty context and qualifications, strict binding, fixed review coverage and reference validation. Native tests cover the short and contextual Reader variants, including null uncertainty; contextual metadata must precede the short variant in the union for the installed SDK path.

Main experiment `93d1a5b8-d60d-430f-81f8-24697dd2af82` requests five cases twice on standard tier with Reader caching disabled. All ten attempts stop on the API key's weekly spending limit before any successful model response. The provider states a reset at 2026-11-02 00:00 UTC. No billed token or cost observations are available. Do not treat this as a quality regression, a cost reduction or a completed comparison. See the [comparison](source-evidence-eval-comparison.md#smaller-role-inputs-and-outputs-2026-11-01) for the exact changes and remaining validation.

The requested one-repeat retry, `94dd41ef-ca1d-42ba-9179-dfb75777f98a`, completes all five scenarios on standard tier in 124.6 seconds. Reader caching remains disabled. Required facts are 15/15, additional facts 30/33, and no checked wrong values or model errors are recorded. Missing facts are Glastonbury historical year and country, and Wacken locality. Native usage gives estimated model cost USD 0.050291145, with 389,223 input tokens, 39,902 output tokens and 79 steps. The doubled cost estimate is USD 0.100582290, not a measured ten-attempt result. Dataset identity differs from the earlier baseline, and repeated validation remains open. See the [retry details](source-evidence-eval-comparison.md#single-retry).

## Native Mastra grep experiment, 2026-11-01

Editor v10 uses the unchanged built-in workspace grep instead of `readEvidence`. A read-only filesystem and a workspace hook retain cited-file access and source hash checks; the application does not implement search. The other role prompts, inference settings, fixtures and scorers stay unchanged.

One standard-tier main run, experiment `3bfdcd3f-1b9c-4f8a-8100-71306489d685`, passes 5/5 with no checked wrong values, required facts 15/15 and additional facts 31/33. Reader caching remains disabled. Editor calls grep once to check conflicting Sziget lineup years and dates, then approves the supported date proposal. The response includes three application-provenance matches, so native file search adds some noise. Sziget base price and Wacken locality remain absent.

Against the preceding single run, Editor cost rises from USD 0.005207075 to USD 0.006236015 (19.8%) and steps rise from four to five. Whole-run cost rises from USD 0.050291145 to USD 0.051433835 (2.3%). The baseline made zero source-tool calls. Upstream extraction and navigation differ, so the additional Glastonbury facts do not establish a grep quality gain. No saving is shown. The owner selected native grep after this comparison. Retain it without a cost or quality improvement claim; see the [comparison](source-evidence-eval-comparison.md#native-mastra-grep-experiment-2026-11-01) for usage, actual search and limits. All 33 focused tests and applicable static, documentation and OpenSpec checks pass.

## Regression audit, 2026-11-02

The full standard-tier run uses `openai/gpt-6-luna`, one attempt per case and scorer revision 13. Shared reasoning is low; Editor and Location use medium. Reader prompt caching is disabled. Tracing is enabled. All 45 attempts finish, with 15 passes in 432.2 seconds:

| Group | Passed | Experiment |
| --- | --- | --- |
| Pipeline | 2/25 | `0546d8e4-fe24-43ba-a5eb-34a6e727877e` |
| Editor | 5/7 | `754d0af2-7c1d-4094-98e7-b2d36d2ce081` |
| Location | 8/13 | `3fd3ff46-d6ea-4ce5-96a8-d9bd9294d11a` |

Three specialist reviews compare the saved reports, source artifacts, case inputs, prompts and contracts. They identify these clear eval errors, corrected in scorer revision 14:

- Temporal checks demand a repeated proposal for dates already correct in the selected saved Edition. Resolve omitted dates and year from that exact selected key. An explicit wrong proposal or clear still fails. Required mutations still need dry-run changes.
- The historical venue check demands `set` for saved `River Grounds`. Accept a successful Location `keep` for the selected historical target. Missing or failed Location does not pass.
- The homonym case demands another `set` for saved country GB. Keep its required website and price changes, and strengthen country preservation to reject both another country and a clear.
- The refusal helper fails to unwrap General's provider result and demands empty source summaries. Inspect the real domain decision and allow retained source descriptions. Keep exact status, no-write and technical-failure checks.
- The recovered-website Editor case has no UK search fixture and requires Research success although every captured role has empty check findings. The first repair adds the discovery response and requires a completed Editor review, a non-failed workflow and the actual UK website mutation. Research and Reader still run at that point. The later fixed-input implementation below replaces that variable preparation. No verified findings are fabricated.
- Valid locality queries with administrative areas have no exact match in two Location fixtures. Add documented synthetic aliases for Cascais and León, using the existing locality responses. Do not return a venue point for a city query. Remove one duplicate León venue request.

Before the owner's further decisions below, rescoring the 42 responses whose inputs did not change raises their passes from 15 to 16. Only `source-stale-language-other-programme` changes from fail to pass; nine failed check conditions are removed across six cases. Other cases still fail their remaining checks. This is saved-output rescoring, not a new model run. Original results are retained.

The first fresh fixture check runs recovered website and two Location cases on standard tier. Editor experiment `c0ec756d-8002-444e-945c-3a34f9aac750` still fails: the UK evidence is now collected, but Editor treats the wrong saved Australian URL as decisive Event identity and rejects the supported UK replacement. Location experiment `4450f113-ec3c-44e1-92d9-9dbdaf9519ee` passes Cascais and fails León. Two further valid León query aliases are then added. Check `61421a95-404c-4d8b-9f14-0b242ccd185f` obtains the city point but misses the venue query fixture. After that alias is supplied, `6fc2fc3c-7e39-4f81-a90e-5a5dfdaa64d6` still stops at the city point without querying the named venue. Keep the strict venue completeness check. These are small diagnostic runs on different input revisions, not a new full-suite score.

The main Research failure has a concrete information boundary. Reader artifacts retain correct venue/address and ticket quotations, but [`collection.compact`](../../src/ingestion/evidence/collection.ts) supplies navigation with an overview, topics, years and leads. The short overview can omit an address or an explicit statement that no further pages exist. Research then treats those details as absent from the page, guesses routes or searches again, and leaves checks unfinished. Thus most missing `/travel` or `/venue` fixtures in these small scenarios are symptoms of unnecessary exploration. Do not invent pages or remove search limits to hide them. The retained main experiment with additional navigation topics did not establish quality preservation; it is not evidence for accepting that earlier trial.

Reader also puts ordinary absent optional facts in `limitations`. The recovered UK page says no participant estimate is published; Reader records this as a limitation even though its prompt forbids that use. Code marks the page processing limited, and the report stays partial. This is a separate completion cause from missing information in the overview.

Other real failures remain checked: General combines separate October weekends into one date range, clears a saved attendance estimate without contradictory evidence, or returns identity uncertainty for an ambiguous Edition despite known Event identity. The original Tickets contract rejects an empty offer list in eight cases, including explicitly free admission. Classification reuse can name an invalid earlier Edition. Editor rejects supported observed offers because other ticket pages are blocked. Location can miss a locality refinement after a venue move or select a historical point with `select` instead of `reusePrevious`.

The owner accepted three audit choices:

- Allow empty offers for explicitly supported free full-programme admission. Paid or unknown admission still needs observed offers; a free concession does not establish free general admission. Keep evidence and Editor approval requirements.
- Freeze source evidence for Editor cases. Research and Reader must not change their test input corpus between attempts.
- Retain cemetery correction coverage with explicit, labelled synthetic evidence that the saved point is a known mapping error. Do not infer that error from a nearby reverse object.

These choices are implemented. Tickets v7 permits an empty offer list only with `basePrice.kind: free`; paid and unknown blocks still require observed offers. Editor v11 recognizes that supported free block. Existing quotation binding, evidence references and Editor approval remain required. Tests cover invalid paid or unknown empty blocks, missing support and the accepted block through catalog writing.

All seven Editor cases use schema-version-3 fixed inputs: ordered page reads, literal Reader output, collection result and domain proposals with explicit citations. The normal collector still creates immutable source artifacts and binds quotations. Research, Reader and captured specialists make no model calls. Editor and eligible Location execution remain live. Preflight rejects invalid source order, duplicate destinations, missing role results and invalid quotations or citations. A final preflight-only hardening followed the run snapshot; it changes neither supplied results nor runtime adapters, and all current fixtures pass it.

The affected standard-tier check uses the same model and reasoning settings, with one attempt per selected case:

| Group | Passed | Seconds | Experiment |
| --- | --- | --- | --- |
| Pipeline | 0/8 | 97.5 | `e4d848d4-b74f-459a-a696-c87f9bb07bf5` |
| Editor | 4/7 | 67.2 | `c433eed4-0999-4597-8684-71563387a428` |
| Location | 1/3 | 10.8 | `eb766038-4632-4864-8015-0586f99cb85d` |

All 18 attempts return scored outputs. None has the former empty-offer schema error. Pipeline cases still fail mainly on unfinished Research, unnecessary searches, invalid classification reuse or failure to recover Event identity. Cemetery correction passes with explicit error evidence. León obtains a valid city response but stops before querying the named venue; its venue completeness failure remains.

Two further fixture defects appear in this check. Cascais asks the valid query `Cascais, Portugal`, which lacks a declared response; add a labelled alias to the existing locality result. The day-ticket fixed Reader input lacks the full-festival quotation because the original literal binder rejected it. The source itself states all eight days at DKK 2,650. Repair that fixed quotation and its explicit Tickets citation from the unchanged source, with provenance; retain the required base price. These repairs do not establish agent improvements. Recovered website and unknown currency remain Editor failures with fixed valid evidence: the former treats the wrong saved URL as decisive identity, and the latter rejects observed offers because further categories are unavailable.

Both repaired cases pass a fresh one-attempt standard-tier check: Editor day-ticket experiment `1857f4f6-2d44-4b3d-b06a-cf5ed2eb04bf` and Location several-venues experiment `9fd202a3-f7c2-4349-a8bd-b411b5c3ce72`. This is a two-case fixture check, not a full-suite rerun or a quality comparison with the original variable Editor inputs.

Static checks pass: type check, affected lint, dependency check, formatting, documentation checks and strict OpenSpec validation (24/24). All 50 case inputs load, including the seven fixed Editor cases. The full unit run passes 794/795 tests; a tracing persistence assertion fails. The tracing file passes all 32 tests on a separate retry. No unrelated tracing change is made.

The owner then selected compact page coverage for the next Research experiment: name collected information and explicit source statements of nonpublication. Quotations remain the basis for updates. The owner also selected partial Research with a failed catalog outcome after useful collection and General's Event identity refusal. Scorer revision 15 reflects that status choice; wrong source exploration and missing identity guidance remain failed checks. The experiment below measures the coverage change with that scorer in both runs.

The following coverage choice remains open:

- **Candidate discrimination:** the bridge and cemetery completion passes do not prove rejection of their unused decoy candidates. Add a focused candidate scenario if that distinction must be measured.

Fixture repair in task 6.1 and the controlled comparison in task 7.2 remain open. This audit does not establish a new full-suite pass count or a production quality gain.

## Page coverage experiment, 2026-11-02

The owner selected two short page-coverage lists for Research. Reader v12 returns `coverage.found` and `coverage.notPublished`; Research v10 uses them for navigation. The lists have at most nine and six entries, each at most 160 characters. Only explicit source statements can enter `notPublished`. Source silence remains unknown. Coverage cannot support a catalog change or remove extraction limitations. Literal evidence, frozen source storage, mandatory checks and tool limits stay in use. No model call is added.

Both runs use `openai/gpt-6-luna`, standard tier, one attempt per case, shared low effort, medium Editor and Location, and disabled Reader prompt caching. They use scorer revision 15. The selection is all five main cases and nine affected pipeline regressions. The latter cover ordinary missing optional data, unknown, inaccessible and wrong official sources, narrow current refresh and Event identity refusal. This is a focused experiment, not a full regression run.

The coarse dataset hashes differ because the seven unselected fixed Editor inputs need the new required Reader coverage field. Before/after source snapshots show no change to selected checks, shared eval execution or scoring code. Each selected saved case input is also compared in full. Results from the older audit use different input and scorer revisions and are not a baseline for this experiment.

The after run also makes the selected partial status explicit when General refuses Event identity after usable collection, even if all collection checks were verified. This changes report assembly only. It adds no agent work. A workflow test covers that case and verifies empty operations, receipts, changes and references; the existing no-usable-source test retains failed Research.

| Measurement | Main before | Main after | Pipeline before | Pipeline after |
| --- | --- | --- | --- | --- |
| Cases passed | 4/5 | 5/5 | 0/9 | 1/9 |
| Required facts | 10/15 | 15/15 | Not scored | Not scored |
| Additional facts | 21/33 | 30/33 | Not scored | Not scored |
| Research steps | 25 | 20 | 37 | 24 |
| Research input tokens | 141,529 | 95,033 | 66,178 | 43,205 |
| Research cache-read tokens | 106,640 | 62,104 | 48,200 | 25,934 |
| Research output tokens | 3,763 | 3,009 | 5,600 | 3,524 |
| Research estimated model cost, USD | 0.00730715 | 0.006240165 | 0.005526475 | 0.004178415 |
| Reader calls | 31 | 28 | 11 | 9 |
| Reader estimated model cost, USD | 0.0213315 | 0.0214248 | 0.0029573 | 0.0028649 |
| Page reads | 52 | 41 | 36 | 19 |
| Searches | 7 | 5 | 8 | 8 |
| All model steps, report budget | 75 | 75 | 105 | 80 |
| All estimated model cost, USD | 0.044201525 | 0.05113772 | 0.028712665 | 0.02276072 |

Experiments are main before `c5ef5c4d-613b-4ea9-a1e2-f1e3f07e0506`, main after `af9a0556-582c-4b94-bc77-3e487cfeca81`, pipeline before `517a5389-4a7d-46f4-97cc-67a200ddddba` and pipeline after `14684095-6ce1-426e-8f90-cfe3e62ff7fa`. Each has a saved output for every attempt. Steps use completed model-step log events for Research and Reader, and the report counter for all roles. Costs and token counts use native metric events, including cached input. Native agent totals can aggregate several Research steps; their row count is not a step count. These are model cost estimates, not a provider invoice or a full external-service bill.

Research input falls 32.9% in main and 34.7% in pipeline. Its estimated cost falls 14.6% and 24.4%. Much of the removed input was cached: the main Research cache-read share falls from 75.3% to 65.3%, while input without a cache read falls only from 34,889 to 32,929 tokens. Reader cost in main stays almost unchanged despite three fewer calls; large source pages remain and the coverage output adds text.

The main total rises 15.7% because the control Roskilde attempt fails before interpretation on `reader: evidence.3.quote.start:too_big`. The after attempt reaches specialists, Location and Editor and passes. Do not attribute that recovery to coverage or compare the incomplete control as equivalent completed work. Excluding Roskilde, the same four main cases cost USD 0.03551773 before and USD 0.033605305 after, a 5.4% reduction. However, Sziget loses its venue and address: the control reads the travel page and binds its explicit venue/address quote; the after attempt does not read that page. Its Research steps fall from six to three, but additional facts fall from 8/8 to 6/8. Wacken still lacks locality. Thus this experiment does not establish cost reduction with equal fact completeness. Doubling the after main cost gives USD 0.10227544 for ten attempts; that is a projection from five, not a measured two-repeat result.

Only `search-inaccessible-official` passes in the affected pipeline selection. Research now finishes in one step and avoids extra reads for `search-no-optional-field` and `narrow-current-changed`, but other roles or completion findings still fail their checks. The missing-optional case still asks for a travel page after the homepage supplies venue and address. The noncomparable case still asks for a ticket overview after explicit free admission. Reader still sometimes puts ordinary missing data in `limitations`. Current refresh still explores a replacement website after an identity contradiction instead of stopping with full-refresh guidance. Wrong-site cases can stop on the wrong identity and skip later roles; part of their lower total cost comes from failed work. Keep these failures visible and do not accept the pipeline cost reduction as preserved quality.

The accepted identity-refusal status check passes in both runs, while its separate source-policy and identity-guidance conditions fail. No catalog writes occur in that refusal. Focused application tests pass 52/52; all 50 eval inputs load. Type check, affected lint, formatting, documentation checks and strict OpenSpec validation pass. This experiment does not replace the earlier full-test result or the remaining full-suite and repeated-comparison work.

## Full-suite stabilization, 2026-11-02

The owner requested at least 90% passing scenarios and a separate list of questions for later discussion. Keep every case in the measured set. Do not lower source, scope, preservation or publication requirements to reach the target. A single passing run does not establish stability; repeat the full set on the same code and eval revision.

The clean baseline is commit `0180a5eecfd9c9981f7fb708d920676c575ea4fb`. All eight roles use `openai/gpt-6-luna`, standard tier, configured low reasoning, medium Editor and Location, and no Reader prompt cache. One attempt per case returned all 50 outputs in about nine minutes. There were no task-level errors; domain validation failures remain failed scenarios.

| Group               | Passed | Experiment                             |
| ------------------- | ------ | -------------------------------------- |
| Main                | 4/5    | `d28cb9ae-b6cf-4a81-a026-93728ada5571` |
| Pipeline regression | 1/25   | `08f3699f-5538-43f6-9974-2243a7adba92` |
| Editor regression   | 5/7    | `2ecde9b5-c432-484e-afd7-739756adb577` |
| Location regression | 10/13  | `830d13da-e88e-48da-8154-71bf7f5a956b` |

Main has no wrong checked values, but Wacken lacks current classification. Editor approves that classification; its unnecessary `reuseFrom` ties it to the rejected previous classification, so dependency validation removes it. Sziget also lacks the additional venue and address facts.

Traces show these separate causes:

- Editor has no `currentDate` input. It uses 3 October for size cases fixed at 23 September and 31 October, and rejects valid temporal targets. That date matches seed timestamps, but the trace does not prove why the model chose it.
- All 25 pipeline reports are partial. Eight non-failed workflows fail only the completion-status check. Research and specialists treat explicit nonpublication, missing optional details or an absent current target as unfinished work. Two other status-only cases have real validation failures, so they are not harmless status differences.
- Tickets and Editor confuse the observed offer list with a complete inaccessible checkout. Limited passes and admission/stay packages are lost, or all supported offers are rejected because unchecked categories are unavailable.
- Classification can propose self-reuse. Links can propose an Event URL action when current scope forbids Event fields. Location can select the correct saved point instead of returning `keep`, which violates the point-action contract.
- Wrong-site cases anchor on a bad saved URL. One Reader `editionClues` interpretation incorrectly merges distinct weekends despite retaining the literal source. Location also misses venue-first and new-locality fallback queries.

The existing refresh-scope spec resolves temporal ambiguity: keep the uncertain Edition slot null and return partial findings. It is not an Event identity refusal. Preserve that distinction in General; do not change the ambiguity eval to accept a failed identity decision.

### Questions raised during stabilization

1. The unfinished-history eval requires the exact `historic-weekend` key on a question even when the blocked archive cannot establish that temporal target. Research questions intentionally have no Edition keys. Should the check require a historical question and protected history instead of that key? Keep the existing expectation until this is decided.
2. Search-policy fixtures require at most one discovery query. This fits sources that explicitly publish all available details. Should that bound also apply to real sources with unresolved publication-required country information? Do not add one global search limit to make these cases pass.
3. The León replay matches exact query strings. A translated administrative area gives simulated `unavailable`, not a real provider failure. Should it accept more declared query aliases? First fix the agent's venue-first strategy; do not add every observed exploratory query as an alias.
4. The original main guidance accepts both `announced` and `scheduled`. A later choice can make this deterministic; it is outside this stabilization task.

The baseline is one stochastic run, not evidence that the last cleanup caused these failures. Before push, rescoring 50 saved real outputs produced the same 98 scores before and after that cleanup.

The first repair run (`stabilize-1`) passes Main 3/5, Pipeline 9/25, Editor 7/7 and Location 11/13. Its fixed Editor cases now accept recovered identity and known offers with an inaccessible checkout. The full workflow still fails in other places, so this is not a stability result. Wacken loses price quotations because repeated closing boundaries cannot bind. Sziget returns a quote boundary longer than 250 characters and fails Reader validation. Several remaining partial statuses arise from Reader scope comments or Research treating distinct programme dates as a conflict.

Further inspection finds two clear contract defects:

- The implementation disables all discovery in current scope. The source-access spec permits targeted discovery for a material date conflict or a missing publication-required Edition fact; it forbids current website recovery after an identity contradiction. Separate these rules. Give Research the bound saved country/locality clues, but do not send navigation instructions to Reader.
- The partial-ticket regression projects the native `replacePriceBlock` operation, which uses `minMinor` and `maxMinor`, but expects the earlier model shape's `minAmount` and `maxAmount`. Require the same EUR 110 price as 11000 minor units at that boundary. Keep the offer, currency, full-programme coverage and catalog-mutation checks.

The next repair keeps completion findings, strict quotation matching, temporal ambiguity checks and all catalog guards. It clarifies short literal quotations, unique bounded quote ends, actual extraction problems rather than page silence, preserved saved attendance without a specific retraction, current rather than archived booking URLs, and locality precision for a supported saved settlement point.

The second full repair run (`stabilize-2`) passes Main 5/5, Pipeline 19/25, Editor 6/7 and Location 12/13: 42/50 in total. Main still lacks some additional place details. Its pass count does not mean every additional fact was collected. Pipeline failures include five collection/status problems and one incorrect unchanged-date check. The latter requires a proposal even though the confirmed saved January dates already match. Use the existing selected-date helper, and retain the same date values, independent-source search and read-order checks.

The next trial promotes only Research from configured low reasoning to medium; General and the three fact specialists stay low, Reader stays low, and Editor and Location stay medium. It also explains that a coverage label need not repeat every extracted date or price. Explicit nonpublication completes the relevant collection check. Social-link collection does not require proof that no account exists. Reader uses short coverage labels with the existing 160-character limit. The limit and exact quote binding remain unchanged. Location must use `reusePrevious`, never `select`, for a historical point, including correction of a bad target point. Editor can approve removal of a saved venue address identified as an organiser office when no source also establishes it as the festival site; a replacement address is not required.

The full unit run finds an obsolete scope-test error code after the new Links output boundary rejects forbidden Event changes earlier. Update that expectation while retaining failure, no-write and CLI/Studio equivalence checks. A separate abort tracing test advances asynchronous fake time through storage cleanup and triggers its cleanup timeout before the real DuckDB work finishes. Advance the abort timer synchronously, then restore real time before asynchronous cleanup. The tracing file then passes all 32 tests. Do not change production cleanup deadlines or remove metric-persistence assertions.

The two-repeat focused trial (`stabilize-3`) returns all 16 outputs: Pipeline 8/12, Editor 1/2 and Location 2/2. Medium Research alone does not remove collection errors. The remaining failures show a more specific contract mismatch: Research requires locality/address although publication requires country only. Keep useful travel/contact leads, but do not require optional place facts after the country is established and useful leads are exhausted. Dated programme-status or attendance passages complete historical collection; General still decides realization. Reader must retain an explicit all-available-information statement and any conflict correction in its coverage. General must assess a later independent confirmation rather than keeping an earlier source's unresolved label as a permanent veto. Location and Editor must both apply the same office-address correction rule.

The next measurement (`stabilize-4`) is the full 50-case set with two attempts per case on unchanged runtime and eval code. It keeps the Research medium setting and all other model, tier, scope and evidence guards. The full unit suite passes 796/796 with four workers after the tracing-timer repair.


The full `stabilize-4` measurement returns all 100 outputs. Each repeat passes 44/50 (88%): Main 5/5 in both; Pipeline 22/25 and 20/25; Editor 6/7 and 7/7; Location 11/13 and 12/13. This does not meet the stability target. The experiments are Main `486c78d3-a247-40b3-bc9c-bf17efe4f4dc`, Pipeline `e2fa296b-8532-4401-9f76-ffb4539c378a`, Editor `a8554035-5ff4-4952-9217-61907f49733c`, and Location `550ced79-e1e6-4064-b9da-f4b24e20776f`.

The next repair keeps the same checks and source inputs:

- Reader must retain a literal Event name, including a heading when the body does not repeat it. An overview cannot establish identity. Do not repeat a long identity paragraph as context for self-contained dated facts or paraphrase that context. The failing size case adds a word to the shared context and loses several otherwise useful passages at binding.
- General and Editor must distinguish evidence of realization from evidence of unique attendance. Reported actual gate admissions establish that a past dated programme took place, even when repeated entries cannot support a participant estimate.
- Editor must judge Event identity separately from Edition selection. An ambiguous null Edition does not invalidate the established Event. Supported observed offers remain usable when other checkout categories are inaccessible. Unknown current availability does not require copying an unchecked saved state.
- Links must still set a verified official website when the same URL is saved as unofficial or in another kind. Only a URL already official in the assigned slot needs no action.
- Research must stop identity recovery after reading the linked official site that confirms the requested Event. Further description or identity confirmation does not justify another search.
- Location must retain an unexplained material difference between official venue coordinates and a saved point as an unresolved coordinate question, even when the official point takes priority. The strict venue-query check remains in use.

Token and cost exports need care. Timestamp-only metric pagination can repeat rows across pages and miss others. The stabilization report uses native metric aggregates filtered by experiment or trace IDs, not sums of paginated rows. Cost adds estimated input and output cost; cache-read tokens are a subset of input. These are model estimates, not invoices or external-service charges.

For the same six Pipeline cases, `stabilize-2` has six attempts and the focused `stabilize-3` has twelve. Mean Research input falls from 6,274 to 5,416 tokens; output rises from 494 to 955; reasoning output rises from 200 to 731; steps fall from 3.17 to 2.50. Estimated Research cost per attempt rises from USD 0.000443499 to USD 0.000688679. The prompt also changes, so this comparison does not isolate reasoning effort. Medium effort alone did not establish stability. The full `stabilize-4` Main measurement costs USD 0.123244585 for ten attempts, including USD 0.0512868 for Reader and USD 0.020018725 for Research. Its required case passes do not establish complete additional facts.


The `stabilize-5` Main result is 4/5 and 5/5. The failed Roskilde attempt keeps the instalment terms “five monthly instalments of DKK 524, plus a DKK 100 fee” but omits a numeric offer amount. The unchanged check accepts either the displayed DKK 524 instalment or DKK 2,720 total. This is a missing normalized price, not an incorrect base price. Both repeats retain all checked required Main facts. Additional place and price facts still have gaps. In Wacken's first repeat, Reader changes a German word in both Louder quotations; literal binding rejects those items, and the full-programme base price is absent. The second repeat retains it. The strict binder is not relaxed. Sziget also misses venue/address evidence, and one repeat misses locality. A passing scenario score does not establish full extraction recall or complete historical selection.


### Final repeated measurement

`stabilize-5` runs the complete unchanged 50-case set twice on standard tier. All 100 attempts return scored outputs. Repeat 1 passes 47/50 (94%); repeat 2 passes 48/50 (96%). The measured total is 95/100. Both repeats meet the owner's 90% target. Runtime and eval code stay unchanged throughout this measurement. The CLI exits 1 because five scenarios still fail; it does not report task or storage failure.

| Group | Repeat 1 | Repeat 2 | Experiment |
| --- | --- | --- | --- |
| main/pipeline | 4/5 | 5/5 | `f1baccce-8d59-45f2-be85-c948322ba512` |
| regression/pipeline | 23/25 | 23/25 | `709ca952-4b9c-4458-8380-81a1648cc37d` |
| regression/editor | 7/7 | 7/7 | `47d22b81-6f9c-4e76-bd8b-ca1a8d272a09` |
| regression/location | 13/13 | 13/13 | `0c2e2329-ff30-4789-9edd-a17f07361615` |

The five remaining failed attempts are:

- `roskilde #1`: the observed instalment has supported terms but no numeric amount. Its full-festival base price is correct.
- `narrow-current-partial-tickets #1`: Tickets adds a Student placeholder from a category whose actual offer details are behind login. Editor accepts it because no price is asserted. The case still rejects that unsupported offer; the Regular EUR 110 offer and base price are correct.
- `narrow-current-reuse #1`: Research leaves classification collection unfinished because the new announcement does not repeat genre names, despite source-backed programme continuity and a successful preserved classification.
- `source-homonym-wrong-saved-website #2`: Research leaves description collection unfinished because it wants a broader description. The correct official website and source-backed Event update are accepted.
- `narrow-current-changed #2`: General returns uncertain identity despite receiving both the Event-name heading and the same source's Lisbon, Portugal announcement. No Edition is written. This is an interpretation failure, not a missing Reader quotation.

Main retains 30/30 checked required facts and 58/66 additional facts. Its remaining place and price gaps above stay visible. This result measures scenario stability; it does not establish complete extraction recall, full historical selection or quality equivalence for every optional fact.

All roles use `openai/gpt-6-luna`. Research, Editor and Location use medium effort; Reader, General, Tickets, Classification and Links use low. Reader prompt caching stays disabled; native cache-read aggregates are zero. Other roles keep provider caching. No retry or correction loop is added. Source binding, scope checks, tool allowances and the frozen corpus remain in force. Versions are Research v15, Reader v17, General v13, Tickets v9, Classification v6, Links v8, Editor v15 and Location v19.

The ten Main attempts cost an estimated USD 0.126707225. All 100 attempts cost USD 0.33971439; fixed Editor cases do not pay for Research or Reader. The Main cost is close to 13 cents and still above the preferred 10-cent target. The following native aggregates cover those ten Main attempts. Input includes cache reads; reasoning is part of output. Steps are model-step spans, including tool steps, not agent-run counts.

| Role | Input tokens | Cache-read tokens | Output tokens | Reasoning tokens | Steps | Estimated USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reader | 294,362 | 0 | 48,499 | 5,308 | 65 | 0.053685700 |
| Research | 294,148 | 224,677 | 21,266 | 15,210 | 45 | 0.021560270 |
| General | 50,002 | 18,186 | 8,666 | 2,273 | 8 | 0.008491260 |
| Tickets | 31,043 | 6,936 | 4,548 | 1,384 | 6 | 0.005356285 |
| Classification | 33,216 | 0 | 2,504 | 837 | 8 | 0.005403400 |
| Links | 70,951 | 9,958 | 4,286 | 901 | 8 | 0.009866105 |
| Location | 108,261 | 68,432 | 8,856 | 5,602 | 13 | 0.010089970 |
| Editor | 62,198 | 10,816 | 11,448 | 6,820 | 9 | 0.012254235 |

After the final prompt changes, all 796 unit tests pass with default workers. Type check, affected lint and formatting pass. Evidence, Location and tracing checks retain their strict assertions. Documentation checks, dependency checks and strict OpenSpec validation pass. The final edits repair two eval expectations without changing their required facts: native minor-unit prices and already-correct selected dates. All other assertions stay in force. No case is removed or excluded, and no disputed fixture decision is applied.

The four questions above were later resolved by the owner; see the follow-up decisions below. A further cost choice is whether to test low Research effort again with these corrected prompts. The present comparison changes both effort and prompt text, so it does not isolate the medium-effort benefit. Keep that later trial separate from the measured stability result.

### Owner follow-up decisions, 2026-11-02

The owner resolved the four earlier questions:

1. The unfinished-history question does not need the exact saved Edition key. Require historical context and preserve the unchecked historical record.
2. Discovery depends on the unresolved permitted need within the shared budget. Keep existing zero/one-query assertions where the synthetic sources suffice; do not impose that bound on every source.
3. Geocoding replay uses general query normalization rather than a growing alias list. Exact requests take priority; normalized forward matches retain country filters and place qualifiers. Ambiguous responses stay unavailable. Normalization covers case, accents, punctuation, word order and country names in five languages, not arbitrary translations of place names.
4. A supported announcement with complete programme dates uses scheduled, including provisional dates. Date certainty stays separate; explicit cancellation or postponement takes priority. Main no longer accepts announced as an alternative for its dated announcements.

Scorer revision 16 identifies these follow-up changes. The measured stabilization scores above belong to revision 15 and are not a measurement of the changed prompts or checks. The separate low-versus-medium Research experiment remains open.

Follow-up verification uses no model calls. All 50 cases load. All 89 exact geocoding requests retain their recorded responses; three normalized variants match; five country/place/reverse mismatches and conflicting normalized responses remain unavailable. An exact recorded failure keeps priority. Saved unfinished-history outputs pass without an Edition key, while an unrelated ticket question and an attempted historical mutation fail. Rescoring ten saved Main outputs under revision 16 additionally rejects Sziget repeat 1 for announced despite confirmed dates; this is a stricter-rule result, not a fresh model run. Original experiment scores remain unchanged. The 27 affected unit tests, type check, affected ESLint, documentation and OpenSpec checks pass. Changed prompts still need a fresh model evaluation before claiming new scenario stability.
