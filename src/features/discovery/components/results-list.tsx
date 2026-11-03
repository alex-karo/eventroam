import { DateBlock } from "@/components/catalog/date-block";
import { Icon } from "@/components/catalog/icons";
import { durationDays } from "@/catalog/domain/dates";
import { placeName, dateRangeParts } from "@/components/catalog/format";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import { editionPath } from "@/site/site";

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
              const detailLabel =
                edition.name ?? `${edition.eventName} ${edition.year}`;
              const place = placeName(edition);
              const [first, last] = dateRangeParts(
                edition.startsOn,
                edition.endsOn,
              );
              const days = durationDays(edition.startsOn, edition.endsOn);
              const notMapped =
                edition.latitude === null || edition.longitude === null;
              return (
                <li
                  key={edition.id}
                  className={
                    selectedId === edition.id ? "selected-edition" : ""
                  }
                >
                  <button
                    className="edition-select"
                    type="button"
                    onClick={() => onSelect(edition.id)}
                    aria-label={`${notMapped ? "Select" : "Show on map:"} ${detailLabel}`}
                    aria-pressed={selectedId === edition.id}
                  >
                    <DateBlock date={edition.startsOn} />
                    <span className="edition-body">
                      <span className="edition-name">{edition.eventName}</span>
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
                      {(edition.dateState === "provisional" || notMapped) && (
                        <span className="edition-statuses">
                          {edition.dateState === "provisional" && (
                            <span>Tentative dates</span>
                          )}
                          {notMapped && (
                            <span title="Map location unavailable">
                              Not mapped
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                  <a
                    className="edition-open"
                    href={editionPath(edition.eventSlug, edition.key)}
                    aria-label={`Open page for ${detailLabel}`}
                    title="Open festival page in a new tab"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="new-page" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="notice empty-results">
            <p>No events match these filters.</p>
            <button type="button" onClick={onClear}>
              <Icon name="reset" />
              Clear all filters
            </button>
          </div>
        ))}
    </section>
  );
}
