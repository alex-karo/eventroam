// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { testFixtures } from "@/test/fixtures";
import { ResultsList } from "./results-list";

afterEach(cleanup);

test("map selection and page navigation have separate targets", () => {
  const edition = testFixtures().build.summary({ latitude: 38, longitude: -9 });
  const onSelect = vi.fn();
  const props = {
    results: [edition],
    selectedId: null,
    error: null,
    onSelect,
    onClear: vi.fn(),
  };
  const view = render(<ResultsList {...props} />);
  const selection = view.getByRole("button", { name: /^Show on map:/ });
  const page = view.getByRole("link", { name: /^Open page for/ });
  fireEvent.click(selection);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(edition.id);
  expect(page.getAttribute("href")).toBe(
    `/events/${edition.eventSlug}/${edition.key}`,
  );
  expect(page.getAttribute("target")).toBe("_blank");
  expect(page.getAttribute("rel")).toBe("noopener noreferrer");
  expect(selection.contains(page)).toBe(false);
  fireEvent.click(page);
  expect(onSelect).toHaveBeenCalledTimes(1);
  view.rerender(<ResultsList {...props} selectedId={edition.id} />);
  expect(selection.getAttribute("aria-pressed")).toBe("true");
});

test("an event without coordinates can be selected without a map claim", () => {
  const edition = testFixtures().build.summary({
    latitude: null,
    longitude: null,
  });
  const view = render(
    <ResultsList
      results={[edition]}
      selectedId={edition.id}
      error={null}
      onSelect={vi.fn()}
      onClear={vi.fn()}
    />,
  );
  expect(view.getByRole("button", { name: /^Select / })).toBeTruthy();
  expect(view.getByText("Not mapped")).toBeTruthy();
  expect(view.getByRole("link", { name: /^Open page for/ })).toBeTruthy();
});
