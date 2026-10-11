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

The full five-case set was not rerun after those last prompt fixes. Do not present the mixed runs as a paired 5/5 result. Wrong-year remains close to the 300-second deadline; the extra agent still increases latency/cost.

Raw evidence (large details kept separately): [baseline](baseline.json), [initial editor run](after-initial.json), [first targeted fixes](after-corrections.json), [paired run after main](after-main.json), [final two-case follow-up](final-targeted.json).

One run per case is a smoke check, not statistical evidence. Follow-up runs are explicitly separate rather than substituted into the paired score. Model costs are known provider subtotals, not guaranteed total service charges. Captured pages replay locally, with no live website/search fallback; model generation is live. The baseline predates main's size contract; these five cases do not assess participant-size semantics.
