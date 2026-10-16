# Spec Delta

## REMOVED Requirements

### Requirement: Validation-boundary migrations preserve stored data

**Reason**: The supported baseline already uses application-owned validation. Upgrades from older validation-boundary schemas are no longer supported.

**Migration**: Recreate development databases from the new baseline. Keep any valuable old catalog in a separate backup outside the supported migration path.
