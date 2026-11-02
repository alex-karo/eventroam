// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MonthStrip, nearbyMonths } from "./month-strip";

afterEach(() => {
  cleanup();
});

test("local month bounds cross years and include leap days", () => {
  const months = nearbyMonths(new Date(2027, 11, 15));
  expect(months).toHaveLength(12);
  expect(months[0]).toMatchObject({ from: "2027-12-01", to: "2027-12-31" });
  expect(months[2]).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
  expect(months[11]).toMatchObject({ from: "2028-11-01", to: "2028-11-30" });
});

test("months commit exact bounds and All clears both without toggling a month off", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <MonthStrip
      now={new Date(2027, 11, 15)}
      from="2028-02-02"
      to="2028-02-29"
      onChange={onChange}
    />,
  );
  const february = screen.getByRole("button", { name: "Feb 2028" });
  expect(february.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(february);
  expect(onChange).toHaveBeenLastCalledWith("2028-02-01", "2028-02-29");
  rerender(
    <MonthStrip
      now={new Date(2027, 11, 15)}
      from="2028-02-01"
      to="2028-02-29"
      onChange={onChange}
    />,
  );
  expect(february.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(february);
  expect(onChange).toHaveBeenLastCalledWith("2028-02-01", "2028-02-29");
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(onChange).toHaveBeenLastCalledWith("", "");
});
