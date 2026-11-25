import { Icon } from "@/components/catalog/icons";
import type { Genre } from "@/catalog/read/contracts";
import type { Filters } from "../model/discovery";
import { filterSelections } from "../model/filter-feedback";
import { filterGroups, type FilterGroup } from "./filter-groups";

export function DiscoveryToolbar({
  applied,
  genres,
  panel,
  query,
  searchError,
  onQueryChange,
  onSearch,
  onOpenPanel,
  onClear,
}: Readonly<{
  applied: Filters;
  genres: Genre[];
  panel: FilterGroup | null;
  query: string;
  searchError: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onOpenPanel: (group: FilterGroup, opener: HTMLButtonElement) => void;
  onClear: () => void;
}>) {
  const active = filterSelections(applied, genres);
  const groupSelections = {
    where: active.filter((item) => ["countries", "place"].includes(item.field)),
    genre: active.filter((item) => item.field === "genres"),
    more: active.filter((item) =>
      ["date", "duration", "sizes"].includes(item.field),
    ),
  };
  const secondaryGroups = new Set(
    groupSelections.more.map((item) => item.field),
  ).size;
  return (
    <div className="discovery-controls">
      <form
        className="name-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="sr-only" htmlFor="name-search">
          Search festival names
        </label>
        <input
          id="name-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-invalid={searchError ? true : undefined}
          aria-describedby={searchError ? "search-error" : undefined}
          placeholder="Find a festival…"
        />
        <button type="submit" aria-label="Search festival names">
          <Icon name="search" />
        </button>
      </form>
      <div
        className="filter-toolbar"
        role="group"
        aria-label="Discovery filters"
      >
        {filterGroups.map(({ id: group, label, icon }) => {
          const values = groupSelections[group];
          const summary = values.map((item) => item.label).join(", ");
          const name = summary ? `${label}: ${summary}` : label;
          return (
            <button
              key={group}
              className={`filter-trigger filter-trigger-${group}`}
              type="button"
              aria-expanded={panel === group}
              aria-controls="filter-panel"
              aria-label={name}
              title={name}
              data-active={values.length > 0}
              onClick={(event) => onOpenPanel(group, event.currentTarget)}
            >
              <Icon name={icon} />
              <span className="filter-trigger-value">
                {group === "more" || !values.length ? label : values[0].label}
              </span>
              {group !== "more" &&
                values.length > 1 &&
                ` +${values.length - 1}`}
              {group === "more" &&
                secondaryGroups > 0 &&
                ` · ${secondaryGroups}`}
              <span className="filter-chevron">
                <Icon name="chevron-down" />
              </span>
            </button>
          );
        })}
        <button
          className="clear-filters"
          type="button"
          aria-label="Clear all"
          title="Clear all filters"
          onClick={onClear}
        >
          <Icon name="reset" />
        </button>
      </div>
    </div>
  );
}
