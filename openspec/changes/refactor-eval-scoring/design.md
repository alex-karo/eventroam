# Design

## Change size

Small. The change affects eval code, CLI presentation, and offline tests. It adds diagnostic lists to eval scores without changing ingestion report v5, fixture schema 2, stored catalog data, dependencies, or assertion semantics.

## Approach

Keep the existing matcher behavior, including partial object matching and null exclusions. Move mutation assertions, research checks, and expected-failure checks into focused modules. Keep aggregation in `score.ts`. Expected failures return named conditions so an unmet condition can be explained without another implementation of the acceptance rule.

The eval step computes its score once after ingestion finishes. Its internal output contains the ingestion result, captured tool calls, and score. Mastra scorers read that score directly. The runner uses the same output for its JSON projection. This removes scorer-time lookups of mutable call arrays and repeated scoring.

The score includes diagnostic arrays for correctness, completeness, research, and tool use. Required and forbidden checks remain distinct. Host failures and unmet expected-failure conditions explain both mutation scores when those scores are forced to zero. Research and tool-use explanations continue to describe their own checks. CLI prints failed diagnostic groups beneath each case. Scorer success messages remain presentation defaults.

Keep fixture loading, seeding, source replay, provider execution, and cleanup unchanged. Their broader extraction is outside this first step. The next reading path is `run case -> scoreCase -> check modules -> scored output -> Mastra / report / CLI`.

## Risks and validation

- Preserve null matching, expected-failure acceptance, missing annotations, and host-failure precedence with existing offline tests and focused regression assertions.
- Test both a research-only failure and a tool-use-only failure whose mutation scores are perfect.
- Use repeated cases to verify score and diagnostic isolation, and an adapter test to compare scorer explanations with the precomputed score.
- Run eval tests, type checking, lint, dependency checks, formatting, documentation checks, and OpenSpec validation. No paid model calls are needed.
