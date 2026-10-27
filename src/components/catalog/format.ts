import type { PublicEdition } from "@/catalog/read/contracts";

export const scheduleStatusLabels = {
  cancelled: "Cancelled",
  postponed: "Postponed",
  announced: "Announced",
  scheduled: "Scheduled",
};

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function dateRangeParts(start: string, end: string) {
  if (start === end || start.slice(0, 4) !== end.slice(0, 4)) {
    return [formatDate(start), formatDate(end)];
  }
  const first =
    start.slice(0, 7) === end.slice(0, 7)
      ? String(Number(start.slice(-2)))
      : new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(new Date(`${start}T12:00:00Z`));
  return [first, formatDate(end)];
}
export function dateRange(start: string, end: string) {
  const [first, last] = dateRangeParts(start, end);
  return start === end ? first : `${first}–${last}`;
}
export function countryName(code: string) {
  return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
}
export function placeName(
  edition: Pick<
    PublicEdition,
    "venueName" | "locality" | "administrativeArea" | "countryCode"
  >,
) {
  return [
    ...new Set(
      [
        edition.venueName,
        edition.locality,
        edition.administrativeArea,
        countryName(edition.countryCode),
      ].filter(Boolean),
    ),
  ].join(", ");
}
export function basePrice(edition: PublicEdition): string | null {
  if (edition.priceKind === "free") {
    return "Free";
  }
  if (!edition.priceCurrency || edition.priceMinMinor === null) {
    return null;
  }
  const formatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency: edition.priceCurrency,
  });
  const divisor =
    10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
  const amount = (minor: number) => formatter.format(minor / divisor);
  const upper =
    edition.priceKind === "range" && edition.priceMaxMinor !== null
      ? `–${amount(edition.priceMaxMinor)}`
      : "";
  return `${edition.priceKind === "from" ? "From " : ""}${amount(edition.priceMinMinor)}${upper}`;
}
export function categoryPrice(
  category: PublicEdition["ticketCategories"][number],
) {
  if (category.amount === 0) {
    return "Free";
  }
  if (category.amount === undefined || !category.currency) {
    return "Price not available";
  }
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: category.currency,
  }).format(category.amount);
}
