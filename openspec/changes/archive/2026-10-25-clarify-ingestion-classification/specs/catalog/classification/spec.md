## ADDED Requirements

### Requirement: Models share facet limits and event type guidance

Both models MUST receive the same facet limits. `gathering` MUST mean a main programme created through participants' contributions; community wording alone is insufficient. If both types fit, instructions MUST prefer `festival` when the organizer explicitly uses that name.

#### Scenario: A festival also describes a community gathering

- **WHEN** an organizer calls an Edition a festival with music, workshops, and a community gathering
- **THEN** both models receive guidance to use `festival` as its only event type

#### Scenario: The models receive assignment limits

- **WHEN** either model starts
- **THEN** its instructions limit `event_type` and `format` to one each, while `topic`, `genre`, and `culture` allow multiple terms

### Requirement: The editor resolves classification count conflicts

Editor instructions MUST prohibit accepting excess facet terms. They MUST direct supported corrections through a complete `set` with a reason; otherwise keep or omit classification and report uncertainty. The host MUST NOT select a type automatically. Invalid final lists MUST produce no catalog operations.

#### Scenario: Research supplies two event types

- **GIVEN** a research finding with both `festival` and `gathering`
- **WHEN** the editor supplies a supported complete list with `festival` as its only `event_type`
- **THEN** preparation uses the corrected list for that Edition, including its other terms

#### Scenario: Evidence does not resolve the type

- **WHEN** the evidence cannot support a choice between the proposed types
- **THEN** editor instructions direct it to keep or omit classification and report an unresolved question
