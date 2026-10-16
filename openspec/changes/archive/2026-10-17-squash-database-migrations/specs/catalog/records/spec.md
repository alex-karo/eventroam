# Spec Delta

## REMOVED Requirements

### Requirement: Edition storage migration preserves catalog and history

**Reason**: The supported baseline already uses Edition names. Upgrades from the old Occurrence schema are no longer supported.

**Migration**: Recreate development databases from the new baseline. Keep any valuable old catalog in a separate backup outside the supported migration path.

### Requirement: Size migration preserves development catalog history

**Reason**: The supported baseline already stores `size_estimate`. Upgrades from `capacity_estimate` are no longer supported.

**Migration**: Recreate development databases from the new baseline. Keep any valuable old catalog in a separate backup outside the supported migration path.
