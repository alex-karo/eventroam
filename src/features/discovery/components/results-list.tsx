import { DateBlock } from "@/components/catalog/date-block";
import { durationDays } from "@/catalog/domain/dates";
import { placeName, dateRangeParts } from "@/components/catalog/format";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import { withDiscovery } from "@/site/discovery-context";
import { editionPath } from "@/site/site";

export function ResultsList({
  results,
  selectedId,
  error,
  onSelect,
  onClear,
  token,
  onNavigate,
}: Readonly<{
  results: DiscoverySummary[];
  selectedId: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  token: string | null;
  onNavigate: () => void;
}>) {
  return (
    <section className="list-region" aria-label="List results">
      {!error &&
        (results.length ? (
          <ul className="edition-list">
            {results.map((edition) => {
              const name =
                edition.name ?? `${edition.eventName} ${edition.year}`;
              const place = placeName(edition);
              const [first, last] = dateRangeParts(
                edition.startsOn,
                edition.endsOn,
              );
              const days = durationDays(edition.startsOn, edition.endsOn);
              return (
                <li
                  key={edition.id}
                  className={
                    selectedId === edition.id ? "selected-edition" : ""
                  }
                >
                  <DateBlock date={edition.startsOn} />
                  <div className="edition-body">
                    <a
                      className="edition-name"
                      href={withDiscovery(
                        editionPath(edition.eventSlug, edition.key),
                        token,
                      )}
                      onClick={onNavigate}
                    >
                      {name}
                    </a>
                    <span className="edition-place">
                      {place || "Location not announced"}
                    </span>
                    <span className="edition-meta">
                      <time dateTime={edition.startsOn}>{first}</time>
                      {edition.endsOn !== edition.startsOn && (
                        <>
                          –<time dateTime={edition.endsOn}>{last}</time>
                        </>
                      )}{" "}
                      ·{" "}
                      <span className="fact-duration">
                        {days} {days === 1 ? "day" : "days"}
                      </span>
                      {edition.sizeEstimate !== null &&
                        ` · Est. ${edition.sizeEstimate.toLocaleString("en")} people`}
                    </span>
                    <span className="edition-statuses">
                      {edition.dateState === "provisional" && (
                        <span>Tentative dates</span>
                      )}
                      {(edition.latitude === null ||
                        edition.longitude === null) && (
                        <span title="Map location unavailable">Not mapped</span>
                      )}
                      {edition.latitude !== null &&
                        edition.longitude !== null &&
                        edition.coordinatePrecision !== "exact" && (
                          <span>Approximate location</span>
                        )}
                    </span>
                  </div>
                  <button
                    className="edition-details"
                    type="button"
                    onClick={() => onSelect(edition.id)}
                    aria-label={`Show details for ${name}`}
                    aria-pressed={selectedId === edition.id}
                  >
                    Details
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="notice empty-results">
            <p>No editions match these filters.</p>
            <button type="button" onClick={onClear}>
              Clear all filters
            </button>
          </div>
        ))}
    </section>
  );
}
