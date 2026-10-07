import { durationDays } from "@/features/discovery/model/discovery";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";

const format = (date: string) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const month = (date: string) =>
  new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

export function ResultsList({
  results,
  selectedId,
  error,
  onSelect,
  onClear,
}: Readonly<{
  results: DiscoverySummary[];
  selectedId: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}>) {
  return (
    <section className="list-region" aria-label="List results">
      {!error &&
        (results.length ? (
          <ul className="edition-list">
            {results.map((edition) => {
              const name =
                edition.name ?? `${edition.eventName} ${edition.year}`;
              const place = [
                edition.venueName,
                edition.locality,
                edition.administrativeArea,
                edition.countryCode,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <li
                  key={edition.id}
                  className={
                    selectedId === edition.id ? "selected-edition" : ""
                  }
                >
                  <div className="edition-date" aria-hidden="true">
                    <span>{month(edition.startsOn)}</span>
                    <strong>{Number(edition.startsOn.slice(-2))}</strong>
                  </div>
                  <div className="edition-body">
                    <a
                      className="edition-name"
                      href={editionPath(edition.eventSlug, edition.key)}
                    >
                      {name}
                    </a>
                    <span className="edition-place">
                      {place || "Location not announced"}
                    </span>
                    <span className="edition-meta">
                      <time dateTime={edition.startsOn}>
                        {format(edition.startsOn)}
                      </time>
                      {edition.endsOn !== edition.startsOn && (
                        <>
                          {" "}
                          –{" "}
                          <time dateTime={edition.endsOn}>
                            {format(edition.endsOn)}
                          </time>
                        </>
                      )}{" "}
                      · {durationDays(edition.startsOn, edition.endsOn)} days
                      {edition.capacityEstimate !== null &&
                        ` · Est. ${edition.capacityEstimate.toLocaleString("en")} people`}
                    </span>
                    <span className="edition-statuses">
                      {edition.dateState === "provisional" && (
                        <span>Tentative dates</span>
                      )}
                      {edition.ticketAvailability === "sold_out" && (
                        <span>Sold out</span>
                      )}
                      {(edition.latitude === null ||
                        edition.longitude === null) && <span>Not on map</span>}
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
