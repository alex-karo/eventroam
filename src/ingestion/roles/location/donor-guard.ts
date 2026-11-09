import type Database from "better-sqlite3";
import type { RegisteredPoint } from "./contracts";
/** Run inside the existing item transaction before any operation. */
export function assertLocationPreviousPoints(
  client: Database.Database,
  previousPoints: RegisteredPoint[],
) {
  for (const previousPoint of previousPoints) {
    const current = client
      .prepare(
        "SELECT event_id,version,latitude,longitude,coordinate_precision FROM editions WHERE id=?",
      )
      .get(previousPoint.editionId) as
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
      current.version !== previousPoint.version ||
      current.latitude !== previousPoint.latitude ||
      current.longitude !== previousPoint.longitude ||
      current.coordinate_precision !== previousPoint.precision
    ) {
      throw new Error("Location previousPoint changed before apply");
    }
  }
}
