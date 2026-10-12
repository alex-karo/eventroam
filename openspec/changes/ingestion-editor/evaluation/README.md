# Editorial ingestion smoke comparison

Five captured-source cases, one paired before/after run. The editor fixed justified address clearing, but the initial final-code comparison did **not** establish an overall quality improvement: 3/5 passed versus 4/5 expected behaviors in the baseline. Model time and known cost increased. Deadline exhaustion and overly conservative price handling lost valid writes without introducing forbidden writes.

| Case / expected write | Baseline actual | After main actual | Known model USD before → after | Seconds before → after |
| --- | --- | --- | --- | --- |
| wrong-year: Old 2026 dates preserved; new 2027 dates written | Created 2027; old dates preserved | No writes: editor deadline | 0.001837 → 0.003186 | 137.4 → 300.0 |
| day-ticket: Full-programme DKK 2,650, never DKK 1,530 day price | Created 2027 with DKK 2,650 base price | Created 2027 without known base price | 0.001544 → 0.002713 | 135.8 → 220.1 |
| clear: Clear office address; preserve saved country | Kept office address | Cleared office address; country preserved | 0.000994 → 0.001786 | 74.5 → 132.1 |
| unavailable: No writes without usable sources | Failed; no writes | Failed; no writes | 0.000430 → 0.000408 | 37.6 → 21.1 |
| valid-update: Apply supported 2027 dates | Created 2027 with supported dates | Created 2027 with supported dates | 0.002065 → 0.003157 | 124.9 → 219.5 |

Baseline was captured on `3783ef9` before contract changes; the post-main pipeline uses `d6bbe22` plus this change. Both use `openai/gpt-6-luna`, medium reasoning, a 300-second shared deadline and the existing fixture eval runner. Raw reports retain fixture hashes/provenance, limits, actual operations/changes, errors, accounting and timings.

The baseline's unavailable case expected partial incorrectly: actual failed/no writes is the required behavior. That expectation was corrected before after-runs. Original raw scoring remains unchanged (3/5); the corrected behavioral reading is 4/5. No other expected writes were relaxed.

Initial follow-ups prompted tighter unknown-versus-refutation instructions, office-address verification and exact Edition keys in questions. Final follow-ups retain readable known prices despite blocked checkout and instruct research to finish with partial findings after reasonable blocked checks. These are prompt fixes, not retries or correction loops inside ingestion.

## Final targeted follow-up

After the final price-preservation/completion prompt fixes, both previously failing cases passed in a separate run:

| Case | Actual required write | Known model USD | Seconds |
| --- | --- | --- | --- |
| wrong-year | 2027 dates written; saved 2026 dates preserved | 0.002958 | 244.6 |
| day-ticket | 2027 full-programme DKK 2,650 written; day price excluded | 0.002389 | 189.9 |

A later full five-case rerun passed 5/5 on the committed prompt fixes ([raw report](final-full-rerun.json)). Historical dates were also checked directly because review found bare forbidden assertions missed null clears. Known model subtotal was $0.010456 versus $0.006869 baseline (1.52×); per-case durations were 17.8–271.9 seconds. This is a separate smoke run, not a replacement for the original paired score.

Raw evidence (large details kept separately): [baseline](baseline.json), [initial editor run](after-initial.json), [first targeted fixes](after-corrections.json), [paired run after main](after-main.json), [final two-case follow-up](final-targeted.json).

One run per case is a smoke check, not statistical evidence. Follow-up runs are explicitly separate rather than substituted into the paired score. Model costs are known provider subtotals, not guaranteed total service charges. Captured pages replay locally, with no live website/search fallback; model generation is live. The baseline predates main's size contract; these five cases do not assess participant-size semantics.

## Review fixes and strengthened assertions

The three historical-date cases now explicitly forbid null clears as well as changed dates; required writes were not relaxed. Host fixes correct validation-rejection outcome, attribute editor validation separately in trace, and retain typed Edition patches.

The complete post-review run passed **3/5** ([raw report](after-review.json)). Wrong-year and valid-update both failed during editor generation with provider code 502 (HTTP envelope 200), with no operations or forbidden changes; research had completed with partial findings. These were provider failures, not timeouts or stricter assertion failures. The remaining three cases passed.

| Case | Pass | Seconds | Known model USD |
| --- | --- | --- | --- |
| editor-wrong-year | false | 174.7 | 0.002257 |
| editor-day-ticket | true | 238.9 | 0.002743 |
| editor-clear | true | 134.5 | 0.001730 |
| editor-unavailable | true | 31.0 | 0.000229 |
| editor-valid-update | false | 186.1 | 0.002406 |

A separate diagnostic rerun passed **2/2** for wrong-year and valid-update ([raw report](provider-followup.json)); it does not replace the full 3/5 result or add retry behavior to ingestion.

| Diagnostic follow-up | Pass | Seconds | Known model USD |
| --- | --- | --- | --- |
| editor-wrong-year | true | 285.7 | 0.002264 |
| editor-valid-update | true | 272.9 | 0.003518 |
