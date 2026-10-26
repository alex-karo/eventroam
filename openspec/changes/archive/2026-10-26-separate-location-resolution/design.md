# Design

## Change size

Large. This change adds one agent, initial forward and reverse geocoding, and one external agent tool. It changes field ownership, plan preparation, reports, and observability. It removes accounting columns from private run history. Catalog storage fields and publication rules stay the same. The main risk is a plausible but wrong venue or point, which structural validation cannot detect.

## Approach

Use the three-agent sequence agreed in the [proposal](proposal.md). Research collects source facts. The editor accepts the festival and Edition targets and prepares non-location actions. Code prepares initial geocoding results. Location then assesses the supplied context and prepares all location actions for the accepted targets. Code combines the disjoint plans and calls the existing writer once.

For example, research may report a move from venue A to venue B. Location assesses the venue, address, and point together. If B is established but no venue point is found, it can replace a disproved A point with a supported city fallback while leaving B's precise location unresolved. If no applicable replacement exists, it can clear the disproved point. A failed geocoding query alone never clears anything.

The behavior contract is in [location resolution](specs/catalog/location-resolution/spec.md). The shared writer remains the only catalog write path. No agent messages another agent.

## Contracts

### Research and editor

Keep the existing keyed research findings for `venueName`, `venueAddress`, `locality`, `administrativeArea`, `countryCode`, and opportunistic `coordinates`. Research keeps the current source summaries. Its instructions must retain Edition-specific location changes, withdrawals, and several venues in those findings or summaries. Do not require a second research pass or a complete investigation of precise points.

Remove these six fields from the editor action schema and acceptance resolver. The editor still receives them as identity context. It owns Event fields, Edition creation or omission, dates, status, name, tickets, size, and classification. A location-only finding still permits an editor plan with an accepted Edition key and empty non-location actions. New Edition plans still need their creation reason.

Validate the editor plan before Location. A rejected or invalid plan stops the item. Declined Event creation and duplicate add skip Location. A null Edition slot stays null. If neither slot is accepted, skip Location and keep any valid full-scope Event actions.

### Location input

One assignment contains both named slots. Supply accepted Edition keys, final dates, and schedule status, together with all relevant location findings, saved location fields, festival identity and format, source summaries, saved history, scope, frozen date, and country baseline. Include initial geocoding results and available editor identity and slot decisions and explanations, including declined slots as context. Pass the full bounded Editor `unresolved` array as `editor.unresolved`, without filtering or merging Research questions. Questions can omit field or Edition labels. They are context, not actions, and Location need not copy them to its output. Keep the separate Event and accepted-slot reasons. Do not invent a reason when the editor supplied none. The editor no longer accepts or rejects individual location fields. Its complete rejection skips Location, and a declined slot cannot become a Location target. Unrelated ticket, size, and classification actions are not location context.

Location uses the supplied source summaries and explains its decisions without returning source URLs or source IDs. Supplied summaries remain in the input and report; there is no separate association between each Location decision and a source. Research findings and summaries must retain the target Edition context.

Keep point references in one in-memory `Map` for the Event assignment. Register supplied coordinate findings as source points, saved target coordinates as target points, eligible historical coordinates as donor points, and forward geocoding results as candidates. Historical donor selection reuses the diagnostic command's conservative chronology rules: select a unique latest earlier Edition with a point, or expose no default donor when chronology is ambiguous. The donor is not the `previousEdition` role by definition.

Saved points have the actual stored precision and version. Their factual provenance can be unknown; do not invent it. For each accepted slot, calculate Haversine distances from supplied source points and geocoding candidates to its saved target point and default donor, when present. Geocoding results include these comparisons. Do not build an all-pairs distance table, a separate registry service, or a registry lifecycle. Do not bias searches toward old coordinates.

### Initial geocoding

After editor validation and before the Location model call, prepare two request directions for each accepted slot. Reverse geocode its saved target point, or its default donor when no target point exists. Skip reverse when neither exists. Forward geocode the new location description from Research, or the saved description when no new description is available. Do not append an old address to a newly reported venue. An explicitly withdrawn field is not an absent finding and must not silently fall back to its saved value. This query input is a search hint, not a final accepted place block; Location receives the original findings and saved values separately.

