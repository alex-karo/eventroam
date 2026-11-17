# Proposal

## Why

An owner cannot ask ingestion to update only `Event.description`. Full refresh also checks shared links and two Edition roles. Current refresh excludes Event fields but still checks most facts for the selected Edition. Research and Reader can therefore spend time on facts that the owner does not need.

The owner needs to state which entities, Editions, and fields to research in an ordinary request. The catalog-assistant selects a shipped preset or builds a task list before submission. For example, a description-only refresh must collect material about the current festival format and leave the short description, Edition facts, and publication state unchanged.

## What Changes

- Let the catalog-assistant select a preset or build a typed scope object. Each task names one target and one or more fields. A shared research instruction is optional. The owner does not need to write structured input.
- Apply the same assignment from source research through Editor review and catalog changes. Skip specialists that have no assigned work.
- Make full/current shipped task presets with their existing field coverage. Keep CLI full/current options and the full default; custom objects enter through assistant, Studio, or job submission.
- Use string targets event, currentOrNext, and latestCompleted. Selection of a saved Edition by ID is deferred.
- Use the same rules for creation, publication, source recovery, and independent Event work in every refresh. Current can recover a needed official source. Full can update Event facts without a usable Edition.
- **BREAKING**: Generate report version 8 with the effective scope and target outcomes. Keep version 7 history readable with its original meaning.

The owner has accepted typed tasks, presets, and shared execution rules. Scope contains no separate effect controls. The report transition is part of the proposed solution.

## Requirements

- The owner can request specific Event and Edition fields. The assistant selects full/current or builds a custom task list. Tasks use standard field rules unless an optional instruction adds detail.
- Task targets are the strings event, currentOrNext, and latestCompleted. Target references use no request IDs or list positions. Resolved Edition targets stay fixed. Tickets and links.tickets require currentOrNext. Saved-ID selection is deferred.
- The same assignment controls the whole agent chain and catalog changes. Unassigned specialists and geocoding do no work. Source recovery serves assigned work; supporting context grants no write permission.
- Only assigned facts change. Edition creation and publication follow shared catalog rules. Event work can proceed without an Edition, and unresolved work does not block independent supported changes.
- Optional tasks use facts found during assigned work without extra discovery. Missing optional facts do not make research partial; unfinished required work remains visible.
- Invalid or empty scopes fail before an attempt or external work with a useful error. The system does not silently remove or expand requested work.
- Jobs retain the submitted preset name or custom object. Each attempt records the scope it used, target outcomes, checks, and skipped work. Past reports remain readable.

## Acceptance criteria

- A description-only request works without owner-written structured input or any Edition. It changes no other field or publication state and does no temporal selection, ticket, link, location, or geocoding work. A ticket-link-only request needs no ticket price audit.
- A task without an instruction uses the standard field rules. A supplied instruction reaches every applicable stage unchanged. Blank supplied instructions fail validation.
- Invalid scope objects, non-string targets, and unsupported selectors, including saved-ID selectors, fail with an input path. They create no attempt or provider call. Invalid batch input creates no jobs.
- Several tasks can assign different fields to the same selector and use one fixed Edition binding. Reordering tasks preserves target associations and field keys. Repeated target/field assignments fail before research. Different selectors that resolve to the same Edition reject the whole item.
- Tickets and ticket links with latestCompleted fail before research without target substitution. The assistant explains that saved-ID research is unsupported and does not replace it with a temporal selector.
- Scope reaches the first Reader call and remains fixed through Editor and returns. Omitted description fields, link slots, and dependent fields keep their saved values. Grouped fields retain their existing complete-group rules.
- Each field in a task has a separate completion result. Missing optional size evidence causes no extra discovery or partial status. A completed interpretation leaves an unfinished required source check visible and research partial. Description and shortDescription checks remain distinct.
- An unresolved Edition can coexist with an accepted Event description. Identity or country conflicts, scope violations, and invalid final proposals preserve all catalog, audit, and receipt state.
- A selected target can reuse a saved Edition or create a supported Edition if the assigned facts meet existing creation rules. Missing fields are not added. Accepted assigned Editions use normal publication rules; Event-only refresh preserves publication state. Preview and republish controls still apply.
- Any refresh can recover an official source when assigned work needs it, within existing discovery limits. Recovery alone grants no website write. Full can save supported Event facts without a usable Edition. Current with no usable target makes no catalog changes and reports absence or unresolved work.
- Full/current retain field coverage and existing guards under the shared rules. Add retains its existing results, including its Edition prerequisite. Assistant, Studio, and job submission accept custom scope and presets; CLI options and add input remain unchanged. Existing submission limits and unknown-outcome handling still apply.
- A queued preset uses the definition available when each attempt starts. A queued custom request keeps its submitted tasks, fields, optional instructions, and required values through restarts and retries. Missing instructions remain omitted. Each attempt keeps its effective definition fixed; temporal selectors use execution-time facts.
- Version 8 reports show the effective scope, bound/absent/unresolved/not-run targets, skip reasons, and separate collection and interpretation results. Version 7 retains its original meaning; unsupported report versions fail explicitly.

## Impact

Owners can request a narrow refresh through assistant or Studio. The change affects ingestion input, agents, review, catalog preparation, durable jobs, reports, and their evaluation and SQL consumers. Existing catalog operations and record schemas remain the write boundary; no catalog content migration is needed.

Current behavior is described in the [ingestion process](../../../docs/ingestion-process.md), [ingestion tools](../../../docs/ingestion-tools.md), and [source reader](../../../docs/source-reader.md) guides, with exact contracts in code and tests. Behavior outside this scope remains unchanged. Implementation choices and focused checks are in [design.md](design.md) and [tasks.md](tasks.md).

Cost comparison uses the same sources and model. This change adds no separate cost accounting system and promises no fixed percentage reduction.
