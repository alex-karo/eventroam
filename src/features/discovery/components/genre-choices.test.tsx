// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { Genre } from "@/catalog/read/contracts";
import { genrePickerTree } from "@/features/discovery/model/discovery";
import { GenreChoices } from "./genre-choices";

const genres: Genre[] = [
  { slug: "electronic", name: "Electronic", parentSlug: null },
  { slug: "house", name: "House", parentSlug: "electronic" },
  { slug: "deep-house", name: "Deep House", parentSlug: "house" },
  { slug: "techno", name: "Techno", parentSlug: "electronic" },
  { slug: "rock", name: "Rock", parentSlug: null },
];
const options = genrePickerTree(
  [],
  genres,
  genres.map((genre) => genre.slug),
);
function Picker({
  initial = ["deep-house", "techno"],
}: {
  initial?: string[];
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <GenreChoices
      options={options}
      selected={selected}
      onChange={setSelected}
    />
  );
}
const checkbox = (name: string) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;
afterEach(cleanup);

test("search keeps ancestry and selected genres without changing selection", () => {
  render(<Picker />);
  expect(checkbox("Electronic").indeterminate).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Collapse Electronic" }));
  expect(screen.queryByRole("checkbox", { name: "Deep House" })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search genres" }), {
    target: { value: "deep" },
  });
  expect(
    screen
      .getAllByRole("checkbox")
      .map((input) => input.getAttribute("aria-label")),
  ).toEqual(["Electronic", "House", "Deep House"]);
  expect(checkbox("Deep House").checked).toBe(true);
  expect(
    screen.getByRole("button", { name: "Remove Techno selection" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Techno selection" }),
  );
  expect(
    screen.queryByRole("button", { name: "Remove Techno selection" }),
  ).toBeNull();
  expect(checkbox("Deep House").checked).toBe(true);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search genres" }), {
    target: { value: "" },
  });
  expect(screen.queryByRole("checkbox", { name: "Deep House" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Remove Deep House selection" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Expand Electronic" }));
  expect(checkbox("Deep House").checked).toBe(true);
});

test("branch selection replaces children and marks inherited choices", () => {
  render(<Picker />);
  fireEvent.click(checkbox("Electronic"));
  expect(checkbox("Electronic").checked).toBe(true);
  expect(checkbox("House").checked).toBe(true);
  expect(checkbox("Deep House").disabled).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Remove Deep House selection" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Collapse Electronic" }));
  expect(screen.queryByRole("checkbox", { name: "House" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Expand Electronic" }));
  expect(checkbox("House").disabled).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Electronic selection" }),
  );
  expect(document.activeElement).toBe(
    screen.getByRole("searchbox", { name: "Search genres" }),
  );
  expect(checkbox("House").disabled).toBe(false);
  expect(checkbox("Deep House").checked).toBe(false);
});

test("parent removal clears redundant direct URL children and Clear removes only genres", () => {
  render(<Picker initial={["electronic", "deep-house", "rock"]} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Electronic selection" }),
  );
  expect(checkbox("Deep House").checked).toBe(false);
  expect(checkbox("Rock").checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(checkbox("Rock").checked).toBe(false);
});

test("selected zero-result genre and its ancestry remain in the eligible tree", () => {
  const tree = genrePickerTree([], genres, ["deep-house"]);
  render(
    <GenreChoices
      options={tree}
      selected={["deep-house"]}
      onChange={() => {}}
    />,
  );
  expect(checkbox("Deep House").checked).toBe(true);
  expect(checkbox("House").indeterminate).toBe(true);
  expect(checkbox("Electronic").indeterminate).toBe(true);
});
