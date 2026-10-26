import type Database from "better-sqlite3";
import type { RegisteredPoint } from "./contracts";
/** Run inside the existing item transaction before any operation. */
export function assertLocationDonors(
  client: Database.Database,
  donors: RegisteredPoint[],
) {
  for (const donor of donors) {
    const current = client
      .prepare(
        "SELECT event_id,version,latitude,longitude,coordinate_precision FROM editions WHERE id=?",
      )
      .get(donor.editionId) as
      | {
          event_id: string;
          version: number;
          latitude: number;
          longitude: number;
          coordinate_precision: string;
        }
      | undefined;
    if (
      !current ||
      current.version !== donor.version ||
      current.latitude !== donor.latitude ||
      current.longitude !== donor.longitude ||
      current.coordinate_precision !== donor.precision
    ) {
      throw new Error("Location donor changed before apply");
    }
  }
}
