# Synthetic source regressions

These fictional cases isolate failures observed in the ten-festival run. They are scenario reproductions, not snapshots of the original pages. They run through research, editor and writer with fixed sources; no live website/search fallback. No depth checks are included.

| Case ID | Expected behavior |
| --- | --- |
| `source-known-offers-blocked-checkout` | Retain two published, qualified offers despite unavailable checkout/extras. Keep base price unknown because neither offer covers the full programme. Never guess a currency for `$615.35` or infer available, sold-out or closed availability. |
| `source-stale-language-other-programme` | Use current Student dates and booking link; preserve confirmed dates and their confirmed state. Do not borrow archived English prices or prices from the separate International programme. Report the incomplete current booking render. |
| `source-homonym-wrong-saved-website` | Recover the Castlewellan festival from a wrong Australian namesake link. Correct the official website and add the supported address, preserving country and dates. |

The wrong-country variant is a deterministic workflow test in `../../source-regressions.test.ts`: saved IE versus researched GB blocks the entire operation before editor, including an otherwise supported website repair. A country conflict is not scored as failed research: the research can be correct while validation rejects the write.

Run a model case with `npm run catalog:eval -- --case CASE_ID --repeat 3`. Run offline checks with `npm test -- src/ingestion/evals/source-regressions.test.ts src/ingestion/evals/evals.test.ts`. Offline checks validate fixture loading, writer/scorer behavior and country rejection; they do not establish model success.