Group identical requests across the Event before execution. Use coordinates for reverse identity and normalized query text plus country for forward identity. Collapse whitespace for query normalization; do not treat different names or spellings as equivalent. Each unique initial request is executed once and its result is attached to every relevant slot. Equal old points and equal descriptions usually need one reverse and one forward request. Distinct inputs can require up to four initial requests for two slots. Initial calls and agent calls share the same six-call bound, cache, deadline, cancellation, and point map. Sharing an already prepared result with another slot is not another call.

Reverse geocoding provides nearby place and address context for the old point. Retain the input coordinates, returned object type and label, and available provider distance. The returned address can be near the point rather than contain it; returned coordinates can differ. Do not register those returned coordinates as selectable replacement points. A nearest building does not prove a venue match, mapping error, or precision increase. No Place Details API or reverse agent tool is needed. Location retains only the forward `geocode` tool for useful follow-up queries, including alternative spellings when initial results are unsuitable.

### Location output

The following sketch shows the important choices. Final wire schemas must follow the existing structured-output conventions.

```ts
type CoordinateDecision =
  | { action: "keep"; reason: string }
  | { action: "inherit"; donorPointId: string; reason: string }
  | { action: "select"; pointId: string; precision: Precision; reason: string }
  | { action: "clear"; reason: string };

type LocationSlot = {
  fields: LocationTextActions;
  coordinates: CoordinateDecision;
  unresolved: LocationQuestion[];
};

type LocationPlan =
  | {
      status: "ready";
      previousEdition: LocationSlot | null;
      currentOrNextEdition: LocationSlot | null;
    }
  | { status: "rejected"; reason: string };

type LocationOutput = { decision: LocationPlan };
```

`LocationTextActions` requires an explicit `keep`, `set`, or `clear` action for each of the five location text fields. Each action includes a reason. `keep` preserves the saved field. `set` supplies a supported value. `clear` explicitly removes a disproved value. For a new Edition, `keep` leaves an absent field unset and coordinate `keep` means no point. Clearing absent data is invalid. If a target has no point and its donor is disproved, return `keep` with the reason for not inheriting and an unresolved coordinate question. This leaves the target point absent. A missing text action is invalid output.

Use the required object root `decision` with a nested ready-or-rejected union. Reuse the shared `modelOutputSchema` helper. Do not flatten this union into the root or add omitted-text normalization. The rejected branch has only its status and reason; it needs no empty Edition slots. Other optional metadata must still follow the shared structured-output conventions.

`keep` never copies from history. `inherit` copies the registered donor values and precision exactly. `select` resolves a supplied source point or geocoding candidate by ID; the agent cannot return numerical coordinates. Reject precision upgrades unsupported by the kind of point. Inheritance cannot improve precision. A city result stays `locality`, and a region result stays `region`. A venue result is not automatically `exact`.

`select` can also reference the same Edition's saved target point to correct an overstated precision. This requires evidence and a reason. Keep both coordinates unchanged and allow only a lower precision in the order `exact`, `approximate`, `locality`, `region`. Use `keep` when precision is unchanged. Reject a precision increase or selection of another Edition's saved target point. Historical copies still require `inherit` and its donor checks. A precision correction does not make a disproved point applicable.

When assigning precision, `exact` means a confirmed venue point. `approximate` means an approximate point for a specific venue. `locality` means a settlement point, and `region` means a regional point. These values describe what the point represents, not provider confidence. Keeping an old precision does not claim fresh confirmation.

Uncertainty is separate from the action. It can accompany `keep` or an explicit clear of an already disproved point. A Location slot must exist for each accepted editor slot, even when it only preserves values. It cannot introduce a new slot or Event action. Location output does not repeat Edition keys: code binds each named slot to its accepted input key, including unresolved questions. Location input omits the constant editor status because only a validated ready editor plan reaches Location; available Editor explanations remain.

### Reports and settings

Use report version 7. Add `locationResponse`, `locationStatus` (`success`, `rejected`, `failed`, `not_run`), a Location prompt version, and selected model settings. Retain bounded initial forward and reverse observations, actual agent tool calls, and the referenced point registry so decisions remain understandable after exit. Identify the request direction, initial or follow-up origin, and slots sharing its result. Do not invent agent tool calls for initial code execution. Point records include their kind, coordinates, precision, provider or donor identity, and available distance comparisons. Keep these private.

