# Spec Delta

## MODIFIED Requirements

### Requirement: Research stays within a shared run budget

Source reads, discovery, research, editing, Location, and geocoding SHALL share a bounded run budget and deadline. The system SHALL allow relevant follow-up pages while time remains without an independent fixed page-count or link-depth cap. Initial forward and reverse geocoding requests and agent geocode calls SHALL share one finite Event-level call limit. Agent calls SHALL count even on cache hits; sharing a prepared result between Edition slots SHALL NOT count as another call. Each uncached call SHALL make at most one HTTP request without automatic retries. All work SHALL observe cancellation. At a hard limit without a usable result, the system SHALL retain the limit reason, source-read history, and available model questions. Available usage metrics SHALL follow the optional observability contract. It SHALL NOT require or invent a complete list of unfinished checks. A budget limit SHALL NOT turn an unread source into a verified absence.

#### Scenario: A relevant linked page remains available

- **WHEN** a source links to a more specific ticket or announcement page and budget remains
- **THEN** research may inspect that page before returning findings

#### Scenario: The budget expires

- **WHEN** the budget expires before a usable final result
- **THEN** the run reports the limit with available diagnostics and makes no catalog changes
- **AND** no complete list of unfinished checks is required

#### Scenario: Geocoding reaches its call bound

- **WHEN** the configured geocoding call limit is reached
- **THEN** further tool invocations return the limit result without a provider request
- **AND** Location can return a valid preservation decision with the unfinished refinement question while time remains

#### Scenario: A geocoding request fails temporarily

- **WHEN** an HTTP request fails with a timeout, rate limit, or provider error
- **THEN** preparation or the tool returns a safe failure without an automatic retry
- **AND** Location can make another explicit call within the remaining call and time limits or return a valid unresolved decision

#### Scenario: Initial requests consume the shared allowance

- **WHEN** initial forward and reverse requests prepare context for two accepted slots
- **THEN** each distinct request consumes one call from the shared Event limit
- **AND** shared results consume no extra calls and later agent calls use only the remaining allowance

#### Scenario: Location reaches the shared deadline

- **WHEN** Location cannot return a usable final plan before the run deadline
- **THEN** the run retains the limit reason and available diagnostics without applying the editor plan alone

#### Scenario: The run is cancelled during geocoding

- **WHEN** the owner cancels an active run
- **THEN** active initial or agent provider requests stop and subsequent catalog writes do not start
