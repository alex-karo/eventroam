import type { PublicEdition } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";
import { withDiscovery } from "@/site/discovery-context";
import { dateRange } from "./format";
export function EditionHistory({
  editions,
  currentId,
  token,
}: Readonly<{
  editions: PublicEdition[];
  currentId?: string;
  token: string | null;
}>) {
  const sorted = [...editions].sort(
    (a, b) => b.startsOn.localeCompare(a.startsOn) || a.id.localeCompare(b.id),
  );
  return (
    <ul className="edition-history">
      {sorted.map((edition) => {
        const repeated =
          editions.filter((item) => item.year === edition.year).length > 1;
        const name = edition.name ?? `${edition.eventName} ${edition.year}`;
        const label = repeated
          ? `${name} · ${dateRange(edition.startsOn, edition.endsOn)}`
          : `${edition.year}`;
        return (
          <li key={edition.id}>
            {edition.id === currentId ? (
              <span aria-current="page">
                {label} <small>Current edition</small>
              </span>
            ) : (
              <a
                href={withDiscovery(
                  editionPath(edition.eventSlug, edition.key),
                  token,
                )}
              >
                {label}
              </a>
            )}
            {(edition.status === "cancelled" ||
              edition.status === "postponed") && (
              <small>
                {edition.status === "cancelled" ? "Cancelled" : "Postponed"}
              </small>
            )}
          </li>
        );
      })}
    </ul>
  );
}
