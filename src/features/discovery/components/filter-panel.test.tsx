// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { emptyFilters } from "@/features/discovery/model/discovery";
import { FilterPanel, type FilterGroup } from "./filter-panel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  for (const name of ["show", "showModal", "close"] as const) {
    Object.defineProperty(HTMLDialogElement.prototype, name, {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = name !== "close";
      },
    });
  }
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Panel({ group }: { group: FilterGroup }) {
  const [pending, setPending] = useState(emptyFilters);
  return (
    <FilterPanel
      group={group}
      onGroupChange={() => {}}
      pending={pending}
      setPending={setPending}
      countries={[]}
      summaries={[]}
      genres={[]}
      onApply={() => {}}
      onCancel={() => {}}
      error={null}
      previewCount={0}
    />
  );
}

test("an invalid native date survives group changes and a duration shortcut", () => {
  const { rerender } = render(<Panel group="more" />);
  const from = screen.getByLabelText("From") as HTMLInputElement;
  // A custom native validity error models an unfinished date with an empty value.
  from.setCustomValidity("Unfinished date");
  fireEvent.input(from);
  expect(
    (screen.getByRole("button", { name: "Apply filters" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  rerender(<Panel group="genre" />);
  rerender(<Panel group="more" />);
  fireEvent.click(screen.getByRole("button", { name: "2–3 days" }));
  expect(from.validationMessage).toBe("Unfinished date");
  expect(
    (screen.getByRole("button", { name: "Apply filters" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  rerender(<Panel group="more" />);
  expect(screen.getByLabelText("From")).toBe(from);
  from.setCustomValidity("");
  fireEvent.input(from);
  expect(
    (screen.getByRole("button", { name: "Show 0 events" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
