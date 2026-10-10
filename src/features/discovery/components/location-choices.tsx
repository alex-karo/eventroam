import { useId, useMemo, useState } from "react";
import type { DiscoverySummary } from "@/catalog/read/contracts";
import type { Filters } from "@/features/discovery/model/discovery";
import {
  countryChoices,
  countryName,
  placeSuggestions,
} from "@/features/discovery/model/filter-feedback";

export function LocationChoices({
  pending,
  onChange,
  countries,
  summaries,
  errorId,
}: Readonly<{
  pending: Filters;
  onChange: (filters: Filters) => void;
  countries: string[];
  summaries: DiscoverySummary[];
  errorId?: string;
}>) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const choices = countryChoices(countries, pending.countries, search);
  const suggestions = useMemo(
    () => placeSuggestions(summaries, pending.countries, pending.place),
    [summaries, pending.countries, pending.place],
  );
  const expanded = open && suggestions.length > 0;
  function choose(place: string) {
    onChange({ ...pending, place });
    setOpen(false);
    setActive(-1);
  }
  return (
    <>
      <div className="location-section">
        <label htmlFor="place-search">City or region</label>
        <input
          id="place-search"
          placeholder="e.g. Lisbon or a region"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            expanded && suggestions[active] ? `${listId}-${active}` : undefined
          }
          aria-describedby={["place-help", errorId].filter(Boolean).join(" ")}
          aria-invalid={errorId ? true : undefined}
          value={pending.place}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange({ ...pending, place: event.target.value });
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && expanded) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActive(-1);
            } else if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              suggestions.length
            ) {
              event.preventDefault();
              setOpen(true);
              setActive((index) => {
                if (event.key === "ArrowDown") {
                  return (index + 1) % suggestions.length;
                }
                return index <= 0 ? suggestions.length - 1 : index - 1;
              });
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (expanded && suggestions[active]) {
                choose(suggestions[active].place);
              }
            }
          }}
        />
        <p id="place-help">
          Type a city or region; optionally narrow by country.
        </p>
        {expanded && (
          <ul
            className="place-suggestions"
            id={listId}
            role="listbox"
            aria-label="City or region suggestions"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion.place)}
              >
                <strong>{suggestion.place}</strong>{" "}
                <span>{countryName(suggestion.country)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="location-section">
        <label htmlFor="country-search">Search countries</label>
        <input
          id="country-search"
          placeholder="Country name or code"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="choices country-choices">
          {choices.map(({ code, name }) => (
            <label key={code}>
              <input
                type="checkbox"
                checked={pending.countries.includes(code)}
                onChange={() => {
                  onChange({
                    ...pending,
                    countries: pending.countries.includes(code)
                      ? pending.countries.filter((value) => value !== code)
                      : [...pending.countries, code],
                  });
                  setActive(-1);
                }}
              />
              {name}
            </label>
          ))}
        </div>
        {choices.length === 0 && <p>No countries match your search.</p>}
      </div>
    </>
  );
}
