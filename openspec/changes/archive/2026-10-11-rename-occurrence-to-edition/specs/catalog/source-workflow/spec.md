# Source-backed catalog workflow delta

## MODIFIED Requirements

### Requirement: Eval acceptance distinguishes host failures from expected research failure
Eval output SHALL preserve runId and available report data when finalization fails and SHALL identify safe host workflow/persistence failures. Those failures SHALL invalidate eval acceptance even when research/catalog outcomes are successful or a source-failure case otherwise meets expectations. New reports SHALL retain version 2 and use the active Edition contract. Reading/scoring historical reports SHALL NOT require compatibility adapters or conversion; those reports are unsupported and SHALL remain stored unchanged.

#### Scenario: A late workflow error follows useful research
- **WHEN** an eval report retains successful research and a non-failed catalog outcome but contains workflow_failed
- **THEN** the case fails eval acceptance and the command exits nonzero while retaining its facts, runId, and available statistics

#### Scenario: Eval finalization fails with an available report
- **WHEN** a persistence error carries the report and runId of a started eval attempt
- **THEN** eval output retains them with a safe run_persistence_failed error rather than replacing them with an empty model-failure report
- **AND** the case fails acceptance, the command exits nonzero, and the database row remains running

#### Scenario: Expected source failure also has a host failure
- **WHEN** a blocked-source case otherwise matches its expected failed research but contains workflow_failed or run_persistence_failed
- **THEN** it fails eval acceptance; expected source failure alone remains acceptable when all existing criteria hold

#### Scenario: Historical reports remain opaque storage
- **WHEN** the Edition rename updates active report/eval contracts
- **THEN** newly generated reports remain version 2 and use Edition operations/fields; old stored report JSON remains unchanged
- **AND** current consumers are not required to read or score old reports; no adapters or conversion are introduced

### Requirement: Research uses Mastra agent limits without a page-count cap
CLI and Studio research SHALL use Mastra iteration and generation-time limits instead of a separate ordinary model-call limiter and generation timer. Page reads SHALL have no count cap. Search/depth/size safeguards, the attempt deadline outside generation and existing retry policy SHALL remain. Counts and known usage SHALL remain reportable. Active reports SHALL use version 2 with Edition contracts; historical report reading is unsupported and SHALL NOT require conversion.

#### Scenario: Read beyond the old cap
- **WHEN** research reads additional pages within retained safeguards
- **THEN** page count alone does not stop retrieval or reject a candidate; prompts do not impose a replacement page target

#### Scenario: Agent exhausts its allowance
- **WHEN** Mastra exhausts research iterations or generation time without valid output
- **THEN** report limit_reached with known usage and still finalize the durable attempt
- **AND** initial reads, discovery and retry waits remain bounded by the attempt deadline
