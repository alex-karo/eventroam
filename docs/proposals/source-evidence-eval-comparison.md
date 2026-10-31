---
type: Research
title: Source evidence ingestion eval comparison
description: Preliminary main eval comparison before and during source evidence ingestion implementation.
status: draft
tags: [ingestion, evals]
---

# Source evidence ingestion eval comparison

## Reader prompt cache disabled

The later user check disables prompt caching only for Reader. OpenRouter documents `prompt_cache_options: {mode: "explicit"}` with no content-block breakpoints as the no-cache request form for GPT-5.6 and later. The installed OpenRouter adapter passes this field to the request body. A native HTTP test verifies it for Reader and verifies its absence for Research. Other role settings and all prompts remain unchanged. See [OpenRouter prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching#disabling-prompt-caching).

One-repeat standard-tier experiment `9bc42054-7a97-46fc-a203-50bee0082362` (`source-evidence-reader-no-cache`) completes all five cases and exits 0. Its actual model cost is **USD 0.063246255 for five attempts**. Twice this is **USD 0.12649251**, an estimate for ten, not a measured ten-attempt batch. Wall time is 195.433 seconds. Quality under unchanged scorer 12 is 5/5 scenarios, 5/5 no checked errors, required 15/15 and additional 32/33 (96.875% macro). Only Wacken locality is absent, as in the earlier final run.

Reader makes 30 calls. Its 105,207 input tokens are all recorded as ordinary text; no cache-read or cache-write tokens are recorded. Its 20,986 output tokens and provider-reported USD 0.0210137 cost match exactly the plain rates of USD 0.10 per million input tokens and USD 0.50 per million output tokens. This verifies no cache charge or discount, rather than treating absent cache metrics alone as proof of zero. The pricing snapshot comes from [OpenRouter model data](https://openrouter.ai/api/v1/models); no request reaches the 272,000-token price override.

To separate caching from different model choices, the table below reprices only Reader in the saved ten-attempt runs using those same ordinary input/output rates. Other roles retain their original measured costs. These are calculated comparisons on immutable token counts, not new model runs.

| Ten-attempt run | Observed total | Total with Reader repriced without cache | Reader observed → without cache |
| --- | ---: | ---: | ---: |
| Cost 1 | USD 0.172747905 | USD 0.170790055 | USD 0.06132545 → USD 0.0593676 |
| Earlier final | USD 0.120927055 | USD 0.132019 | USD 0.035252955 → USD 0.0463449 |

On this same-token comparison, the earlier final costs **USD 0.132019**, not USD 0.120927055, with Reader cache disabled. Its reduction from Cost 1 on the same basis is **22.7%**, rather than the observed 30.0%. The new live five-case trial suggests about 12.65 cents per ten, while the earlier fixed ten-attempt token counts give 13.20 cents. Both remain above the preferred 10 cents. Navigation, output and other-role cache use can change between runs; the new trial is not evidence that removing Reader cache alone changes the total by the difference between these two batches. Reader remains configured without prompt caching. External source and geocoding bills remain outside all model-cost figures.

Verification: 20 provider integration tests, type check and affected lint pass. Snapshots: `/tmp/eventroam-reader-no-cache-metrics.json`, `/tmp/eventroam-reader-no-cache-role-summary.json`, `/tmp/eventroam-reader-no-cache-results.json` and `/tmp/eventroam-reader-no-cache-pricing.json`. Original experiment records remain unchanged.

## Final cost result: measured ten-attempt batch

The final batch costs **USD 0.120927055 for all ten attempts**, 30.0% less than Cost 1. This meets the accepted USD 0.10–0.13 range. It is 20.9% above the preferred USD 0.10 target and does not meet an exact USD 0.10 limit. With the source-backed address correction applied equally, all ten scenarios pass, all required facts are correct, additional completeness rises from 92.7% to 96.9%, and no checked errors occur. Cost remains 73.2% above the original baseline. This result does not complete the remaining OpenSpec or regression work.

Experiment `6fff10e9-6762-4ed6-802c-02d95cb76d44`, label `source-evidence-cost-final`, uses five fixed main cases with two repetitions, `openai/gpt-6-luna`, and standard service tier. The process exits 1 under stored scorer 11. A pure scorer 12 replay uses the stored before/after catalogs, report and calls; it makes no new model calls and does not modify either experiment. Cost 1 (`1c548390-e4f3-40c0-928b-1972d3c795f8`) is replayed with the same scorer 12 and remains unchanged. Historical-ticket exclusions and the baseline refusal-contract caveats below still apply.

Research, Editor and Location use medium reasoning. Reader, General, Tickets, Classification and Links use low reasoning. Prompt versions are Research `source-navigation-v7`, Reader `source-reader-v10`, General `general-facts-v8`, Tickets `current-tickets-v6`, Classification `edition-classification-v5`, Links `public-links-v4`, Editor `proposal-review-v7`, and Location `catalog-location-v14`. The stored default effort is low; the three role overrides are material to this result. Dataset revision is `34e454c81b3f1f38ff31bf0f01e5bf132819d53e3bfaab9f4edae9109b1b82cd`. Saved Git metadata is still the dirty planning revision and does not archive the measured source files.

| Measure | Original baseline, shared scope | Cost 1, scorer 12 replay | Final, stored scorer 11 | Final, scorer 12 replay |
| --- | --- | --- | --- | --- |
| Scenario success | 9/10 | 10/10 | 9/10 | 10/10 |
| No checked errors | 10/10 | 10/10 | 9/10 | 10/10 |
| Required completeness | 83.3%; 25/30 | 100%; 30/30 | 100%; 30/30 | 100%; 30/30 |
| Shared additional completeness | 81.3%; 51/66 | 92.7%; 62/66 | 95.3%; 63/66 | 96.9%; 64/66 |
| Page reads / searches | 73 / 31 | 144 / 27 | 140 / 31 | same |
| Batch wall time | 275.6 s | 363.1 s | 273.5 s | same |
| Native input tokens | 1,036,626 | 1,310,705 | 1,016,184 | same |
| Native output tokens | 59,167 | 159,087 | 116,164 | same |
| Available estimated USD | 0.069827030 | 0.172747905 | 0.120927055 | same |

Completeness is the mean of applicable attempt ratios; the table also gives pooled fact counts. Both blocked Afro Nation attempts correctly refuse unsupported work and preserve the catalog. There are ten saved task outputs and all 34 applicable score rows. There are no host, native-role, scorer or storage failures; report errors are source-access diagnostics. No incomplete attempt is removed from the totals.

### Address correction and actual quality change

The only raw final failure is Sziget #1. It writes `Május 9. park, 1033` to the new and saved edition address fields, with Budapest locality and HU country stored separately. The fixed official [travel source](../../src/ingestion/evals/cases/sziget/travel.md) states the official street, Budapest, Hungary and postcode on line 56, and repeats them on line 203. The accepted alternatives already include the street alone. Scorer 12 adds this exact street-plus-postcode alternative to both new and saved address checks. It does not add blanket address normalization or change the output. The stored wrong address and saved-edition checks therefore become correct in replay. This is a gold coverage correction, not a model quality gain.

Compared with Cost 1, the two extra correct facts are Glastonbury historical year and country. Both final repetitions find them; Cost 1 misses them in one repetition. Both Wacken repetitions still omit locality. All Roskilde and Sziget required and additional facts are correct under the shared scorer 12. Required, identity, protected-record, classification, ticket-price, refusal and publication guards are retained. Checked correctness does not prove that every unscored sentence is correct.

### Per-case final result

| Case | Repeat | Cost 1 → final scenario | Required | Cost 1 → final additional | Cost 1 → final reads | Cost 1 → final seconds |
| --- | --- | --- | --- | --- | --- | --- |
| afro-nation-portugal-blocked | 1 | pass → pass | N/A | N/A → N/A | 5 → 2 | 20.3 → 14.6 |
| afro-nation-portugal-blocked | 2 | pass → pass | N/A | N/A → N/A | 6 → 9 | 18.7 → 19.0 |
| glastonbury | 1 | pass → pass | N/A | 4/6 → 6/6 | 14 → 11 | 94.7 → 74.1 |
| glastonbury | 2 | pass → pass | N/A | 6/6 → 6/6 | 16 → 15 | 129.4 → 84.5 |
| roskilde | 1 | pass → pass | 5/5 | 11/11 → 11/11 | 25 → 18 | 156.0 → 100.6 |
| roskilde | 2 | pass → pass | 5/5 | 11/11 → 11/11 | 25 → 34 | 138.9 → 163.9 |
| sziget | 1 | pass → pass | 5/5 | 8/8 → 8/8 | 16 → 12 | 122.5 → 93.0 |
| sziget | 2 | pass → pass | 5/5 | 8/8 → 8/8 | 14 → 12 | 131.7 → 87.5 |
| wacken | 1 | pass → pass | 5/5 | 7/8 → 7/8 | 12 → 15 | 92.8 → 92.9 |
| wacken | 2 | pass → pass | 5/5 | 7/8 → 7/8 | 11 → 12 | 100.0 → 84.9 |

### Role cost, tokens and cache use

The table gives Cost 1 → final. Model seconds are summed native model duration; parallel branches and parent waits overlap, so these times are not batch wall time. Cost estimates cover model calls, not source or geocoding bills.

| Role | Input tokens | Output tokens | Model seconds | Available estimated USD | Cache-read input tokens |
| --- | --- | --- | --- | --- | --- |
| classification | 52,068 → 28,289 | 5,567 → 2,781 | 57.7 → 30.7 | 0.009291475 → 0.004926025 | 0 → 0 |
| editor | 153,982 → 190,759 | 9,627 → 11,776 | 96.2 → 124.2 | 0.016633925 → 0.020474025 | 64,575 → 80,500 |
| general | 74,909 → 46,339 | 13,556 → 8,275 | 130.1 → 82.8 | 0.014239385 → 0.007945755 | 16,536 → 17,248 |
| links | 94,744 → 65,496 | 11,588 → 6,914 | 107.4 → 62.8 | 0.016429360 → 0.010436360 | 10,496 → 10,496 |
| location | 218,245 → 100,023 | 9,783 → 8,262 | 103.7 → 87.8 | 0.013715155 → 0.008721975 | 160,483 → 68,790 |
| reader | 255,376 → 241,014 | 67,660 → 44,487 | 428.3 → 387.5 | 0.061325450 → 0.035252955 | 38,450 → 148,803 |
| research | 415,707 → 316,730 | 35,419 → 30,160 | 579.9 → 463.3 | 0.032460855 → 0.027974160 | 323,543 → 232,116 |
| tickets | 45,674 → 27,534 | 5,887 → 3,509 | 59.6 → 36.0 | 0.008652300 → 0.005195800 | 0 → 0 |

Total input falls 22.5%, output falls 27.0%, and wall time falls 24.7% from Cost 1. Reader calls rise from 64 to 66, but output per call falls from 1,057.2 to 674.0 tokens. Reader output falls 34.2% and its estimated cost falls 42.5%. Research input falls 23.8%. Editor is the exception: its input rises 23.9% and cost rises 23.1%, reflecting the remaining review work and sampled call pattern. Smaller packets do not remove role overhead.

Total cache-read input falls from 614,083 to 557,953 tokens, while cache-write input falls from 696,055 to 457,697. The cache-read share of total input rises from 46.9% to 54.9%. Reader cache-read input rises from 38,450 to 148,803 tokens, while its cache-write input falls from 216,734 to 92,013. Thus the cost improvement includes a better Reader cache mix as well as shorter output and smaller role packets. It is not evidence that every saving comes from the code changes alone. All 122 final total-input metric rows have cost annotations, compared with 118 in Cost 1. Missing metrics would be unknown, not zero.

### Trial evidence and limits

Single-repeat trials 2–8 each contain five attempts. Their doubled costs were projections, not measured ten-attempt bills. Only the final row below measures the full ten-attempt batch. Earlier trials helped find defects and omissions; they do not replace final validation.

| Trial | Actual five-attempt USD | Doubled projection | Scenario success after source-backed scorer corrections | Main remaining cause |
| --- | --- | --- | --- | --- |
| Cost 2 | 0.069135315 | 0.138270630 | 5/5 | Missing travel/place evidence and conservative place selection |
| Cost 3 | 0.058491365 | 0.116982730 | 4/5 | General adds a duplicate historical edition key |
| Cost 4 | 0.046545225 | 0.093090450 | 4/5 | Editor rejects supported country and ticket proposals |
| Cost 5 | 0.053663465 | 0.107326930 | 3/5 | Reader loses classification quote; Location translates venue name |
| Cost 6 | 0.063316600 | 0.126633200 | 5/5 | Research misses Sziget travel evidence; additional completeness 87.5% |
| Cost 7 | 0.062158490 | 0.124316980 | 4/5 | Location proposes unsupported locality; Editor rejects location bundle |
| Cost 8 | 0.059978755 | 0.119957510 | 4/5 | Editor rejects whole Sziget item for incomplete optional classification |

The final profile keeps medium effort for navigation, place selection and review. It also uses compact role packets and exact quote spans, excludes formatting-only Reader context, retains exact saved edition keys, prefers literal venue names, and limits whole-item Editor rejection to material identity or country conflicts. Tickets returns to low effort: its earlier medium trial did not establish that medium was necessary. No reading cap was tightened and no expected fact was removed for the cost result. The [quality log](source-evidence-quality-log.md) records the code changes.

The architecture conclusion remains conditional: smaller input context is useful, but it is not sufficient when role output and review overhead raise cost or collection misses relevant evidence. The final result combines smaller packets with selective medium effort and stricter evidence handling. On these fixed cases, it preserves required quality and improves additional completeness at lower cost than Cost 1. Two repetitions do not establish broad reliability or a guaranteed USD 0.10 production budget. The original baseline still costs less and uses much less output, while the final design resolves its measured completeness failures.

Exports are `/tmp/eventroam-source-evidence-costfinal-comparison.json`, `/tmp/eventroam-source-evidence-costfinal-spans.json`, `/tmp/eventroam-costfinal-scorer12-replay.json`, and `/tmp/eventroam-cost1-scorer12-replay.json`. DuckDB was closed after export. Original experiment outputs and scores remain unchanged. This update changes only this comparison document.

## Cost simplification result: iteration 1

The first cost run preserves the measured quality result and reduces estimated model cost by 19.3% from Quality 4. All ten scenarios pass, all required facts are correct, additional completeness remains 92.7%, and there are no checked errors. Wall time falls by 13.8%. Cost remains about 2.47 times the original baseline, so this is an improvement from the prior implementation rather than a saving against the original flow.

Experiment `1c548390-e4f3-40c0-928b-1972d3c795f8`, label `source-evidence-cost-1`, uses the same five fixed main cases, two repetitions, scorer 9, dataset revision `068ac8a981a5a80fe575cc262dac50a5d0f8f067aebb944cc1b08467459bb47d`, model and standard service tier as Quality 4. Reader still uses low reasoning; interpretation roles use medium. The process exits 0. Prompt versions are Research `source-navigation-v6`, Reader `source-reader-v8`, General `general-facts-v6`, Tickets `current-tickets-v5`, Classification `edition-classification-v4`, Links `public-links-v3`, Editor `proposal-review-v5`, and Location `catalog-location-v11`. Saved Git metadata remains the dirty planning revision.

The changes reduce repeated context: roles receive the saved fields and target state that they use, most roles do not receive link anchors, Location does not receive unrelated proposals, and Research receives each new URL and label once per session. Reader instructions request concise, non-overlapping passages while retaining qualifications and scope. Sources, fact expectations, reasoning effort and reading limits are unchanged. The [quality log](source-evidence-quality-log.md) records the implementation changes.

| Measure | Original baseline, shared scope | Quality 4 | Cost 1 | Change from Quality 4 |
| --- | --- | --- | --- | --- |
| Scenario success | 9/10 | 10/10 | 10/10 | same |
| No checked errors | 10/10 | 10/10 | 10/10 | same |
| Required completeness | 83.3%; 25/30 | 100%; 30/30 | 100%; 30/30 | same |
| Shared additional completeness | 81.3%; 51/66 | 92.7%; 62/66 | 92.7%; 62/66 | same |
| Page reads | 73 | 134 | 144 | +7.5% |
| Search calls | 31 | 28 | 27 | -3.6% |
| Wall time | 275.6 s | 421.1 s | 363.1 s | -13.8% |
| Native input tokens | 1,036,626 | 1,632,358 | 1,310,705 | -19.7% |
| Native output tokens | 59,167 | 172,377 | 159,087 | -7.7% |
| Available estimated USD | 0.069827030 | 0.214107800 | 0.172747905 | -19.3% |

Pure scorer 9 replay of stored before/after catalogs, report and calls matches all stored Cost 1 scores. The common historical-ticket exclusions and baseline contract caveats are unchanged. No new gold correction is involved. There are ten task outputs and 34 applicable score rows, with no failed conditions, wrong checked facts, non-source role errors, scorer errors or storage failures. Blocked Afro Nation attempts still refuse unsupported work and preserve the catalog.

### Per-case comparison

| Case | Repeat | Scenarios, Quality 4 → Cost 1 | Required, Quality 4 → Cost 1 | Additional, Quality 4 → Cost 1 | Reads, Quality 4 → Cost 1 | Attempt seconds, Quality 4 → Cost 1 |
| --- | --- | --- | --- | --- | --- | --- |
| afro-nation-portugal-blocked | 1 | pass → pass | N/A → N/A | N/A → N/A | 5 → 5 | 15.5 → 20.3 |
| afro-nation-portugal-blocked | 2 | pass → pass | N/A → N/A | N/A → N/A | 2 → 6 | 18.5 → 18.7 |
| glastonbury | 1 | pass → pass | N/A → N/A | 6/6 → 4/6 | 16 → 14 | 117.1 → 94.7 |
| glastonbury | 2 | pass → pass | N/A → N/A | 4/6 → 6/6 | 13 → 16 | 112.8 → 129.4 |
| roskilde | 1 | pass → pass | 5/5 → 5/5 | 11/11 → 11/11 | 20 → 25 | 194.9 → 156.0 |
| roskilde | 2 | pass → pass | 5/5 → 5/5 | 11/11 → 11/11 | 21 → 25 | 165.2 → 138.9 |
| sziget | 1 | pass → pass | 5/5 → 5/5 | 8/8 → 8/8 | 11 → 16 | 120.4 → 122.5 |
| sziget | 2 | pass → pass | 5/5 → 5/5 | 8/8 → 8/8 | 16 → 14 | 179.4 → 131.7 |
| wacken | 1 | pass → pass | 5/5 → 5/5 | 7/8 → 7/8 | 13 → 12 | 135.5 → 92.8 |
| wacken | 2 | pass → pass | 5/5 → 5/5 | 7/8 → 7/8 | 17 → 11 | 115.7 → 100.0 |

The same four expected facts remain absent at case level. The missing Glastonbury historical year and country move from repetition 2 to repetition 1; the other repetition is complete in each run. Both Wacken attempts still omit locality. Both Roskilde and both Sziget attempts retain every required and additional fact. This preserves aggregate quality and case coverage, but does not establish identical behavior under repeated model sampling. Two repetitions cannot rule out smaller regressions in evidence coverage or unscored claims.

### Role resources

The table reports Quality 4 → Cost 1. Duration is summed native model time, not elapsed workflow time; parent waits and parallel branches overlap.

| Role | Input tokens | Output tokens | Model time, s | Available estimated USD |
| --- | --- | --- | --- | --- |
| classification | 82,880 → 52,068 | 6,557 → 5,567 | 66.4 → 57.7 | 0.013637975 → 0.009291475 |
| editor | 202,905 → 153,982 | 11,091 → 9,627 | 118.7 → 96.2 | 0.020019460 → 0.016633925 |
| general | 109,583 → 74,909 | 15,015 → 13,556 | 146.7 → 130.1 | 0.019303135 → 0.014239385 |
| links | 120,109 → 94,744 | 10,838 → 11,588 | 105.6 → 107.4 | 0.019224985 → 0.016429360 |
| location | 270,001 → 218,245 | 8,537 → 9,783 | 91.1 → 103.7 | 0.018468765 → 0.013715155 |
| reader | 293,489 → 255,376 | 85,035 → 67,660 | 855.9 → 428.3 | 0.073740930 → 0.061325450 |
| research | 479,618 → 415,707 | 28,990 → 35,419 | 666.1 → 579.9 | 0.037334375 → 0.032460855 |
| tickets | 73,773 → 45,674 | 6,314 → 5,887 | 65.8 → 59.6 | 0.012378175 → 0.008652300 |

Reader calls fall from 67 to 64. Average output per Reader call falls from 1,269.2 to 1,057.2 tokens, a 16.7% reduction; average input falls from 4,380.4 to 3,990.3 tokens. Total Reader output falls 20.4%, Reader cost falls 16.8%, and native Reader duration falls from 855.9 to 428.3 seconds. This is consistent with shorter extraction output rather than a lower reading cap. Page request count rises, while fewer requests reach Reader.

Research input falls from 479,618 to 415,707 tokens, a 13.3% reduction, despite more page requests. Its output rises from 28,990 to 35,419 tokens, so navigation still has room for improvement. General, Tickets, Classification, Links, Editor and Location all use less input and lower estimated cost. Location input falls 19.2% and Editor input falls 24.1%. No role's cost rises. These observations support the context reduction, but this single repeated run cannot isolate each change from model and provider variation.

All 118 Cost 1 total-input metric rows have cost annotations, compared with 121 in Quality 4. Estimates cover available native model cost, not external source or geocoding bills. Missing metrics would be unknown, not zero. Compared with the original baseline, Cost 1 uses 26.4% more input tokens, 168.9% more output tokens, 97.3% more page reads, 31.7% more wall time, and 147.4% more estimated model cost. The quality gain is retained, but the original flow remains less expensive on this fixed sample.

Exports are `/tmp/eventroam-source-evidence-cost1-comparison.json`, `/tmp/eventroam-source-evidence-cost1-spans.json`, and `/tmp/eventroam-cost1-scorer9-replay.json`. DuckDB was closed after export. Original experiments remain unchanged. This comparison changed only this document. The result does not close the remaining OpenSpec or affected-regression readiness work.

## Final quality result: iteration 4

The measured main quality goal is met in this run: 10/10 scenarios pass, all 30 required facts are correct, shared additional completeness is 92.7%, and no checked errors occur. The original baseline has 9/10 scenarios, 25/30 required facts, and 81.3% shared additional completeness. Resource use is still higher: estimated model cost is USD 0.2141078, about 3.07 times baseline. This result establishes improvement on these fixed cases, not completion of the wider OpenSpec implementation or all regression work.

Experiment `f2365864-574e-459f-8120-3ac37d06e7e5`, label `source-evidence-quality-4`, uses the same five main cases, two repetitions, `openai/gpt-6-luna`, standard service tier and fixed source pages. Reader uses low reasoning; interpretation roles use medium. The process exits 0. Dataset revision is `068ac8a981a5a80fe575cc262dac50a5d0f8f067aebb944cc1b08467459bb47d`; scorer revision is 9. Prompt versions are Research `source-navigation-v5`, Reader `source-reader-v7`, General `general-facts-v5`, Tickets `current-tickets-v4`, Classification `edition-classification-v3`, Links `public-links-v2`, Editor `proposal-review-v5`, and Location `catalog-location-v10`. Saved Git metadata remains the dirty planning revision and does not preserve the measured file contents. The [quality log](source-evidence-quality-log.md) records the changes.

| Measure | Original baseline, shared scope | Quality 3, scorer 9 replay | Quality 4, stored and replayed scorer 9 |
| --- | --- | --- | --- |
| Scenario success | 9/10 | 9/10 | 10/10 |
| No checked errors | 10/10 | 10/10 | 10/10 |
| Required completeness | 83.3%; 25/30 | 96.7%; 29/30 | 100%; 30/30 |
| Shared additional completeness | 81.3%; 51/66 | 90.4%; 60/66 | 92.7%; 62/66 |
| Page reads / searches | 73 / 31 | 129 / 29 | 134 / 28 |
| Wall time | 275.6 s | 433.2 s | 421.1 s |
| Native input / output tokens | 1,036,626 / 59,167 | 1,523,766 / 176,101 | 1,632,358 / 172,377 |
| Available estimated USD | 0.069827030 | 0.199265585 | 0.214107800 |

Completeness remains the mean of applicable attempt ratios, not the pooled fact ratio. Required completeness has six applicable attempts; additional completeness has eight. The counts show the pooled facts separately. Four required and two additional dimensions are intentionally N/A. Both blocked-source attempts pass the expected refusal; their failed catalog outcome is correct behavior.

### Per-case facts and remaining omissions

| Case | Repeat | Baseline → latest scenario | Baseline → latest required | Baseline → latest shared additional | Baseline → latest reads | Baseline → latest attempt seconds |
| --- | --- | --- | --- | --- | --- | --- |
| afro-nation-portugal-blocked | 1 | pass → pass | N/A → N/A | N/A → N/A | 2 → 5 | 13.5 → 15.5 |
| afro-nation-portugal-blocked | 2 | pass → pass | N/A → N/A | N/A → N/A | 2 → 2 | 11.9 → 18.5 |
| glastonbury | 1 | pass → pass | N/A → N/A | 6/6 → 6/6 | 9 → 16 | 65.1 → 117.1 |
| glastonbury | 2 | pass → pass | N/A → N/A | 6/6 → 4/6 | 9 → 13 | 71.9 → 112.8 |
| roskilde | 1 | fail → pass | 0/5 → 5/5 | 0/11 → 11/11 | 11 → 20 | 91.2 → 194.9 |
| roskilde | 2 | pass → pass | 5/5 → 5/5 | 11/11 → 11/11 | 13 → 21 | 104.0 → 165.2 |
| sziget | 1 | pass → pass | 5/5 → 5/5 | 6/8 → 8/8 | 6 → 11 | 135.9 → 120.4 |
| sziget | 2 | pass → pass | 5/5 → 5/5 | 6/8 → 8/8 | 8 → 16 | 99.6 → 179.4 |
| wacken | 1 | pass → pass | 5/5 → 5/5 | 8/8 → 7/8 | 7 → 13 | 90.3 → 135.5 |
| wacken | 2 | pass → pass | 5/5 → 5/5 | 8/8 → 7/8 | 6 → 17 | 74.3 → 115.7 |

Only four expected facts remain absent. Glastonbury #2 lacks historical year and country: General accepts that the official 2025 history establishes a realized festival but says the supplied material does not rule out a later completed festival, so it selects no historical target. Glastonbury #1 resolves those facts. Both Wacken attempts lack locality. Location correctly separates the company office from the festival grounds and does not infer locality from the event name; it sets the supported bound DE country continuity, which now allows publication. Relevant destination evidence is still not consistently used to establish Wacken locality.

Roskilde and Sziget both have every required and additional fact in both repetitions. All checked saved-record, classification, price/offer, identity, source-refusal and publication conditions pass. There are no non-source role or runtime errors. Fixed-source retrieval misses remain report diagnostics, but no attempt is omitted from scoring because of them. This is checked correctness on the declared facts, not proof that every sentence or unscored optional claim is correct.

### Gold and contract comparability

Pure scorer 9 replay of stored catalogs, reports and tool calls reproduces all Quality 4 scores. No model or source request is repeated. Original experiments remain unchanged. For the baseline, the common comparison uses its original passed refusal conditions and the documented historical-ticket exclusion; the raw current-contract replay artifacts are explained under Quality 3. Required facts, publication, saved-record protections and substantive current price facts remain fixed.

The only gold changes are exact source-backed alternatives: the Wacken YouTube URL with a final slash and the Roskilde festival address without an added country suffix. Both latest Wacken attempts use the supported slash URL. Both Roskilde attempts use the already accepted `Darupvej 19, 4000 Roskilde`, so the scorer 9 address alternative has no effect on this run. Applying the old over-narrow URL list would remove two additional credits and fail the two Wacken scenarios for that source-supported value; shared additional completeness would still be 89.6%, above the baseline. The 30/30 required facts are unaffected. Thus the completeness gain is not merely a gold adjustment. The 10/10 checked correctness and scenario result use justified source alternatives, not weaker factual requirements. No arbitrary URL normalization or address tolerance is introduced.

### Quality 4 role resources

| Role | Input tokens | Output tokens | Model time, s | Available estimated USD |
| --- | --- | --- | --- | --- |
| classification | 82,880 | 6,557 | 66.4 | 0.013637975 |
| editor | 202,905 | 11,091 | 118.7 | 0.020019460 |
| general | 109,583 | 15,015 | 146.7 | 0.019303135 |
| links | 120,109 | 10,838 | 105.6 | 0.019224985 |
| location | 270,001 | 8,537 | 91.1 | 0.018468765 |
| reader | 293,489 | 85,035 | 855.9 | 0.073740930 |
| research | 479,618 | 28,990 | 666.1 | 0.037334375 |
| tickets | 73,773 | 6,314 | 65.8 | 0.012378175 |

All 121 total-input metric rows have estimated cost annotations. These are available model estimates, not billing totals; missing metrics would be unknown, not zero. Token totals include cached input and reasoning output. Role duration sums overlap and must not be used as elapsed time.

From Quality 3, cost rises 7.4%, while wall time falls 2.8%. Reader uses 67 calls rather than 63 and costs USD 0.07374093; Location input rises after description evidence is included. Compared with baseline, reads rise 83.6%, input tokens 57.5%, output tokens 191.3%, wall time 52.8%, and estimated cost 206.6%. The quality goal is met; a cost reduction goal is not. Evidence compression and host anchor extraction reduced earlier overhead, but more source reads and repeated navigation/evidence inputs still cost more than the original flow.

All ten task outputs and 34 applicable score rows are stored. No task, scorer or storage failures were found. The exported evidence is `/tmp/eventroam-source-evidence-quality4-comparison.json`, `/tmp/eventroam-source-evidence-quality4-spans.json`, and `/tmp/eventroam-quality4-scorer9-replay.json`. DuckDB connections were closed after export. This inspection changed only this comparison document.

Two repetitions on five fixed cases remain a small sample. Remaining fixture repair, affected regression baselines, quality work outside main, shared fixture contract cleanup and OpenSpec task completion must be assessed separately. Do not infer that the full implementation is ready or that all OpenSpec work is complete from this main result.

## Quality iteration 3

Experiment `003985c8-0337-4d28-9acd-12b883ea4768`, label `source-evidence-quality-3`, uses the same main sources, model, standard tier and two repetitions. Reader uses low reasoning; other roles use medium. Dataset revision is `9fe3f12d8d7461821ec9141e81cd1e6302c2932d466330f97a05cce7ba45c2e8`. Prompt versions are Research `source-navigation-v5`, Reader `source-reader-v6`, General `general-facts-v5`, Tickets `current-tickets-v4`, Classification `edition-classification-v3`, Links `public-links-v2`, Editor `proposal-review-v4`, and Location `catalog-location-v9`.

Scorer 8 adds only the exact source-backed Wacken YouTube URL with a final slash. Scorer 9 adds only the exact supported Roskilde festival address alternative described below. Neither revision removes a fact, reduces required completeness, changes saved-record protection, or changes the fixed source pages. Pure `evaluateMainCase` replay uses stored before/after catalogs, report, calls and fixture data; it does not rerun models or mutate old experiments.

| Measure | Original baseline, shared scope | Quality 1, scorer 9 replay | Quality 2, scorer 9 replay | Quality 3 stored scorer 8 | Quality 3 scorer 9 replay |
| --- | --- | --- | --- | --- | --- |
| Scenario success | 9/10 | 7/10 | 7/10 | 8/10 | 9/10 |
| No checked errors | 10/10 | 9/10 | 9/10 | 9/10 | 10/10 |
| Required completeness | 83.3%; 25/30 | 96.7%; 29/30 | 80.0%; 24/30 | 96.7%; 29/30 | same |
| Shared additional completeness | 81.3%; 51/66 | 64.6%; 45/66 | 73.7%; 49/66 | 89.3%; 59/66 | 90.4%; 60/66 |
| Page reads / searches | 73 / 31 | 108 / 29 | 105 / 30 | 129 / 29 | same |
| Wall time | 275.6 s | 552.5 s | 590.4 s | 433.2 s | same |
| Input / output tokens | 1,036,626 / 59,167 | 2,114,537 / 226,413 | 1,844,091 / 215,592 | 1,523,766 / 176,101 | same |
| Available estimated USD | 0.069827030 | 0.270100680 | 0.245505685 | 0.199265585 | same |

Required and additional completeness now exceed the baseline, and corrected checked correctness matches it. Corrected scenario success only matches 9/10; the target requires more than 9/10. The quality goal is therefore still unmet. Cost remains about 2.85 times the baseline. All ten outputs and 34 applicable score rows are present. No host contract, task-output, scorer, or storage failure was found in this iteration.

### Gold corrections and comparable facts

Roskilde #2 saves `Festivalpladsen, Darupvej 19, 4000 Roskilde`. The official contact source explicitly labels the address during the festival at `src/ingestion/evals/cases/roskilde/contact.md:87`; lines 89–91 give those exact address components. Lines 82–85 separately identify the office. Replacing the source line breaks with commas is a supported address representation. The separate DK country field does not require the word Denmark in the address string. Scorer 8 marks this correct address wrong because its alternatives include either a shorter street address or the full address with Denmark. Scorer 9 adds this exact alternative. It changes one additional fact and the attempt's correctness and scenario scores; original stored scores remain unchanged.

The Wacken URL correction can change at most one additional fact per Wacken attempt and related correctness/scenario outcomes. The address correction changes at most one Roskilde address fact per attempt. Together they cannot explain the broad extraction gain: Quality 3 has 29/30 required facts and both Sziget attempts have all 13 facts, with no change to their expectations. The original stored results, corrected replays, and historical-ticket scope exclusions remain separate. No quality gain is claimed from omitting historical ticket work or offer URLs.

Replaying the current evaluator directly on the original baseline produces 6/10 scenario success and 9/10 no checked errors, while preserving its 83.3% required and 81.3% shared additional completeness. Those two lower rates are contract artifacts: both blocked Afro Nation attempts lack the redesigned General candidate structure, and one Glastonbury attempt performed the historical ticket extraction that the original task assigned. The common comparison retains the original passed source-refusal conditions and excludes the documented historical-ticket preservation check. This restores 9/10 and 10/10. It does not change factual judgments, source-refusal behavior, or saved-record protection. Raw replay is retained separately and must not be presented as a baseline quality regression.

### Remaining facts and causes

| Attempt | Stored scorer 8 scenario | Required | Additional | Missing or rejected facts |
| --- | --- | --- | --- | --- |
| afro-nation-portugal-blocked #1 | pass | N/A | N/A | none |
| afro-nation-portugal-blocked #2 | pass | N/A | N/A | none |
| glastonbury #1 | pass | N/A | 4/6 | history.year, history.country |
| glastonbury #2 | pass | N/A | 6/6 | none |
| roskilde #1 | pass | 5/5 | 9/11 | next.venue, next.address |
| roskilde #2 | fail | 5/5 | 10/11 | next.address (wrong) |
| sziget #1 | pass | 5/5 | 8/8 | none |
| sziget #2 | pass | 5/5 | 8/8 | none |
| wacken #1 | pass | 5/5 | 7/8 | next.locality |
| wacken #2 | fail | 4/5 | 7/8 | next.country, next.locality |

- Wacken #2 is the only remaining true scenario failure. Location leaves new-Edition country absent, so that Edition cannot publish. It also omits locality in both Wacken attempts. The saved 2026 country is DE, but Location refuses continuity without a direct festival-site country statement. It correctly avoids using the company's Wacken office address as the festival venue. A useful source passage is lost in routing: Reader's `s2-e3` LOUDER block says “der Weg nach Wacken bleibt euch offen” and identifies the 2027 festival pass, but assigns only tickets and description topics. The block does not reach Location. The smallest correction is to preserve this explicit destination evidence across topic routing and make the permitted same-Event country continuity rule clear. Do not substitute the company office for the venue.
- Glastonbury #1: General now selects 2025 from the official history entry and latest archive year. Editor rejects that historical target because Reader's uncertainty note warns that the archive does not prove completion. Year and country are therefore not written. This is a semantic disagreement about the temporal evidence; it is no longer a General schema or retrieval failure. Location also leaves historical country absent despite the supplied baseline, which requires the same target-country rule.
- Roskilde #1: Location sees the contact page but treats its festival-period address as insufficient to name the venue or venue address. These two facts remain absent. This is a conservative reading of the explicit source block, not missing retrieval. Roskilde #2 extracts the block correctly and only needs the justified address alternative.
- Both Sziget attempts have every required and additional fact. No saved-record classification error remains in either Wacken attempt. General refresh and Tickets currency contracts also pass.

### Quality 3 role resources

| Role | Input tokens | Output tokens | Model time, s | Available estimated USD |
| --- | --- | --- | --- | --- |
| classification | 79,050 | 7,564 | 65.1 | 0.013662650 |
| editor | 213,303 | 12,967 | 149.6 | 0.021178435 |
| general | 95,097 | 14,416 | 144.8 | 0.017430590 |
| links | 113,421 | 11,033 | 103.0 | 0.018486485 |
| location | 183,724 | 8,585 | 84.4 | 0.014601010 |
| reader | 251,719 | 81,651 | 674.0 | 0.065152890 |
| research | 522,808 | 31,721 | 668.7 | 0.036591475 |
| tickets | 64,644 | 8,164 | 82.2 | 0.012162050 |

All 119 total-input rows have cost annotations. Costs are available estimates, not bills; missing metrics would be unknown, not zero. Role model durations overlap. Cost falls 18.8% and wall time falls 26.6% from Quality 2, while all eight accessible-source attempts reach the interpretation roles. Reader output falls from 134,776 to 81,651 tokens, and Location input from 472,760 to 183,724. These are useful reductions after host anchor extraction and smaller evidence packets. Research input remains high at 522,808 tokens and Editor input at 213,303, so the total still exceeds baseline resource use. The comparison supports continued work on total evidence distribution and navigation history rather than treating each small role input as a guaranteed saving.

Exports are `/tmp/eventroam-source-evidence-quality3-comparison.json` and `/tmp/eventroam-source-evidence-quality3-spans.json`. Pure scorer replays are `/tmp/eventroam-{baseline,final,quality1,quality2,quality3}-scorer8-replay.json` and corresponding scorer 9 files. Connections were closed before Quality 4 started. No production code, fixed sources, or stored experiment results were changed by this inspection.

## Quality iteration 2

Experiment `490db6a5-6a92-4484-a7fd-0ca3f13e3368`, label `source-evidence-quality-2`, keeps the same model, standard tier, two repetitions, dataset revision and scorer revision as Quality 1. Reader uses low reasoning; interpretation roles use medium. Prompt versions are Research `source-navigation-v4`, Reader `source-reader-v5`, General `general-facts-v4`, Tickets `current-tickets-v3`, Classification `edition-classification-v2`, Links `public-links-v2`, Editor `proposal-review-v3`, and Location `catalog-location-v8`. The [quality log](source-evidence-quality-log.md) records the changes. No expected facts were changed for this comparison.

| Measure | Original baseline | Quality 1 original | Quality 2 original | Quality 2 supported URL alternative |
| --- | --- | --- | --- | --- |
| Scenario success | 9/10 | 6/10 | 7/10 | 7/10 |
| No checked errors | 10/10 | 8/10 | 9/10 | 9/10 |
| Required completeness | 83.3%; 25/30 | 96.7%; 29/30 | 80.0%; 24/30 | same |
| Shared additional completeness | 81.3%; 51/66 | 61.5%; 43/66 | 72.1%; 48/66 | 73.7%; 49/66 |
| Page reads / searches | 73 / 31 | 108 / 29 | 105 / 30 | same |
| Wall time | 275.6 s | 552.5 s | 590.4 s | same |
| Input / output tokens | 1,036,626 / 59,167 | 2,114,537 / 226,413 | 1,844,091 / 215,592 | same |
| Available estimated USD | 0.069827030 | 0.270100680 | 0.245505685 | same |

Quality 2 improves additional completeness and raw scenario success from Quality 1, but loses five required facts in Wacken #1 and one in Roskilde #1. It does not beat the original baseline on any quality measure. The goal remains unmet. Historical-ticket exclusions and macro score definitions remain unchanged. All ten outputs and 34 applicable score rows are present; no storage failure was found. One completed attempt fails Reader validation.

The separate URL view accepts only the previously verified literal Wacken YouTube alternative with a final slash. It changes Wacken #2 additional completeness from 7/8 to 8/8. Its saved-Edition error remains, so neither scenario success nor checked correctness changes. Original scores remain untouched.

### Remaining facts and causes

| Attempt | Original scenario | Required | Additional | Missing or rejected facts |
| --- | --- | --- | --- | --- |
| afro-nation-portugal-blocked #1 | pass | N/A | N/A | none |
| afro-nation-portugal-blocked #2 | pass | N/A | N/A | none |
| glastonbury #1 | pass | N/A | 4/6 | history.year, history.country |
| glastonbury #2 | pass | N/A | 6/6 | none |
| roskilde #1 | fail | 4/5 | 8/11 | next.country, next.locality, next.venue, next.address |
| roskilde #2 | pass | 5/5 | 11/11 | none |
| sziget #1 | pass | 5/5 | 6/8 | next.venue, next.address |
| sziget #2 | pass | 5/5 | 6/8 | next.venue, next.address |
| wacken #1 | fail | 0/5 | 0/8 | next.year, next.dates, next.country, next.eventType, next.topic, next.dateState, next.scheduleStatus, next.locality, next.genre, event.website, event.links.youtube, next.tickets, next.basePrice, next.classification |
| wacken #2 | fail | 5/5 | 7/8 | event.links.youtube (wrong), saved.editions (wrong) |

- Wacken #1: Reader emits `anchors: [{"url":"","label":"Wacken-Radio"}]` for the exact source text `[Wacken-Radio]()`. The source contains an empty Markdown destination at `src/ingestion/evals/cases/wacken/history.md:19`. The model even notes that the link has no destination, but still creates the anchor. Host validation rejects `evidence.6.anchors.0.url:invalid_format`; all collected facts are lost when the workflow stops. This is invalid role output, not source unavailability or an unresolved relative URL. Keep URL validation. Empty source destinations must not produce anchors.
- Roskilde #1: Location correctly proposes Festivalpladsen, Darupvej 19, Roskilde, DK, and a point explicitly marked with locality precision. Venue geocoding is unavailable, so it uses the Roskilde settlement point without claiming venue precision. Editor recognizes the supported text and country but rejects the whole bundle solely because the point is not confirmed for Festivalpladsen. This removes country, locality, venue and address and prevents publication. The review confuses a permitted locality point with a claim of venue precision. It is a semantic review failure, not a host contract failure. Prices and the participant estimate now pass.
- Glastonbury #1: Research successfully reads both the archive index and `history/history-2025/`. General still calls the completion check unfinished because the archive does not explicitly declare 2025 the latest completed Edition. It selects no historical target, so year and country remain missing. Reader's overview calls the page the 2025 festival history; this is conservative temporal interpretation after successful retrieval. Glastonbury #2 resolves the same case and gets all six additional facts.
- Sziget #1 and #2: country, locality and base price now pass. Location still has no accepted named venue or street address for the future Edition. Both attempts pass their scenarios but miss those two additional facts. The original baseline also misses these facts; retaining them is necessary to measure improvement beyond that baseline.
- Wacken #2: Classification again adds `validation:openair` to saved 2026 terms, and Editor approves it. Its stated basis is the official event name and general description, with references `s1-e1` and `s2-e3` for the two Edition proposals. No explicit outdoor programme passage is supplied for the historical addition. Saved dates and country stay intact. Keep the original saved-Edition failure pending contract and source review. Do not treat it as corrected merely because the YouTube alternative is valid.

The repeated-social quotation loss, excessive `editionClues`, RF27 weekday-year rejection, and Sziget base-price failures from Quality 1 do not recur in these saved results. This shows progress on those observations, not a stable success guarantee from two repetitions.

### Quality 2 role resources

| Role | Input tokens | Output tokens | Model time, s | Available estimated USD |
| --- | --- | --- | --- | --- |
| classification | 104,892 | 4,566 | 58.1 | 0.015394050 |
| editor | 184,765 | 11,972 | 140.4 | 0.019434185 |
| general | 139,252 | 13,612 | 134.2 | 0.022811965 |
| links | 161,306 | 10,966 | 109.3 | 0.024592900 |
| location | 472,760 | 7,358 | 113.9 | 0.026838710 |
| reader | 240,201 | 134,776 | 1298.0 | 0.090420350 |
| research | 450,768 | 26,057 | 922.4 | 0.031603025 |
| tickets | 90,147 | 6,285 | 68.6 | 0.014410500 |

All 112 total-input rows have cost annotations. Estimates are not bills; missing data would be unknown, not zero. Model time overlaps and must not be added to estimate wall time. Cost falls 9.1% from Quality 1 but remains 251.6% above the original baseline. Input falls 12.8% and output falls 4.8% from Quality 1. Wall time rises 6.9%. Reader calls rise from 61 to 64, with almost unchanged output and slightly lower cost; its native model time rises from 979.9 to 1298.0 seconds. Fewer completed downstream branches and lower downstream input account for much of the cost reduction. The Wacken validation failure therefore contributes to lower resource use; do not count failed work as an architectural efficiency gain.

Metrics and traces were exported to `/tmp/eventroam-source-evidence-quality2-comparison.json` and `/tmp/eventroam-source-evidence-quality2-spans.json`. DuckDB connections were closed before the next eval started. All further inspection used those files. No production code, expected facts, or stored experiment scores were changed.

## Quality iteration 1

Experiment `86acb4e6-b17f-4bef-8f59-b4b2e6064e74`, label `source-evidence-quality-1`, uses the same main cases, two repetitions, model and standard service tier. Dataset revision remains `f9082c993c6ea4db0d0e98f9bf42e3a2b98bb88656f7d4df1dc07f1b95b03779`; scorer revision remains 7. Reader uses low reasoning effort; interpretation roles use medium. Prompt versions are Research `source-navigation-v3`, Reader `source-reader-v4`, General `general-facts-v3`, Tickets `current-tickets-v2`, Classification `edition-classification-v2`, Links `public-links-v2`, Editor `proposal-review-v2`, and Location `catalog-location-v8`. The [quality log](source-evidence-quality-log.md) records the implementation changes. Saved Git metadata still points to the dirty planning revision, so it does not preserve the measured source contents.

| Measure | Original baseline | Prior after | Quality 1, original scores | Quality 1, supported URL alternative |
| --- | --- | --- | --- | --- |
| Scenario success | 9/10 | 4/10 | 6/10 | 7/10 |
| No checked errors | 10/10 | 10/10 | 8/10 | 9/10 |
| Required completeness | 83.3%; 25/30 | 40.0%; 12/30 | 96.7%; 29/30 | 96.7%; 29/30 |
| Shared additional completeness | 81.3%; 51/66 | 39.1%; 22/66 | 61.5%; 43/66 | 64.6%; 45/66 |
| Page reads / searches | 73 / 31 | 95 / 30 | 108 / 29 | same |
| Wall time | 275.6 s | 668.5 s | 552.5 s | same |
| Input / output tokens | 1,036,626 / 59,167 | 1,097,558 / 223,553 | 2,114,537 / 226,413 | same |
| Available estimated USD | 0.069827030 | 0.204152085 | 0.270100680 | same |

Required completeness exceeds the original baseline, but additional completeness, scenario success and checked correctness do not. The goal is not met. Historical-ticket exclusions are unchanged. All ten outputs and 34 applicable score rows are present. No task-output or storage failure was found. Glastonbury #2 is a completed attempt with failed role output, not missing storage.

The supported URL view changes only two `event.links.youtube` judgments. Both Wacken attempts save `https://www.youtube.com/wackentv/`. This exact URL occurs in the fixed official source, including `src/ingestion/evals/cases/wacken/travel.md:78`. The expected alternatives omit it. This is a missing valid source alternative, not evidence of an invented account. Original stored scores remain unchanged. This limited correction gives Wacken #1 a successful scenario; Wacken #2 still fails saved-Edition protection. It does not apply general slash normalization to arbitrary URLs.

### Remaining facts and causes

| Attempt | Original scenario | Required | Additional | Missing or rejected facts |
| --- | --- | --- | --- | --- |
| afro-nation-portugal-blocked #1 | pass | N/A | N/A | none |
| afro-nation-portugal-blocked #2 | pass | N/A | N/A | none |
| glastonbury #1 | pass | N/A | 3/6 | event.links.instagram, event.links.tiktok, event.links.facebook |
| glastonbury #2 | fail | N/A | 0/6 | event.website, event.links.instagram, event.links.tiktok, event.links.facebook, history.year, history.country |
| roskilde #1 | pass | 5/5 | 9/11 | next.sizeEstimate, next.basePrice |
| roskilde #2 | fail | 4/5 | 8/11 | next.country, next.locality, next.venue, next.address |
| sziget #1 | pass | 5/5 | 4/8 | next.locality, next.venue, next.address, next.basePrice |
| sziget #2 | pass | 5/5 | 5/8 | next.venue, next.address, next.basePrice |
| wacken #1 | fail | 5/5 | 7/8 | event.links.youtube (wrong) |
| wacken #2 | fail | 5/5 | 7/8 | event.links.youtube (wrong), saved.editions (wrong) |

- Glastonbury #1: Reader supplies repeated short social-link text that fails the unique literal quotation rule. Links correctly has no supported social proposals after that evidence is removed. A separate unique context does not make the main quotation unique. Historical year and country are now saved correctly.
- Glastonbury #2: Reader returns more than 20 `editionClues` for one evidence item. The host rejects the role output with `evidence.4.editionClues:too_big`. This one validation failure stops useful collection and all six additional facts remain absent. Keep bounds and make Reader obey them; this is a contract failure rather than unavailable sources.
- Roskilde #1: Editor rejects the complete ticket group because weekday offers lack their own explicit year label, although the RF27 overview supplies shared Edition context. All prices are then omitted, including the supported full-programme base price. General also omits the participant estimate. Review use of shared year context and recurring participant evidence.
- Roskilde #2: Location proposes Roskilde and DK for the new Edition from recurring official location evidence and the supplied country baseline. Editor rejects the entire location group because the quotation does not explicitly establish DK. Locality is lost with country; the new Edition remains draft. Location also treats the official festival-period address as insufficient venue evidence, leaving venue and address absent. This is evidence interpretation and review, not a host schema failure.
- Sziget #1: Editor rejects the whole ticket group because the cited five-day pass does not explicitly say general admission. Prices are supported but the base-price interpretation is rejected. Location retains country while omitting locality, venue and address. It treats mixed-year Budapest metadata as insufficient for the next Edition's locality.
- Sziget #2: The unique price passage is supplied with repeated unnecessary `[Tickets]` context. Literal binding removes that evidence; Tickets sees a 2027 ticket page but no supported offers. Venue and address also remain unsupported. The scenario passes because those are additional facts.
- Wacken #2: The saved 2026 Edition gains `validation:openair`, which the fixed preservation expectation does not permit. Dates and country stay intact; locality and locality-point updates are permitted. Classification cites the aftermovie item `s11-e1` and explicitly relies on the official event name “Open Air”. Editor approves the same reasoning. No explicit outdoor programme passage is cited for that historical addition. Retain the strict failure pending a source and contract review; the URL correction does not resolve it.

The General duplicate-in-refresh and Tickets ISO/amount-pair failures from the prior after run do not recur. This is useful contract progress. The remaining failures include Reader contract limits, evidence lost during literal binding, and strict or inconsistent semantic review. These require different fixes; weaker validation would hide the first two.

### Quality 1 role resources

Native cost annotations exist for all 112 total-input metric rows. The values below are available model estimates, not bills. Model durations overlap and include parent waits; they must not be added to estimate wall time. Missing metrics would be unknown, not zero.

| Role | Input tokens | Output tokens | Model time, s | Available estimated USD |
| --- | --- | --- | --- | --- |
| classification | 114,962 | 7,522 | 83.9 | 0.018130725 |
| editor | 208,910 | 13,862 | 149.9 | 0.021707770 |
| general | 147,627 | 13,367 | 136.8 | 0.023779810 |
| links | 164,659 | 10,789 | 102.4 | 0.025205275 |
| location | 621,780 | 10,659 | 132.7 | 0.036495850 |
| reader | 229,083 | 135,752 | 979.9 | 0.092534125 |
| research | 519,027 | 27,327 | 788.3 | 0.035118950 |
| tickets | 108,489 | 7,135 | 68.6 | 0.017128175 |

Cost rises 32.3% from the prior after run and 286.8% from the baseline. Reader does not cause the incremental cost: its calls rise from 42 to 61, but output falls from 150,289 to 135,752 tokens, cost falls from USD 0.093471950 to 0.092534125, and model time falls from 1655.5 to 979.9 seconds. Low reasoning reduces Reader work per call, while collection reaches more pages.

The large increase is input supplied to other roles. Research input rises from 184,685 to 519,027 tokens; Location from 279,744 to 621,780; Editor from 117,214 to 208,910. About 82% of the net cost increase comes from downstream roles and 19% from Research, with Reader providing a small offset. More completed branches, expanded evidence, and navigation history increase total input. Aggregate metrics do not separately identify the cost of navigation links and quoted evidence, so that split remains unknown. Smaller reasoning effort alone does not control total architecture cost.

Inspection used exported snapshots `/tmp/eventroam-source-evidence-quality1-comparison.json` and `/tmp/eventroam-source-evidence-quality1-spans.json`. DuckDB was closed before the next eval started. No production code, expected facts, or saved experiment scores were changed for this comparison.

## Initial implementation comparison

The initial final-after implementation does not meet the quality or cost goal. Scenario success falls from 9/10 to 4/10. Shared required completeness falls from 83.3% to 40.0%. Shared additional completeness falls from 81.3% to 39.1%. Page reads increase by 30%, estimated model cost by 192%, and wall time by 143%. Implementation remains incomplete. These results do not establish readiness.

## Runs and method

Both runs use `main/pipeline`, five cases, two repetitions, `openai/gpt-6-luna`, medium reasoning, standard service tier, and tracing. Location uses the same model. Each attempt uses fixed sources and a fresh catalog. Both commands exit with code 1.

| Run | Experiment ID | Dataset revision |
| --- | --- | --- |
| Before | `3220ed49-424c-4999-a4bc-2b0d11dcddf2` | `0dc4e43a8e65a576156240b55cb88d3eaafe9ad0044c861a67766726f40e8fc0` |
| Final after | `08130e16-b70b-4062-b739-1fbdabc6d16d` | `f9082c993c6ea4db0d0e98f9bf42e3a2b98bb88656f7d4df1dc07f1b95b03779` |

The labels are `source-evidence-before` and `source-evidence-after-final`. Saved Git metadata for both names revision `77e47530e5c6b6018e6f573682781a97381c5e0d`, branch `codex/source-evidence-ingestion-plan`. The after run uses uncommitted implementation files. This Git reference does not preserve their contents.

Before prompt versions: Research `edition-slots-v7`, Editor `catalog-editor-v20`, Location `catalog-location-v6`. Final after versions: Research `source-navigation-v2`, Reader `source-reader-v3`, General `general-facts-v2`, Tickets `current-tickets-v1`, Classification `edition-classification-v2`, Links `public-links-v2`, Editor `proposal-review-v1`, Location `catalog-location-v7`.

Scorer revision changes from 6 to 7. This is a code comparison across changed contracts, not a model comparison on one dataset revision. The shared comparison excludes Glastonbury `history.basePrice` from both runs. It also excludes the new `history.ticketsPreserved` check from shared correctness. Historical ticket extraction is no longer assigned. Current offer checks retain amount and currency but remove per-offer URLs. Baseline offer checks all pass, so this removal creates no shared quality gain. Required facts, source refusal, saved record protection, identity, programme dates, classification, and publication remain in scope.

## Shared quality

Completeness means the mean of applicable attempt scores. Pooled counts are also shown. Required completeness applies to six attempts; four are N/A. Additional completeness applies to eight attempts; two are N/A. N/A is not zero.

| Measure | Before | Final after |
| --- | --- | --- |
| No checked errors | 10/10 | 10/10 |
| Required completeness | 83.3%; 25/30 facts | 40.0%; 12/30 facts |
| Additional completeness, shared facts | 81.3%; 51/66 facts | 39.1%; 22/66 facts |
| Scenario success | 9/10 | 4/10 |

No checked errors does not establish complete extraction. Three final attempts stop before writes because their role output violates the host contract. Other attempts omit required facts. Both Glastonbury attempts satisfy the new historical-ticket preservation check. This confirms revised-contract conformance for that check; it does not add shared fact credit.

| Case | Repeat | Scenario before → after | Required before → after | Shared additional before → after | Page reads before → after | Attempt seconds before → after |
| --- | --- | --- | --- | --- | --- | --- |
| afro-nation-portugal-blocked | 1 | pass → pass | N/A → N/A | N/A → N/A | 2 → 5 | 13.5 → 13.2 |
| afro-nation-portugal-blocked | 2 | pass → pass | N/A → N/A | N/A → N/A | 2 → 7 | 11.9 → 18.5 |
| glastonbury | 1 | pass → pass | N/A → N/A | 6/6 → 4/6 | 9 → 6 | 65.1 → 127.2 |
| glastonbury | 2 | pass → fail | N/A → N/A | 6/6 → 5/6 | 9 → 10 | 71.9 → 216.5 |
| roskilde | 1 | fail → fail | 0/5 → 0/5 | 0/11 → 0/11 | 11 → 17 | 91.2 → 230.1 |
| roskilde | 2 | pass → fail | 5/5 → 0/5 | 11/11 → 0/11 | 13 → 11 | 104.0 → 308.4 |
| sziget | 1 | pass → fail | 5/5 → 4/5 | 6/8 → 4/8 | 6 → 8 | 135.9 → 250.3 |
| sziget | 2 | pass → pass | 5/5 → 5/5 | 6/8 → 5/8 | 8 → 10 | 99.6 → 251.1 |
| wacken | 1 | pass → fail | 5/5 → 0/5 | 8/8 → 0/8 | 7 → 13 | 90.3 → 200.5 |
| wacken | 2 | pass → fail | 5/5 → 3/5 | 8/8 → 4/8 | 6 → 8 | 74.3 → 108.9 |

## Final failure review

Baseline Roskilde #1 fails Location and creates no Edition. The other nine baseline attempts pass. In the final run, both blocked Afro Nation attempts pass the expected refusal and preserve the catalog. Glastonbury #1 and Sziget #2 also pass their scenarios. The following six attempts fail.

- Roskilde #1: Tickets returns numeric paid prices with null currency. It says the quotations show only “kr.” and declines to infer the currency. The domain contract requires currency with a numeric price. Host validation correctly rejects the output as `invalid_candidate`; no facts are written.
- Roskilde #2: Tickets returns `kr.` as currency instead of an ISO currency code. Host validation correctly rejects it as `invalid_candidate`. The price amounts are supported, but their representation violates the contract. These two failures require a valid supported currency decision or a valid omission, not weaker validation.
- Wacken #1: General returns `duplicate` during refresh, despite identifying the supplied Event. The host correctly rejects this as `invalid_plan`. Constrain the decision to the invocation mode. This is a role contract failure, not evidence that the source identifies a different festival.
- Glastonbury #2: General selects a new 2025 historical Edition. Location returns `keep` for country and says GB is saved. The saved history actually contains a different 2027 Edition; the new 2025 target has no saved country. Editor repeats the incorrect saved-value assumption. The new Edition has no country and fails identity expectations. This is confusion about target state, not a missing country baseline: the input explicitly supplies GB and an official UK description. Clarify the target's existing state and keep/set rules.
- Sziget #1: Location omits country for the new 2027 Edition. It treats Budapest references as inconsistent metadata or visitor guidance, rather than proof of the edition location. Editor approves the omission. Tickets proposes supported prices but also full-programme and general-admission scope that Editor finds unsupported. Editor rejects the whole ticket group, so no base price is saved. The new Edition stays draft; the Event can still be published through the saved Edition. Review evidence collection and the scope of ticket claims before changing expectations.
- Wacken #2: Only the homepage is read successfully. Seven other page requests miss the fixed source set; Research does not read the linked 2027 ticket product. General therefore omits dates and Tickets omits prices. Location proposes DE from the baseline, but Editor rejects the location group because it has no evidence for the 2027 location. The new Edition stays draft. This is an evidence collection and review problem, not a host schema failure.

Glastonbury #1 passes the scenario but creates no 2025 historical Edition, so its historical year and country facts are absent. Sziget #2 passes with all required facts but no locality, venue, or address. Scenario success alone therefore hides missing additional facts.

The final run has no recurrence of the intermediate Reader empty-topic error, absent-slot specialist error, or unsupported Location evidence-ID error. Source fixture misses remain diagnostics. They are not separate factual errors and do not alone fail these main cases. They can still remove the evidence required for useful output. There is no live source fallback.

## Resources

| Measure | Before | Final after |
| --- | --- | --- |
| Experiment wall time | 275.6 s | 668.5 s |
| Page reads | 73 | 95 |
| Search calls | 31 | 30 |
| Native input tokens | 1,036,626 | 1,097,558 |
| Native output tokens | 59,167 | 223,553 |
| Available estimated cost, USD | 0.069827030 | 0.204152085 |

The following table sums native agent metrics by role. Model time is the sum of native model-duration values, not elapsed workflow time. Research waits for Reader tool calls, and branches can overlap; do not add role times to estimate wall time. Token totals include cached input and reasoning output. Cost annotations exist for all 26 before and 89 final-after total-input metric rows. These are available estimates, not a billing statement. Missing metrics would be unknown, not zero.

| Run | Role | Input tokens | Output tokens | Model time, s | Available estimated USD |
| --- | --- | --- | --- | --- | --- |
| Before | editor | 64,919 | 10,237 | 106.2 | 0.007975320 |
| Before | location | 43,260 | 6,375 | 69.6 | 0.004982640 |
| Before | research | 928,447 | 42,555 | 580.7 | 0.056869070 |
| After | classification | 81,587 | 4,689 | 67.7 | 0.012542425 |
| After | editor | 117,214 | 5,939 | 76.5 | 0.010433770 |
| After | general | 117,690 | 15,574 | 165.0 | 0.020635570 |
| After | links | 109,580 | 7,981 | 99.9 | 0.016775525 |
| After | location | 279,744 | 5,762 | 139.4 | 0.019284030 |
| After | reader | 162,409 | 150,289 | 1655.5 | 0.093471950 |
| After | research | 184,685 | 27,360 | 978.1 | 0.022448565 |
| After | tickets | 44,649 | 5,959 | 89.2 | 0.008560250 |

Reader accounts for about 46% of the available after cost. Input tokens rise by 5.9%, output tokens by 277.8%, and cost by 192.4%. Wall time rises by 142.5%. The measured split does not show a resource gain. Smaller input context per specialist is not sufficient. More role calls and longer evidence output can increase total cost, while collection can still miss relevant evidence. The architecture must preserve useful evidence and control total work across roles.

## Limits and next checks

All ten outputs are present in each main experiment. Each has 34 stored score rows: six completeness dimensions are intentionally N/A. No missing task output, scorer error, or storage write failure was found. Ordinary failed workflow reports remain part of quality results; they are not excluded as incomplete storage.

Two repetitions do not establish a stable performance estimate. Repetition numbers align case attempts but do not pair identical model randomness. These results apply only to the fixed main cases. Different prompt and scorer revisions also limit attribution to one implementation change.

The earlier trial `9b1a66bc-9f7a-4691-bec3-73278374da7c` has 0/10 scenario success and exposed the General root-schema defect, Reader array limits, missing Research questions, and invalid source references. The intermediate fixed trial `b2368153-e530-4a92-aa67-4bae8bb279cc` has 4/10 scenario success, 9/10 no checked errors, and estimated USD 0.16338445. It exposed empty Reader topics, absent-slot proposals, and unsupported Location evidence IDs. These trials are defect evidence only; neither is the final after comparison.

The intermediate Wacken #2 checked-error disputes do not recur in the final run. Its YouTube URL with a final slash exists in the fixed homepage, although the scorer accepts only the version without the slash. Its saved-Edition error concerns added open-air classification, not changed dates or country. Retain saved-record protection and review that source support. Do not count correction of an over-narrow URL expectation as extraction quality gained by the new design.

The final run includes the later absent-slot schemas, explicit Reader topic rule, Location guidance about geocoding, and provider retry/last-step capacity changes. The saved source revision does not establish the exact uncommitted file contents. Implementation remains work in progress: affected fixture repair, old shared fixture contract cleanup, baseline and quality work for affected regression groups, and spec synchronization remain open. The reported 770 passing code tests and other static checks do not replace failed model quality checks. Fix the role contract and target-state problems, repair comparable regression evidence, and repeat the main comparison before a readiness decision.

Evidence was read from saved Mastra SQLite results and correlated native DuckDB metrics and spans. Local snapshots are `/tmp/eventroam-source-evidence-baseline-comparison.json`, `/tmp/eventroam-source-evidence-after-comparison.json`, and `/tmp/eventroam-source-evidence-final-comparison.json`. Original experiment results remain unchanged.

## Additional regression runs

The separate regression run uses `openai/gpt-6-luna`, medium reasoning and the standard tier. Editor passes 2/7 in experiment `087d536c-ea66-4e76-9d38-f5a3dbb4f91c`. Direct Location passes 10/13 in experiment `c70cbc67-cf2e-4bb1-8f61-a902cfedeadf`: completion 2/4, correction 5/6, preservation 3/3. No baseline for these affected groups was run in this session. Do not combine these scores with main or treat them as a measured regression from an earlier result.

Editor fixtures inject domain proposals after live model collection. Their evidence binding assigns all available topic-packet IDs to each proposal. This does not preserve the old fixed handoff context. For example, the recovered-website proposal cites only the unrelated Australian site's evidence; Editor correctly rejects the proposed UK website and description. Other cases miss the supplied ticket or date pages, or combine supported offers with unsupported claims about blocked pages. The 2/7 result therefore includes fixture and collection changes and cannot measure Editor quality alone. Rebuild explicit, relevant evidence support before changing expectations.

All three failed Location attempts return structurally valid output. Building-complex queries `León, Spain`; several-venues queries `Cascais, Portugal`. The fixed geocoding inputs support other equivalent locality spellings, but not these requests, so they return simulated `unavailable` and the model leaves coordinates absent. The old initial preparation automatically supplied a forward venue result; the new preparation performs only reverse lookup and lets Location choose forward queries. In cemetery-correction, the model receives a failed reverse request but never requests the forward result that identifies the saved point as a cemetery. Keeping the point is reasonable on that available context. These results do not show a host validation failure or how a real geocoding provider would respond. Review the intended source and provider context under the new path, retain point protection, and rerun these scenarios after fixture review.