Remove the application-owned usage block, token totals, cost totals, search cost estimates, and accounting-completeness flags from version 7. Keep duration, budget settings, selected stage models, and an optional real trace ID. Move the existing budget snapshot to `report.budget`, retaining search, page, and model-call counters, elapsed time, and remaining limits. The evaluator uses search counts to check tool policy even without tracing. Studio still exposes read and search counts from this snapshot. Keep geocoding attempts, cache hits, and failures as decision diagnostics, without billed-cost claims. Preserve research status when Location later fails. Update CLI, Studio, run readers, and evaluations together. Unsupported historical report JSON remains unchanged and is rejected by current consumers.

Use existing Mastra Observability for available durations, tokens, and cost metrics. Attach Research, Editor, Location, and their tools to the same execution trace. Keep stage identity separate from model identity. Cost metrics are estimates or provider-reported observations, not a spending ledger. Do not add a usage aggregation helper or read metrics back to build the report. Missing or failed observability leaves metrics unavailable and does not block ingestion.

Keep `CATALOG_TRACING` optional and off by default. When enabled, allow tracing for apply, dry-run, and evaluation executions. Remove the blanket dry-run and injected-dependency tracing exclusions. Evaluation cases retain their own run and trace correlation; mocked calls must not invent tokens or costs. Keep all existing trace content exclusions. Fixture assertion rules and experiment persistence stay unchanged.

Pass the evaluation report destination into the existing observability path protection. Tracing must not create or overwrite that destination. Reuse the current collision checks rather than add another file guard.

Remove shared `ModelUsage` accumulation, accounting-completeness bookkeeping, and duplicate token and cost fields in application logs. Remove search spending estimates and accounting fields from the search adapter and tool output. Retain native model metrics, budget and step counters, source candidates, retrieval times, and search recovery behavior. Search-provider charges may remain unknown; do not add a replacement estimator.

Migrate private `ingestion_runs` storage to remove `input_tokens`, `output_tokens`, `model_cost_usd`, `search_cost_estimate_usd`, and `usage_complete`. Keep `duration_ms`, run identity, status, and final report. Preserve existing rows and report JSON without backfilling metrics. The report alone no longer answers token or cost queries; inspection uses local observability when available.

Add `CATALOG_LOCATION_MODEL`, falling back to the existing configured model. This allows a separate model evaluation without imposing a new model choice. Reuse existing credentials and reasoning settings. `GEOAPIFY_KEY` is optional at run start. If it is absent, `geocode` returns a bounded unavailable result; Location can still use source or saved points. Document this behavior in `.env.example` and the ingestion guide.

### Evaluation results

Keep the existing Mastra `runExperiment` wrapper for fixture setup and cleanup. Save its per-item result envelope with `output`, `error`, and `scores`. Put one real ingestion report under `output.report`, alongside captured tool calls and the existing `CaseScore` assertion details. Keep case identity, repetition, fixture provenance, and experiment metadata without copying report fields to the item root. Compute the assertion details once from the real report; existing Mastra scorers expose their dimensions. Do not add another result-normalization layer or a compatibility reader for the old flat format.

A returned report with `outcome: failed` remains valid task output and is scored against its fixture. Preserve an available report from `RunPersistenceError` through the existing failure-report helper. An exception without a report uses the native item `error` and null output; do not manufacture a report or a passing score. Pass only bounded safe failure details to the experiment and exclude raw exception messages, stacks, and transport data from the saved error fields.

Save all item results returned by a completed experiment, including task and scorer errors. Update the CLI to read the nested report and assertion details. A task error, scorer error, missing required score, or failed case makes the command exit nonzero after writing the artifact. Execution success alone does not mean the case passed. Preserve all valid sibling results. Existing fixture expectations, scoring rules, concurrency, and experiment persistence settings stay the same.

### Isolated Location evaluation

Add `catalog:eval --location-only`, separate from the default ingestion evaluation and mutually exclusive with `--editor-only`. Reuse case selection, repetitions, model configuration, and the experiment runner. Call the same initial preparation and Location executor directly with a complete saved input: accepted targets, dates, festival context, research summaries, available editor decisions and reasons, saved history, and registered source points. Do not run Research, Editor, the workflow, or the catalog writer.

