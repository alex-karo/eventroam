"use client";
import { useEffect, useRef, useState } from "react";
import {
  durationDays,
  emptyFilters,
  filterSummaries,
  genrePickerTree,
  normalizeFilters,
  parseFilters,
  serializeFilters,
  sizeBands,
  type DiscoverySummary,
  type Filters,
  type Genre,
  type GenreOption,
  type SizeBand,
} from "@/application/discovery";
import { editionPath } from "@/application/public-site";
import type { PublicOccurrence } from "@/application/public-catalog";
import { DiscoveryMap, hasMapPoint } from "@/components/discovery-map";
import { Dates, Location, Status, TicketPrice } from "@/components/catalog";

type Catalog = { summaries: DiscoverySummary[]; genres: Genre[] };
const sizeLabels: Record<SizeBand, string> = {
  "lt-1000": "Under 1,000",
  "1000-4999": "1,000–4,999",
  "5000-19999": "5,000–19,999",
  "20000-49999": "20,000–49,999",
  "gte-50000": "50,000+",
};
const format = (date: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
function countGroups(f: Filters) {
  return (
    Number(Boolean(f.from)) +
    Number(Boolean(f.countries.length || f.place)) +
    Number(Boolean(f.genres.length)) +
    Number(f.durationMin !== null || f.durationMax !== null) +
    Number(Boolean(f.sizes.length))
  );
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
export function Discovery({
  initialCatalog,
  initialFilters,
  initialError,
  initialQuery,
  initialNow,
  initialView,
}: {
  initialCatalog: Catalog;
  initialFilters: Filters;
  initialError: string | null;
  initialQuery: string;
  initialNow: string;
  initialView: "map" | "list";
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [applied, setApplied] = useState(initialFilters);
  const [pending, setPending] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters.q);
  const [urlError, setUrlError] = useState(initialError);
  const [formError, setFormError] = useState<string | null>(null);
  const invalidUrl = urlError !== null;
  const error = urlError ?? formError;
  const [loadError, setLoadError] = useState(false);
  const [panel, setPanel] = useState(false);
  const [view, setView] = useState<"map" | "list">(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PublicOccurrence | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);
  const detailPanel = useRef<HTMLElement>(null);
  const today = new Date(initialNow);
  const panelButton = useRef<HTMLButtonElement>(null);
  const latest = useRef(0);
  const [countries, setCountries] = useState<string[]>(() =>
    [...new Set(initialCatalog.summaries.map((s) => s.countryCode))].sort(),
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!initialError) {
      const view = url.searchParams.get("view");
      const normalized = `${window.location.pathname}${initialQuery ? `?${initialQuery}${view === "map" || view === "list" ? `&view=${view}` : ""}` : view === "map" || view === "list" ? `?view=${view}` : ""}`;
      if (normalized !== `${url.pathname}${url.search}`)
        window.history.replaceState(null, "", normalized);
    }
  }, [initialError, initialQuery]);
  useEffect(() => {
    const restore = () => {
      setView(
        new URLSearchParams(window.location.search).get("view") === "map"
          ? "map"
          : "list",
      );
      try {
        const next = parseFilters(
          new URLSearchParams(window.location.search),
          catalog.genres,
        );
        setApplied(next);
        setPending(next);
        setQuery(next.q);
        setUrlError(null);
        setFormError(null);
      } catch (caught) {
        setUrlError(
          caught instanceof Error ? caught.message : "Invalid filters.",
        );
        setFormError(null);
      }
      setPanel(false);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [catalog.genres]);
  async function load() {
    const request = ++latest.current;
    try {
      const response = await fetch("/api/discovery", { cache: "no-store" });
      if (!response.ok) throw new Error("Discovery is unavailable.");
      const next = (await response.json()) as Catalog;
      if (request !== latest.current) return;
      setCatalog(next);
      setCountries(
        [...new Set(next.summaries.map((s) => s.countryCode))].sort(),
      );
      setLoadError(false);
    } catch {
      if (request === latest.current) setLoadError(true);
    }
  }
  useEffect(() => {
    const request = ++latest.current;
    fetch("/api/discovery", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Discovery is unavailable.");
        return response.json() as Promise<Catalog>;
      })
      .then((next) => {
        if (request !== latest.current) return;
        setCatalog(next);
        setCountries(
          [...new Set(next.summaries.map((s) => s.countryCode))].sort(),
        );
        setLoadError(false);
      })
      .catch(() => {
        if (request === latest.current) setLoadError(true);
      });
  }, []);
  useEffect(() => {
    if (selectedId) detailPanel.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  function apply(next: Filters) {
    try {
      const valid = normalizeFilters(next, catalog.genres);
      const params = serializeFilters(valid);
      const view = new URLSearchParams(window.location.search).get("view");
      if (view === "map" || view === "list") params.set("view", view);
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${params.size ? `?${params}` : ""}`,
      );
      setApplied(valid);
      setPending(valid);
      setQuery(valid.q);
      setUrlError(null);
      setFormError(null);
      setPanel(false);
      panelButton.current?.focus();
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Invalid filters.",
      );
    }
  }
  function switchView(next: "map" | "list") {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "map") url.searchParams.set("view", "map");
    else url.searchParams.delete("view");
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  }
  async function selectEdition(id: string) {
    const request = ++detailRequest.current;
    setSelectedId(id);
    setDetail(null);
    setDetailError(false);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/discovery/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Detail unavailable");
      const next = (await response.json()) as PublicOccurrence;
      if (request === detailRequest.current) setDetail(next);
    } catch {
      if (request === detailRequest.current) setDetailError(true);
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }
  const results = invalidUrl
    ? []
    : filterSummaries(catalog.summaries, applied, catalog.genres, today);
  const mapped = results.filter(hasMapPoint).length;
  const active = [
    applied.q && ["Name", "q"],
    applied.from && ["When", "date"],
    (applied.countries.length || applied.place) && ["Where", "where"],
    applied.genres.length && ["Music genre", "genre"],
    (applied.durationMin !== null || applied.durationMax !== null) && [
      "Duration",
      "duration",
    ],
    applied.sizes.length && ["Size", "size"],
  ].filter(Boolean) as string[][];
  function remove(group: string) {
    const next = { ...applied };
    if (group === "q") next.q = "";
    if (group === "date") {
      next.from = "";
      next.to = "";
    }
    if (group === "where") {
      next.countries = [];
      next.place = "";
    }
    if (group === "genre") next.genres = [];
    if (group === "duration") {
      next.durationMin = null;
      next.durationMax = null;
    }
    if (group === "size") next.sizes = [];
    apply(next);
  }
  return (
    <div className="discovery">
      <form
        className="name-search"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ ...applied, q: query });
        }}
      >
        <label htmlFor="name-search">Search by name</label>
        <div>
          <input
            id="name-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Festival name"
          />
          <button type="submit">Search</button>
        </div>
      </form>
      <div className="filter-toolbar">
        <div className="primary-filters">
          {["When", "Where", "Music genre"].map((label) => (
            <button
              key={label}
              className={label === "Music genre" ? "genre-shortcut" : ""}
              type="button"
              onClick={() => {
                setPending(applied);
                setPanel(true);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          ref={panelButton}
          type="button"
          aria-expanded={panel}
          aria-controls="filter-panel"
          onClick={() => {
            setPending(applied);
            setPanel(!panel);
          }}
        >
          <span className="desktop-filter-label">More filters</span>
          <span className="mobile-filter-label">Filters</span> (
          {countGroups(applied)})
        </button>
        <span aria-live="polite">
          {invalidUrl
            ? "Invalid filters"
            : `${results.length} ${results.length === 1 ? "edition" : "editions"} · ${mapped} mapped · ${results.length - mapped} unlocated`}
        </span>
        <button type="button" onClick={() => apply(emptyFilters())}>
          Clear all
        </button>
      </div>
      {panel && (
        <div id="filter-panel" className="filter-panel">
          <h2>Filters</h2>
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
          <fieldset>
            <legend>Music genre</legend>
            <GenreChoices
              options={genrePickerTree(
                catalog.summaries,
                catalog.genres,
                pending.genres,
              )}
              selected={pending.genres}
              onToggle={(slug) =>
                setPending({ ...pending, genres: toggle(pending.genres, slug) })
              }
            />
          </fieldset>
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
                    durationMin: e.target.value ? Number(e.target.value) : null,
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
                    durationMax: e.target.value ? Number(e.target.value) : null,
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
          <div className="filter-actions">
            <button type="button" onClick={() => apply(pending)}>
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(applied);
                setPanel(false);
                setFormError(null);
                panelButton.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {active.length > 0 && (
        <div className="chips" aria-label="Applied filters">
          {active.map(([label, key]) => (
            <button type="button" key={key} onClick={() => remove(key)}>
              {label} ×
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => apply(emptyFilters())}>
            Reset invalid filters
          </button>
        </div>
      )}
      {loadError && (
        <div className="notice" role="alert">
          <p>
            Could not refresh discovery results. Showing the last available
            list.
          </p>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      <div className="view-switch" role="group" aria-label="Discovery view">
        <button
          type="button"
          aria-pressed={view === "map"}
          onClick={() => switchView("map")}
        >
          Map
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => switchView("list")}
        >
          List
        </button>
      </div>
      <div className={`discovery-results view-${view}`}>
        <section className="map-region" aria-label="Map results">
          <h2>Map</h2>
          <DiscoveryMap
            summaries={results}
            selectedId={selectedId}
            onSelect={(id) => void selectEdition(id)}
            visible={view === "map"}
          />
        </section>
        <section className="list-region" aria-label="List results">
          <h2>List</h2>
          {!error &&
            (results.length ? (
              <ul className="edition-list">
                {results.map((edition) => (
                  <li
                    key={edition.id}
                    className={
                      selectedId === edition.id ? "selected-edition" : ""
                    }
                  >
                    <a href={editionPath(edition.eventSlug, edition.key)}>
                      {edition.name ?? `${edition.eventName} ${edition.year}`}
                    </a>
                    <button
                      type="button"
                      onClick={() => void selectEdition(edition.id)}
                      aria-label={`Show details for ${edition.name ?? `${edition.eventName} ${edition.year}`}`}
                    >
                      Details
                    </button>
                    <p>
                      {edition.dateState === "provisional" &&
                        "Tentative dates: "}
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
                      {edition.latitude === null &&
                        " · Map location unavailable"}
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
                <button type="button" onClick={() => apply(emptyFilters())}>
                  Clear all filters
                </button>
              </div>
            ))}
        </section>
      </div>
      {selectedId && (
        <section
          ref={detailPanel}
          className="detail-panel"
          aria-live="polite"
          aria-label="Selected edition details"
        >
          <button
            type="button"
            onClick={() => {
              ++detailRequest.current;
              setSelectedId(null);
              setDetail(null);
              setDetailError(false);
              setDetailLoading(false);
            }}
          >
            Close details
          </button>
          {detailLoading && <p>Loading edition details…</p>}
          {detailError && (
            <div role="alert">
              <p>Could not load edition details.</p>
              <button
                type="button"
                onClick={() => void selectEdition(selectedId)}
              >
                Retry details
              </button>
            </div>
          )}
          {detail && (
            <>
              <h2>{detail.name ?? `${detail.eventName} ${detail.year}`}</h2>
              <Status edition={detail} />
              <Dates edition={detail} />
              <Location edition={detail} />
              {detail.venueAddress && <p>{detail.venueAddress}</p>}
              {detail.terms.length > 0 && (
                <p>
                  Classification:{" "}
                  {detail.terms.map((term) => term.name).join(", ")}
                </p>
              )}
              {detail.capacityEstimate !== null && (
                <p>
                  Estimated capacity:{" "}
                  {detail.capacityEstimate.toLocaleString("en")}
                </p>
              )}
              <TicketPrice edition={detail} />
              {detail.links.length > 0 && (
                <>
                  <h3>Official links</h3>
                  <ul>
                    {detail.links.map((link) => (
                      <li key={`${link.kind}:${link.url}`}>
                        <a href={link.url} rel="noopener noreferrer">
                          {link.label ?? link.kind.replaceAll("_", " ")}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <a href={editionPath(detail.eventSlug, detail.key)}>
                Open full edition page
              </a>
            </>
          )}
        </section>
      )}
    </div>
  );
}
