import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { GenreChoices } from "@/features/discovery/components/genre-choices";
import { LocationChoices } from "@/features/discovery/components/location-choices";
import { sizeLabels } from "@/features/discovery/model/filter-feedback";
import type { DiscoverySummary, Genre } from "@/catalog/read/contracts";
import {
  genrePickerTree,
  emptyFilters,
  sizeBands,
  type Filters,
  type SizeBand,
} from "@/features/discovery/model/discovery";

export type FilterGroup = "where" | "genre" | "more";
const groupTitles = {
  where: "Where",
  genre: "Music",
  more: "More",
};

function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function FilterPanel({
  group,
  onGroupChange,
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
  group: FilterGroup;
  onGroupChange: (group: FilterGroup) => void;
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
  const panelRef = useRef<HTMLDialogElement>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  useEffect(() => {
    const dialog = panelRef.current!;
    const narrow = window.matchMedia("(max-width: 740px)");
    function show() {
      const focused = dialog.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : null;
      if (dialog.open) {
        dialog.close();
      }
      if (narrow.matches) {
        dialog.showModal();
      } else {
        dialog.show();
      }
      focused?.focus();
    }
    show();
    narrow.addEventListener("change", show);
    return () => {
      narrow.removeEventListener("change", show);
      dialog.close();
    };
  }, []);
  function checkNativeInputs() {
    const invalid =
      panelRef.current?.querySelector<HTMLInputElement>("input:invalid");
    const message = invalid
      ? "Complete or clear the date and duration fields."
      : null;
    setNativeError(message);
    return message;
  }
  function setBounds(next: Filters, type: "date" | "number" = "number") {
    // Reset only these native editors. Other unfinished fields stay intact.
    for (const input of panelRef.current?.querySelectorAll<HTMLInputElement>(
      `input[type="${type}"]`,
    ) ?? []) {
      const field = input.name as "from" | "to" | "durationMin" | "durationMax";
      input.value = field ? String(next[field] ?? "") : "";
    }
    checkNativeInputs();
    setPending(next);
  }
  const feedback = nativeError ?? error;
  const feedbackId = feedback ? "filter-feedback" : undefined;
  const eventLabel = previewCount === 1 ? "event" : "events";
  const action =
    feedback || previewCount === null
      ? "Apply filters"
      : `Show ${previewCount} ${eventLabel}`;
  return (
    <dialog
      ref={panelRef}
      id="filter-panel"
      className={`filter-panel filter-panel-${group}`}
      aria-label="Filters"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onCancel();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onCancel();
        }
      }}
      onInputCapture={checkNativeInputs}
      onKeyUpCapture={checkNativeInputs}
    >
      <div className="filter-panel-header">
        <h2>Filters</h2>
        <button
          type="button"
          className="filter-clear-all"
          onClick={() => {
            for (const input of panelRef.current?.querySelectorAll<HTMLInputElement>(
              'input[type="date"], input[type="number"]',
            ) ?? []) {
              input.value = "";
            }
            setPending(emptyFilters());
            checkNativeInputs();
          }}
        >
          Clear all
        </button>
        <button
          type="button"
          className="filter-close"
          aria-label="Close filter"
          onClick={onCancel}
        >
          ×
        </button>
      </div>
      <div className="filter-groups" role="group" aria-label="Filter groups">
        {(["where", "genre", "more"] as FilterGroup[]).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={group === value}
            onClick={() => onGroupChange(value)}
          >
            {groupTitles[value]}
          </button>
        ))}
      </div>
      <div className="filter-fields">
        <fieldset
          hidden={group !== "where"}
          data-filter-group="where"
          aria-describedby={feedbackId}
        >
          <legend className="sr-only">Where</legend>
          <LocationChoices
            pending={pending}
            onChange={setPending}
            countries={countries}
            summaries={summaries}
            errorId={feedbackId}
          />
        </fieldset>

        <fieldset
          aria-describedby={feedbackId}
          hidden={group !== "genre"}
          data-filter-group="genre"
          className="genre-field"
        >
          <legend className="sr-only">Music genre</legend>
          <GenreChoices
            options={genrePickerTree(summaries, genres, pending.genres)}
            selected={pending.genres}
            onChange={(genres) => setPending({ ...pending, genres })}
          />
        </fieldset>
        <div hidden={group !== "more"} data-filter-group="more">
          <fieldset aria-describedby={feedbackId}>
            <legend>Dates</legend>
            <p>Matches events that overlap your dates.</p>
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
            <button
              className="filter-range-clear"
              type="button"
              onClick={() =>
                setBounds({ ...pending, from: "", to: "" }, "date")
              }
            >
              Clear dates
            </button>
          </fieldset>
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
            <button
              className="filter-range-clear"
              type="button"
              onClick={() =>
                setBounds({ ...pending, durationMin: null, durationMax: null })
              }
            >
              Clear duration
            </button>
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
              Approximate number of participants. Unknown size is included when
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
        </div>
      </div>
      {feedback && (
        <p id="filter-feedback" className="filter-error" role="status">
          {feedback}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {feedback ? "Correct filters to preview events." : action}
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
    </dialog>
  );
}