The model makes the Location decision. Initial forward and reverse requests and follow-up calls use captured, normalized client results through the same cache, limits, and point registration as normal execution. The client boundary exposes candidates or bounded errors; HTTP bodies and provider parsing stay inside the Geoapify adapter and its tests. The top-level case geocoding records serve all evaluation modes. They make no live provider requests. Check the decision and materialized coordinates and precision without a database. Injected final Location results remain integration-test inputs; they do not measure agent quality. Save real Location output, initial request observations, tool calls, and scores in the native experiment envelope without creating an ingestion report. Keep the same failure and exit-status rules as ingestion evaluation. Isolated Location fixtures require the complete Location input but do not require catalog seed data or page sources. Pipeline fixtures still require both. Keep explicit catalog seeds only in Location cases reused by workflow integration tests. Document the mode in `docs/development.md`.

If an initial or follow-up request matches no fixture, return a bounded geocoding error with code `fixture_miss`, using the tool's error result for agent calls. Do not return an empty candidate list or make a live request. Retain the error in the corresponding request observation or tool call and fail the evaluation case even if Location later returns a valid plan. Save available output and valid sibling results before exiting nonzero. A recorded empty provider response remains a successful no-match result; a recorded provider failure remains an input for testing error handling.

Label cases as missing-point completion, known-error correction, or correct-old-point preservation. Report the existing assertion and score results separately for each group. Positive completion and correction cases must require the expected final point or precision; returning keep for every case cannot pass them. Preservation cases must detect unwanted changes. Include city fallback, correction with Research context, and preservation of applicable saved points. Do not claim an accuracy level from a combined score or add a second scoring framework.

### Deferred standalone command

A standalone Location command is deferred. Coordinate updates in this change use normal ingestion with Research and Editor. The earlier `catalog:geocoding-check` research command and its analysis code are removed. The isolated `--location-only` evaluation remains in scope; it does not write to the catalog.

## Architecture

```text
research + saved catalog
          ↓
validate research → editor → validate editor actions and targets
                                      ↓
                       shared initial reverse + forward
                                      ↓
                         Location for accepted slots
                         ↕ geocode + point registry
                                      ↓
                      validate and combine both plans
                                      ↓
                  prepare operations and publication once
                                      ↓
                        existing atomic catalog writer
```

Add the Location contract, prompt, input projection, initial request preparation, agent execution, and tests under `src/ingestion/location/`. Put shared geocoding code under `src/ingestion/tools/geocode/`: `geoapify.ts` for forward and reverse HTTP and response normalization, `contracts.ts` for direction-specific request and result schemas, and `tool.ts` for the forward Mastra tool and shared Event cache, call limit, and point registration. Initial preparation and agent calls use the same runtime resources. Follow existing agent and source-tool patterns. Keep runtime resources outside serializable workflow state. Use one Geoapify client without a provider factory or a generic provider interface.

Split `editor/prepare.ts` at its real boundary. Today `prepareEditorPlan` validates actions, resolves acceptance, creates operations, and decides publication in one call. Keep a validated intermediate plan before operations. Editor validation owns target creation and classification checks; Location validation owns country and location checks. After Location, verify matching slots, combine both owners' normalized actions, and run operation and publication preparation once without repeating Editor validation. Do not append a second update to already prepared Edition operations.

Add an explicit Location workflow phase after editorial validation. It prepares initial geocoding before calling the agent. Extend `IngestionData`, dependency injection, `attempt.ts` finalization, reports, traces, and Studio summaries for both parts. The agent returns actions; it has no database tool. Two strict schemas reject actions outside each owner's fields. Validate matching targets and combine normalized actions directly; no general field-owner registry or conflict engine is needed.

## Key decisions

### Own the whole place

Location owns venue text and coordinates together. This removes the need for an intermediate model of an editor-approved venue. It must assess the assembled final block, including fields that would otherwise be kept. It can clear an old address when supplied evidence establishes that the address belongs to a superseded venue. It must not guess a replacement address.

The existing country guard still constrains both research and final actions. A new geocoder result cannot authorize a country change. Missing text alone preserves saved values. Explicit evidence that a saved field is incompatible can support its clear. The final location decision explains such clears.

Location assesses factual support and compatibility. Code checks schemas, point references, accepted slots, allowed precision, and catalog rules. It does not independently prove what a source means or whether a point is the venue. Prompt cases and the offline evaluator check those model decisions.

### Prefer old points without certifying them

