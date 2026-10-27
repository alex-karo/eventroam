# Synthetic source regressions

These fictional cases isolate failures observed in the ten-festival run. They are scenario reproductions, not snapshots of the original pages. They run through research, editor and writer with fixed sources; no live website/search fallback. No depth checks are included.

| Case ID | Expected behavior |
| --- | --- |
| `source-known-offers-blocked-checkout` | Retain two published, qualified offers despite unavailable checkout/extras. Keep base price unknown because neither offer covers the full programme. Never guess a currency for `$615.35` or infer available, sold-out or closed availability. |
| `source-stale-language-other-programme` | Use current Student dates and booking link; preserve confirmed dates and their confirmed state. Do not borrow archived English prices or prices from the separate International programme. Report the incomplete current booking render. |
| `source-homonym-wrong-saved-website` | Recover the Castlewellan festival from a wrong Australian namesake link. Correct the official website and add the supported address, preserving country and dates. |

Run a model case with `npm run catalog:eval -- --case CASE_ID --repeat 3`. Review saved results in Mastra Experiments.
