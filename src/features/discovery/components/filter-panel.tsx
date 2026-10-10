import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { LocationChoices } from "@/features/discovery/components/location-choices";
import { sizeLabels } from "@/features/discovery/model/filter-feedback";
import type { DiscoverySummary, Genre } from "@/catalog/read/contracts";
import {
  genrePickerTree,
  sizeBands,
  type Filters,
  type GenreOption,
  type SizeBand,
} from "@/features/discovery/model/discovery";

const groupTitles = {
  when: "When do you want to go?",
  where: "Where are you looking?",
  genre: "Choose music genres",
  more: "Refine your search",
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
}: Readonly<{
  options: GenreOption[];
  selected: string[];
  onToggle: (slug: string) => void;
}>) {
  if (options.length === 0) {
    return <p>No music genres listed yet.</p>;
  }
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
  previewCount,
}: Readonly<{
  group: "when" | "where" | "genre" | "more";
  pending: Filters;
  setPending: Dispatch<SetStateAction<Filters>>;
  countries: string[];
  summaries: DiscoverySummary[];
  genres: Genre[];
  onApply: (filters: Filters) => void;
  onCancel: () => void;
  error: string | null;
  previewCount: number | null;
}>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [months] = useState(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, offset) => {
      const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(year, start.getMonth() + 1, 0).getDate();
      return {
        label: new Intl.DateTimeFormat("en", {
          month: "short",
          year: "numeric",
        }).format(start),
        from: `${year}-${month}-01`,
        to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
      };
    });
  });
  const [nativeError, setNativeError] = useState<string | null>(null);
  function checkNativeInputs() {
    const invalid =
      panelRef.current?.querySelector<HTMLInputElement>("input:invalid");
    const message = invalid
      ? "Complete or clear the date and duration fields."
      : null;
    setNativeError(message);
    return message;
  }
  function setBounds(next: Filters) {
    // Shortcuts also clear unfinished native editing values, which may expose "".
    for (const input of panelRef.current?.querySelectorAll<HTMLInputElement>(
      'input[type="date"], input[type="number"]',
    ) ?? []) {
      const field = input.name as "from" | "to" | "durationMin" | "durationMax";
      input.value = field ? String(next[field] ?? "") : "";
    }
    setNativeError(null);
    setPending(next);
  }
  const feedback = nativeError ?? error;
  const feedbackId = feedback ? "filter-feedback" : undefined;
  const editionLabel = previewCount === 1 ? "edition" : "editions";
  const action =
    feedback || previewCount === null
      ? "Apply filters"
      : `Show ${previewCount} ${editionLabel}`;
  return (
    <div
      ref={panelRef}
      id="filter-panel"
      className="filter-panel"
      onInputCapture={checkNativeInputs}
      onKeyUpCapture={checkNativeInputs}
    >
      <h2>{groupTitles[group]}</h2>
      <div className="filter-fields">
        {group === "when" && (
          <fieldset aria-describedby={feedbackId}>
            <legend className="sr-only">When</legend>
            <p>Matches editions that overlap your dates.</p>
            <div className="filter-input-pair filter-date-pair">
              <label>
                From{" "}
                <input
                  type="date"
                  name="from"
                  aria-describedby={feedbackId}
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
                  name="to"
                  aria-describedby={feedbackId}
                  value={pending.to}
                  onChange={(e) =>
                    setPending({ ...pending, to: e.target.value })
                  }
                />
              </label>
            </div>
            <p>Quick month selection</p>
            <div className="filter-shortcuts" aria-label="Nearby months">
              {months.map(({ label, from, to }) => (
                <button
                  key={from}
                  type="button"
                  aria-pressed={pending.from === from && pending.to === to}
                  onClick={() => setBounds({ ...pending, from, to })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {group === "where" && (
          <fieldset aria-describedby={feedbackId}>
            <legend className="sr-only">Where</legend>
            <LocationChoices
              pending={pending}
              onChange={setPending}
              countries={countries}
              summaries={summaries}
              errorId={feedbackId}
            />
          </fieldset>
        )}
        {(group === "genre" || group === "more") && (
          <fieldset
            aria-describedby={feedbackId}
            className={group === "more" ? "mobile-genre-field" : ""}
          >
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
            <fieldset aria-describedby={feedbackId}>
              <legend>Duration</legend>
              <div className="filter-input-pair">
                <label>
                  Minimum days{" "}
                  <input
                    type="number"
                    min="1"
                    name="durationMin"
                    aria-describedby={feedbackId}
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
                    name="durationMax"
                    aria-describedby={feedbackId}
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
              </div>
              <div className="choices filter-shortcuts">
                {[
                  ["1 day", 1, 1],
                  ["2–3 days", 2, 3],
                  ["4+ days", 4, null],
                ].map(([label, min, max]) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() =>
                      setBounds({
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
            <fieldset aria-describedby={feedbackId}>
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
      {feedback && (
        <p id="filter-feedback" className="filter-error" role="status">
          {feedback}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {feedback ? "Correct filters to preview editions." : action}
      </span>
      <div className="filter-actions">
        <button
          type="button"
          disabled={Boolean(feedback) || previewCount === null}
          onClick={() => {
            if (!checkNativeInputs() && !error) {
              onApply(pending);
            }
          }}
        >
          {action}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