Prefer supplied coordinates that the festival's official site explicitly identifies as the target Edition's venue point, unless supplied evidence gives a concrete reason to reject them. Evidence that they refer to another Edition, another object, an outdated venue, or conflict with other established facts can defeat that preference. These coordinates can replace a saved point or historical donor without a confirmed move or proof of an old mapping error. Distance from an old point or locality centre, failed geocoding, no venue match, or locality-only results do not alone disprove the site's venue point. Retain material unexplained discrepancies in unresolved; they do not by themselves prevent selection or require lower precision. This uses supplied context, without another web investigation.

Otherwise preserve an applicable target point; then consider a historical donor; then use a supported supplied or geocoded point. A demonstrably better-supported correction can replace an old point. A move, a known old mapping error, or a point tied to a withdrawn venue can make an old point inapplicable. Distance alone cannot do that.

The default donor can be used provisionally when no supplied evidence contradicts continuity. Its reason must say that it was inherited rather than freshly verified. Preserve its precision. A known coarse point can remain as such while an unsuccessful refinement stays unresolved. Do not replace a specific old point with a city fallback merely because the fallback is newer.

If no better applicable point is available, Location can select a supported city result with locality precision even when a specific venue is named. This keeps the Edition available on the map while the venue point remains unresolved. If no applicable saved, donor, source, or venue candidate exists and the locality is established, use remaining geocoding calls to query the locality with its administrative area and country, without the venue name, before leaving the point absent. Do not repeat an equivalent completed query or exceed the existing call limit. The city must apply to that Edition; several unrelated towns do not justify an arbitrary fallback. A locality result is not a resolved venue and does not outrank an applicable specific old point.

Open-air context does not prohibit a central city park. A result whose object type is a city does not establish a venue. Name matches, provider confidence, and short distances are clues rather than proof. Several venues require a supported primary location before selecting one point; do not average them or choose the nearest to history.

### Use one bounded Location assignment

Both accepted Editions are assessed together. They may select the same registered candidate if evidence supports its applicability to each. A tentative result for one slot does not become a new privileged historical donor for the other. This avoids a sequential dependency and additional agent calls.

Location has only the forward `geocode` tool. It has no page reading, search, reverse lookup, or write tools. It starts with initial geocoding results and can try a useful alternate query when those results are unsuitable or another spelling can help. If research supplies only Lisbon, it cannot discover Irmão through another web investigation. It may retain a Lisbon locality point while reporting the missing venue.

### Bound provider access and retain useful results

The client accepts forward query text with an optional country code, or reverse coordinates, plus a cancellation signal. Configuration supplies the key and shared deadline. Use only the fixed Geoapify search and reverse endpoints with no redirects or arbitrary parameters. The client has no catalog, history, agent, or file dependencies. Forward success contains zero to three normalized candidates with coordinates, public place ID, label, available address parts, country, object type, category, and confidence. Reverse success contains bounded nearby-place context with the input point and available provider distance. Missing fields stay absent. Normalize object types to venue or address, locality, region, or unknown; retain the original type. Confidence and reverse results do not define precision. Unknown forward types cannot establish venue precision.

Return a direction-specific success or a bounded failure code: unavailable, timeout, cancelled, rate limited, network error, provider error, or invalid response. Missing credentials return unavailable. Empty provider results are successful no-match results. Keep the client free of retries, caching, point IDs, and venue selection. Shared execution owns caching, call limits, and registration; the agent owns venue selection. Cache keys include direction: forward uses normalized query text and country; reverse uses latitude and longitude. Evaluation fixtures return normalized client results. Adapter tests cover provider parsing for each direction.

Use one shared Geoapify adapter. Keep forward country filtering explicit and disable implicit proximity bias. Use one counter capped at six calls per Event by default, covering unique initial reverse and forward requests and all later agent calls, including cache hits. Reuse of one prepared result across slots adds no call. Each uncached call makes at most one HTTP request, with automatic retries disabled. Location can make another useful explicit query within the remaining cap after a failure, or preserve values with an unresolved question. Limit Location to eight model steps and the remaining shared deadline. These defaults do not promise adequate search coverage. Transient provider failures can leave cases unresolved.

Use one Event cache for initial preparation and agent calls. Cache successful forward and reverse responses, including empty results; leave failures uncached so an explicit later forward call can try again. Reuse existing parsing and distance logic where practical. Do not import commands or file writes into runtime code. The adapter observes cancellation, bounded responses, and the shared deadline. Register forward candidates in the Event point map. Several slots may use one candidate only with a separate applicability decision for each.

