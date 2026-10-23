# Proposal

## Why

<!-- Explain the requested outcome and why it matters. Use a concrete before/after
example when useful. -->

## What Changes

<!-- Describe capabilities, modifications, or removals. Distinguish requested
outcomes and existing contracts from significant newly proposed guarantees. -->

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Name each capability for a cohesive system
     behavior that can own related requirements as the system evolves. Do not name
     implementation tasks or proposal sections. Avoid broad catch-all names. Use
     kebab-case for path segments you introduce (e.g., user-auth or identity/user-auth)
     that follow the project's existing spec organization. Each creates
     specs/<capability-path>/spec.md. -->
- `<capability-path>`: <brief description of what this capability covers>

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use the exact existing path under openspec/specs/. For each capability, describe
     only the behavior that changes. Usually use one short sentence per Before/After
     bullet. Base Before on the main spec and note any known difference from the
     implementation. Leave detailed conditions and scenarios in the delta spec.
     Leave empty if no requirement
     changes. A change with no capabilities at all (pure refactor, tooling, docs)
     must set `skip_specs: true` in its .openspec.yaml - openspec validate rejects
     a zero-delta change without that marker. Do not invent a requirement just to
     satisfy validation. -->
- `<existing-capability-path>`:
  - **Before**: <current behavior from the main spec>
  - **After**: <proposed behavior>

## Impact

<!-- Affected code, APIs, dependencies, systems -->
