# Spec Delta

## MODIFIED Requirements

### Requirement: Model-proposed classification is edition-specific
Research SHALL associate a complete classification finding with a specific Edition, retaining unchallenged saved terms. The editor SHALL accept or correct the complete list. The host SHALL replace assignments only for that Edition, preserving sibling editions' classifications and assigning no classifications or defaults to the Event. An omitted classification field SHALL preserve current assignments.

#### Scenario: A later extraction omits a known term
- **WHEN** new evidence does not mention or refute a previously accepted genre
- **THEN** research retains it in any proposed complete list, or omits the classification field to preserve assignments

#### Scenario: Model removes an edition term
- **WHEN** research explicitly refutes an assigned term and editor approves a complete list excluding it for a specific Edition
- **THEN** the writer removes that assignment from that Edition only, preserving sibling editions' assignments