Never expose the authenticated request URL, API key, or provider transport payload to agents, reports, logs, traces, or tool-output capture. Supply public provider and place identifiers instead. Keep permitted raw final model responses under the existing report rules. No new secret-scanning policy is needed.

### Make failure behavior explicit

A recoverable geocoding error in initial preparation or an agent call can lead to a valid Location plan with preserved fields and unresolved questions. Other supported changes can then proceed. A missing or invalid Location model result, explicit Location rejection, country conflict, or Event identity conflict stops the whole item. There is no fallback that applies unreviewed location findings or an editor-only plan after a failed required Location stage.

A valid explicit rejection returns Location status `rejected` with a `location_rejected` diagnostic that retains its reason. It does not enter the technical-error handler. The overall attempt remains failed and applies no changes. Isolated Location evaluations also fail and retain that reason. Malformed output, including an empty rejection reason, retains `failed` status with `location_failed`. Validation failures retain fixed application rule messages or bounded schema issue paths and codes in `location_failed`. Raw exception and provider messages are not copied. Technical errors keep their existing diagnostics.

For inheritance, retain the donor version and copied values. Recheck them through the existing writer `beforeApply` callback within the transaction, including when the donor receives no update. Combine this check with the refresh country baseline check where applicable. Keep existing target version checks. No new catalog operation or general dependency system is needed. Do not hold a database transaction open during model or network work.

## Simpler options

Adding `geocode` to research uses fewer stages. It also adds point selection to the low-cost model's broad assignment and leaves the editor responsible for checking coordinate choices. The user chose a separate stage to keep those tasks bounded.

A coordinate-only resolver requires somebody else to decide whether venue, address, and point remain compatible. Giving Location the complete block removes that extra handoff. Parallel editor and Location calls would spend work before the identity and slot decisions; serial execution is simpler. A shared evidence platform, agent messages, and per-Edition agent calls are not needed.

## Risks and validation

- **Wrong but plausible points:** Add offline cases based on Azucreira versus the cemetery, a bridge versus a fairground, city aliases, a building within a complex, and several venues. Keep completion, correction, and preservation results separate. Include a reverse result for a nearby building that cannot justify moving the old point or upgrading precision.
- **Stale place combinations:** Test a new venue with an old address and a disproved target point. Verify explicit supported clears and the absence of guessed replacements.
- **Wrong targets or inheritance:** Test null slots, current scope, distinct same-year Editions, ambiguous history, and a donor modified before apply. Reuse existing chronology tests where possible.
- **Over-broad rollback or unsafe fallback:** Test a valid unresolved Location result alongside a ticket update, then a malformed Location result and an identity rejection. Only the latter two prevent the whole write.
- **Cancellation and diagnostics:** Mock timeout, quota, missing key, and cache reuse in both directions. Verify shared initial requests, one HTTP attempt per uncached call, the shared deadline and call cap across preparation and agent work, report version, and private data limits.
- **Missing or misleading metrics:** Extend existing observability tests for distinct stage identities, real trace correlation, traced dry-run and evaluation calls, and failed metrics storage. Verify ingestion does not depend on metric availability and mocked calls do not claim usage. Test the private storage migration and report consumers without accounting fields.
- **Lost evaluation evidence:** Update evaluation and CLI tests for a scored report with a failed catalog outcome, a persistence failure with an available report, an exception without a report, and a scorer failure. Verify the saved artifact retains sibling results and safe errors, contains no copied report fields or fabricated reports, and yields the correct exit status.

Extend existing ingestion, editor, source, report, and Studio tests rather than creating another full pipeline. Before adding Location cases, extend the existing evaluator's fixture schemas and database seeding to retain saved coordinates and precision. Use the isolated mode to assess actual Location decisions with captured geocoding responses. Use injected Location results for workflow and writer tests, including final stored points. Run the integrated cases with prior ingestion cases again after workflow integration. An optional explicit live preview can compare model settings on the researched cases, but live calls and database corrections are not prerequisites for implementing this proposal.

Update the ingestion guide, project structure, development settings, and owning main specs when implementation is complete. Only private run history needs a storage migration; no catalog migration or compatibility adapter is required. Historical diagnostic reports remain research evidence and are not write inputs.
