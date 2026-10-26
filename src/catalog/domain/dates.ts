export function localToday(timeZone: string | null, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
}
export function durationDays(start: string, end: string): number {
  return (
    Math.round(
      (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
        86400000,
    ) + 1
  );
}

export function isPastEdition(
  edition: { endsOn: string; timeZone: string | null },
  now: Date,
): boolean {
  return edition.endsOn < localToday(edition.timeZone, now);
}
