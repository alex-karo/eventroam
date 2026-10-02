import type { Dispatch, SetStateAction } from "react";
import type { DiscoverySummary, Genre } from "@/catalog/read/contracts";
import {
  genrePickerTree,
  sizeBands,
  type Filters,
  type GenreOption,
  type SizeBand,
} from "@/features/discovery/model/discovery";

const sizeLabels: Record<SizeBand, string> = {
  "lt-1000": "Under 1,000",
  "1000-4999": "1,000–4,999",
  "5000-19999": "5,000–19,999",
  "20000-49999": "20,000–49,999",
  "gte-50000": "50,000+",
};
function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
function GenreChoices({
  options,
  selected,
  onToggle,
}: {
  options: GenreOption[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  if (options.length === 0) return <p>No music genres listed yet.</p>;
  return (
    <ul className="genre-options">
      {options.map(({ genre, children }) => (
        <li key={genre.slug}>
          <label>
            <input
              type="checkbox"
              checked={selected.includes(genre.slug)}
              onChange={() => onToggle(genre.slug)}
            />
            {genre.name}
          </label>
          {children.length > 0 && (
            <GenreChoices
              options={children}
              selected={selected}
              onToggle={onToggle}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function FilterPanel({
  group,
  pending,
  setPending,
  countries,
  summaries,
  genres,
  onApply,
  onCancel,
  error,
}: {
  group: "when" | "where" | "genre" | "more";
  pending: Filters;
  setPending: Dispatch<SetStateAction<Filters>>;
  countries: string[];
  summaries: DiscoverySummary[];
  genres: Genre[];
  onApply: (filters: Filters) => void;
  onCancel: () => void;
  error: string | null;
}) {
  return (
    <div id="filter-panel" className="filter-panel">
      <h2>
        {group === "when"
          ? "When do you want to go?"
          : group === "where"
            ? "Where are you looking?"
            : group === "genre"
              ? "Choose music genres"
              : "Refine your search"}
      </h2>
      <div className="filter-fields">
        {group === "when" && (
          <fieldset>
            <legend>When</legend>
            <p>Matches editions that overlap your dates.</p>
            <label>
              From{" "}
              <input
                type="date"
                value={pending.from}
                onChange={(e) =>
                  setPending({ ...pending, from: e.target.value })
                }
              />
            </label>
            <label>
              To{" "}
              <input
                type="date"
                value={pending.to}
                onChange={(e) => setPending({ ...pending, to: e.target.value })}
              />
            </label>
            <button
              type="button"
              onClick={() => setPending({ ...pending, from: "", to: "" })}
            >
              Upcoming and ongoing
            </button>
            <button
              type="button"
              onClick={() => {
                const date = new Date();
                const day = date.getDay();
                const offset = day === 0 ? -1 : (6 - day + 7) % 7;
                date.setDate(date.getDate() + offset);
                const from = [
                  date.getFullYear(),
                  String(date.getMonth() + 1).padStart(2, "0"),
                  String(date.getDate()).padStart(2, "0"),
                ].join("-");
                date.setDate(date.getDate() + 1);
                const to = [
                  date.getFullYear(),
                  String(date.getMonth() + 1).padStart(2, "0"),
                  String(date.getDate()).padStart(2, "0"),
                ].join("-");
                setPending({ ...pending, from, to });
              }}
            >
              This weekend
            </button>
            <label>
              Month{" "}
              <input
                type="month"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [year, month] = e.target.value.split("-").map(Number);
                  const end = new Date(year, month, 0).getDate();
                  setPending({
                    ...pending,
                    from: `${e.target.value}-01`,
                    to: `${e.target.value}-${String(end).padStart(2, "0")}`,
                  });
                }}
              />
            </label>
          </fieldset>
        )}
        {group === "where" && (
          <fieldset>
            <legend>Where</legend>
            <label>
              Locality or region{" "}
              <input
                value={pending.place}
                onChange={(e) =>
                  setPending({ ...pending, place: e.target.value })
                }
              />
            </label>
            <div className="choices">
              {countries.map((country) => (
                <label key={country}>
                  <input
                    type="checkbox"
                    checked={pending.countries.includes(country)}
                    onChange={() =>
                      setPending({
                        ...pending,
                        countries: toggle(pending.countries, country),
                      })
                    }
                  />
                  {country}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {(group === "genre" || group === "more") && (
          <fieldset className={group === "more" ? "mobile-genre-field" : ""}>
            <legend>Music genre</legend>
            <GenreChoices
              options={genrePickerTree(summaries, genres, pending.genres)}
              selected={pending.genres}
              onToggle={(slug) =>
                setPending({ ...pending, genres: toggle(pending.genres, slug) })
              }
            />
          </fieldset>
        )}
        {group === "more" && (
          <>
            <fieldset>
              <legend>Duration</legend>
              <label>
                Minimum days{" "}
                <input
                  type="number"
                  min="1"
                  value={pending.durationMin ?? ""}
                  onChange={(e) =>
                    setPending({
                      ...pending,
                      durationMin: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </label>
              <label>
                Maximum days{" "}
                <input
                  type="number"
                  min="1"
                  value={pending.durationMax ?? ""}
                  onChange={(e) =>
                    setPending({
                      ...pending,
                      durationMax: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </label>
              <div className="choices">
                {[
                  ["1 day", 1, 1],
                  ["2–3 days", 2, 3],
                  ["4+ days", 4, null],
                ].map(([label, min, max]) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() =>
                      setPending({
                        ...pending,
                        durationMin: min as number,
                        durationMax: max as number | null,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Size</legend>
              <p>
                Estimated attendee capacity. Unknown capacity is included when
                Size is unrestricted.
              </p>
              <div className="choices">
                {sizeBands.map((band) => (
                  <label key={band}>
                    <input
                      type="checkbox"
                      checked={pending.sizes.includes(band)}
                      onChange={() =>
                        setPending({
                          ...pending,
                          sizes: toggle(pending.sizes, band) as SizeBand[],
                        })
                      }
                    />
                    {sizeLabels[band]}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </div>
      {error && (
        <p className="filter-error" role="alert">
          {error}
        </p>
      )}
      <div className="filter-actions">
        <button type="button" onClick={() => onApply(pending)}>
          Apply filters
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
