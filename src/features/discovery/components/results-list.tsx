import { durationDays } from "@/features/discovery/model/discovery";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";

const format = (date: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export function ResultsList({
  results,
  selectedId,
  error,
  onSelect,
  onClear,
}: {
  results: DiscoverySummary[];
  selectedId: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="list-region" aria-label="List results">
      <h2>List</h2>
      {!error &&
        (results.length ? (
          <ul className="edition-list">
            {results.map((edition) => (
              <li
                key={edition.id}
                className={selectedId === edition.id ? "selected-edition" : ""}
              >
                <a href={editionPath(edition.eventSlug, edition.key)}>
                  {edition.name ?? `${edition.eventName} ${edition.year}`}
                </a>
                <button
                  type="button"
                  onClick={() => onSelect(edition.id)}
                  aria-label={`Show details for ${edition.name ?? `${edition.eventName} ${edition.year}`}`}
                >
                  Details
                </button>
                <p>
                  {edition.dateState === "provisional" && "Tentative dates: "}
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
                </p>
                <p>
                  {[
                    edition.venueName,
                    edition.locality,
                    edition.administrativeArea,
                    edition.countryCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  {!edition.venueName && " · Approximate location"}
                  {edition.latitude === null && " · Map location unavailable"}
                </p>
                {edition.capacityEstimate !== null && (
                  <p>
                    Estimated capacity:{" "}
                    {edition.capacityEstimate.toLocaleString("en")}
                  </p>
                )}
                {edition.ticketAvailability === "sold_out" && (
                  <p>
                    <strong>Sold out</strong>
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="notice">
            <p>No editions match these filters.</p>
            <button type="button" onClick={() => onClear()}>
              Clear all filters
            </button>
          </div>
        ))}
    </section>
  );
}
