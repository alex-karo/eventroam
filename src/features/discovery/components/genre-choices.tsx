import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { GenreOption } from "@/features/discovery/model/discovery";

export function GenreChoices({
  options,
  selected,
  onChange,
}: Readonly<{
  options: GenreOption[];
  selected: string[];
  onChange: (slugs: string[]) => void;
}>) {
  const searchId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const nodes = useMemo(() => {
    const index = new Map<string, { name: string; ancestors: string[] }>();
    function visit(items: GenreOption[], ancestors: string[]) {
      for (const { genre, children } of items) {
        index.set(genre.slug, { name: genre.name, ancestors });
        visit(children, [...ancestors, genre.slug]);
      }
    }
    visit(options, []);
    return index;
  }, [options]);
  const [expanded, setExpanded] = useState(
    () => new Set(selected.flatMap((slug) => nodes.get(slug)?.ancestors ?? [])),
  );
  const query = search.trim().toLocaleLowerCase("en");
  function change(next: string[]) {
    onChange(
      next.filter(
        (slug) =>
          !nodes.get(slug)?.ancestors.some((parent) => next.includes(parent)),
      ),
    );
  }
  function removeBranch(slug: string) {
    change(
      selected.filter(
        (value) =>
          value !== slug && !nodes.get(value)?.ancestors.includes(slug),
      ),
    );
  }
  function matches(option: GenreOption): boolean {
    return (
      option.genre.name.toLocaleLowerCase("en").includes(query) ||
      option.children.some(matches)
    );
  }
  function renderOptions(items: GenreOption[], parentMatch = false) {
    return items
      .filter((option) => parentMatch || matches(option))
      .map(({ genre, children }) => {
        const inherited = nodes
          .get(genre.slug)
          ?.ancestors.some((slug) => selected.includes(slug));
        const checked = selected.includes(genre.slug) || Boolean(inherited);
        const count = selected.filter((slug) =>
          nodes.get(slug)?.ancestors.includes(genre.slug),
        ).length;
        const partial = !checked && count > 0;
        const hasChildren = children.length > 0;
        const isOpen = Boolean(query) || expanded.has(genre.slug);
        let detail = "";
        if (inherited) {
          detail = "Included";
        } else if (checked && hasChildren) {
          detail = "All subgenres";
        } else if (partial) {
          detail = `${count} selected`;
        }
        return (
          <li key={genre.slug}>
            <div
              className={`genre-row${checked && !inherited ? " is-selected" : ""}`}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="genre-branch"
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${genre.name}`}
                  aria-expanded={isOpen}
                  disabled={Boolean(query)}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(genre.slug)) {
                        next.delete(genre.slug);
                      } else {
                        next.add(genre.slug);
                      }
                      return next;
                    })
                  }
                >
                  <span aria-hidden="true">{isOpen ? "⌄" : "›"}</span>
                </button>
              ) : (
                <span className="genre-branch-space" aria-hidden="true" />
              )}
              <label>
                <input
                  type="checkbox"
                  aria-label={genre.name}
                  checked={checked}
                  disabled={Boolean(inherited)}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = partial;
                    }
                  }}
                  onChange={() => {
                    if (checked) {
                      removeBranch(genre.slug);
                    } else {
                      change([...selected, genre.slug]);
                      setExpanded(
                        (current) =>
                          new Set([
                            ...current,
                            ...(nodes.get(genre.slug)?.ancestors ?? []),
                          ]),
                      );
                    }
                  }}
                />
                <span className="genre-name">{genre.name}</span>
                {detail && (
                  <span className="genre-selection-detail">{detail}</span>
                )}
              </label>
            </div>
            {hasChildren && isOpen && (
              <ul>
                {renderOptions(
                  children,
                  parentMatch ||
                    (Boolean(query) &&
                      genre.name.toLocaleLowerCase("en").includes(query)),
                )}
              </ul>
            )}
          </li>
        );
      });
  }
  let choices: ReactNode;
  if (options.length === 0) {
    choices = <p>No music genres listed yet.</p>;
  } else if (options.some(matches)) {
    choices = <ul className="genre-tree">{renderOptions(options)}</ul>;
  } else {
    choices = <p role="status">No genres match your search.</p>;
  }
  return (
    <div className="genre-picker">
      <div className="genre-search-row">
        <label className="sr-only" htmlFor={searchId}>
          Search genres
        </label>
        <input
          ref={searchInput}
          id={searchId}
          type="search"
          placeholder="Search genres"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          className="genre-clear"
          onClick={() => onChange([])}
        >
          Clear
        </button>
      </div>
      <p className="genre-help">A genre includes all its subgenres.</p>
      {selected.length > 0 && (
        <div className="genre-selected" aria-label="Selected genres">
          {selected.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => {
                removeBranch(slug);
                searchInput.current?.focus();
              }}
              aria-label={`Remove ${nodes.get(slug)?.name ?? slug} selection`}
            >
              {nodes.get(slug)?.name ?? slug} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="genre-list-scroll" aria-label="Genre list">
        {choices}
      </div>
    </div>
  );
}
