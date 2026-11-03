import { openFilter, filterOpener, clearFilters } from "./discovery-controls";
import { expect, test, type Page, type TestInfo } from "./fixtures";

const year = "/?from=2027-01-01&to=2027-12-31";
const list = (page: Page) => page.getByRole("region", { name: "List results" });
const count = (page: Page) => page.locator(".results-count");

test("filter count badges fit a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const params = new URLSearchParams({ durationMin: "1", size: "lt-1000" });
  for (const genre of [
    "afrobeat",
    "afrobeats",
    "ambient",
    "blues",
    "classical",
    "country",
    "dancehall",
    "deep-house",
    "disco",
    "techno",
  ]) {
    params.append("genre", genre);
  }
  await page.goto(`/?${params}`);
  await expect(page.locator(".filter-trigger-genre")).toContainText("+9");
  await expect(page.locator(".filter-trigger-more")).toContainText("2");
  const fits = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return (
      document.documentElement.scrollWidth === width &&
      [
        ...document.querySelectorAll(
          ".month-all, .filter-trigger, .clear-filters",
        ),
      ].every((button) => {
        const bounds = button.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= width;
      })
    );
  });
  expect(fits).toBe(true);
  await openFilter(page, "Music");
  await expect(page.locator(".genre-selected button")).toHaveCount(10);
});

async function expectNames(page: Page, names: string[]) {
  await expect(list(page).locator(".edition-name")).toHaveText(names);
  await expect(count(page)).toHaveText(
    `${names.length} ${names.length === 1 ? "event" : "events"}`,
  );
}

async function expectViews(page: Page, testInfo: TestInfo) {
  await expect(list(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Map results" })).toBeVisible();
  const toggle = page.locator(".sheet-toggle");
  if (testInfo.project.name === "mobile") {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(list(page)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Map results" }),
    ).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  } else {
    await expect(toggle).toBeHidden();
  }
}

async function openMore(page: Page) {
  await openFilter(page, "More");
}

test("direct date ranges include overlap and history but exclude cancellations", async ({
  page,
}, testInfo) => {
  await page.goto("/?from=2025-07-02&to=2025-07-02");
  await expectNames(page, ["Fictional Field Days"]);
  await expect(page.locator(".results-geography")).toHaveText(
    "On map: 0 · Not mapped: 1",
  );
  await expectViews(page, testInfo);

  await page.goto("/?from=2026-07-02&to=2026-07-02");
  await expect(count(page)).toHaveText("0 events");
  await expect(page.getByText("No events match these filters.")).toBeVisible();

  await page.goto("/?from=2027-07-02&to=2027-07-02");
  await expectNames(page, ["Fictional Field Days"]);
  await expect(list(page).getByText("Tentative dates")).toBeVisible();
});

test("combined date, country, place, and name filters survive reload and view switch", async ({
  page,
}, testInfo) => {
  await page.goto(year);
  await openFilter(page, "More");
  await page.getByLabel("From", { exact: true }).fill("2027-06-01");
  await page.getByLabel("To", { exact: true }).fill("2027-07-31");
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expectNames(page, [
    "Fictional Atlantic Sounds",
    "Fictional Field Days",
    "Fictional Mediterranean Nights",
  ]);

  await openFilter(page, "Where");
  await page.getByLabel("Portugal", { exact: true }).check();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expectNames(page, [
    "Fictional Atlantic Sounds",
    "Fictional Field Days",
  ]);

  await openFilter(page, "Where");
  await page.getByRole("combobox", { name: "City or region" }).fill("lisbon");
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expectNames(page, ["Fictional Atlantic Sounds"]);

  const search = page.getByRole("search");
  const searchInput = search.getByRole("textbox", {
    name: "Search festival names",
  });
  const searchButton = search.getByRole("button", {
    name: "Search festival names",
  });
  await searchInput.fill("no-such-festival");
  await searchButton.click();
  await expect(count(page)).toHaveText("0 events");
  await searchInput.fill("atlantic");
  await searchButton.click();

  await expectNames(page, ["Fictional Atlantic Sounds"]);
  await expect(page.locator(".results-geography")).toHaveText(
    "On map: 1 · Not mapped: 0",
  );
  await expect(page).toHaveURL(
    /from=2027-06-01.*to=2027-07-31.*country=PT.*place=lisbon/,
  );
  await expectViews(page, testInfo);
  await page.reload();
  await expectNames(page, ["Fictional Atlantic Sounds"]);
  await expect(
    page
      .getByRole("search")
      .getByRole("textbox", { name: "Search festival names" }),
  ).toHaveValue("atlantic");
});

test("Cancel discards pending edits; Apply and browser history restore them", async ({
  page,
}, testInfo) => {
  await page.goto(year);
  await expect(count(page)).toHaveText("4 events");
  const where = filterOpener(page, "Where");
  await openFilter(page, "Where");
  await page.getByLabel("Spain", { exact: true }).check();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(where).toBeFocused();
  await expect(count(page)).toHaveText("4 events");
  await expect(page).toHaveURL(/to=2027-12-31$/);

  await openFilter(page, "Where");
  await expect(page.getByLabel("Spain", { exact: true })).not.toBeChecked();
  await page.getByLabel("Spain", { exact: true }).check();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expectNames(page, ["Fictional Mediterranean Nights"]);
  await expect(page).toHaveURL(/country=ES/);

  await page.goBack();
  await expect(count(page)).toHaveText("4 events");
  await expect(page).not.toHaveURL(/country=ES/);
  await page.goForward();
  await expectNames(page, ["Fictional Mediterranean Nights"]);
  await expectViews(page, testInfo);
});

test("duration and unknown size produce honest empty states and Clear all resets", async ({
  page,
}, testInfo) => {
  await page.goto(year);
  await openMore(page);
  await page.getByRole("button", { name: "2–3 days" }).click();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expect(count(page)).toHaveText("4 events");
  await expect(page).toHaveURL(/durationMin=2&durationMax=3/);

  await openMore(page);
  await page.getByRole("button", { name: "4+ days" }).click();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expect(count(page)).toHaveText("0 events");
  await expect(page).toHaveURL(/durationMin=4/);
  await expect(page.getByText("No events match these filters.")).toBeVisible();
  const search = page.getByRole("search");
  const searchInput = search.getByRole("textbox", {
    name: "Search festival names",
  });
  await searchInput.fill("atlantic");
  await search.getByRole("button", { name: "Search festival names" }).click();
  await expect(page).toHaveURL(/q=atlantic/);
  await expect(count(page)).toHaveText("0 events");
  await clearFilters(page);
  await expect(page).toHaveURL("http://festivals.localhost:3137/");

  await expect(searchInput).toHaveValue("");
  await expect(count(page)).toHaveText("4 events");

  await page.goto(year);
  await openMore(page);
  await page.getByLabel("Under 1,000").check();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expect(count(page)).toHaveText("0 events");
  await expect(page).toHaveURL(/size=lt-1000/);
  await expectViews(page, testInfo);
});

test("value removal preserves other selections, view, focus and history", async ({
  page,
}) => {
  await page.goto(
    `${year}&country=PT&country=ES&place=Lisbon&genre=rock&view=list`,
  );
  await openFilter(page, "Where");
  await page.getByLabel("Spain", { exact: true }).uncheck();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expect(page).toHaveURL(/country=PT&place=Lisbon&genre=rock&view=list/);
  await expect(page).not.toHaveURL(/country=ES/);
  await expect(filterOpener(page, "Where")).toBeFocused();
  await openFilter(page, "Where");
  await expect(page.getByLabel("Portugal", { exact: true })).toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "City or region" }),
  ).toHaveValue("Lisbon");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goBack();
  await page.reload();
  await openFilter(page, "Where");
  await expect(page.getByLabel("Spain", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/?country=PT&view=list");
  await openFilter(page, "Where");
  await page.getByLabel("Portugal", { exact: true }).uncheck();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expect(filterOpener(page, "Where")).toBeFocused();
  await expect(page).toHaveURL(/\?view=list$/);
});

test("pending counts and validation preserve applied state and applied name query", async ({
  page,
}) => {
  await page.goto(`${year}&q=atlantic`);
  await page
    .getByRole("textbox", { name: "Search festival names" })
    .fill("field");
  await openFilter(page, "More");
  await expect(
    page.getByRole("button", { name: "Show 1 event", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("To", { exact: true }).fill("");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await expect(page.locator("#filter-feedback")).toContainText("date range");
  await expect(count(page)).toHaveText("1 event");
  await expect(page).toHaveURL(/q=atlantic/);
  await page.getByLabel("To", { exact: true }).fill("2027-12-31");
  await page.getByLabel("To", { exact: true }).press("Escape");
  await expect(filterOpener(page, "More")).toBeFocused();
  await openMore(page);
  await page.getByLabel("Minimum days").fill("4");
  await page.getByLabel("Maximum days").fill("3");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await expect(page.locator("#filter-feedback")).toContainText(
    "duration bounds",
  );
  await page.getByLabel("Maximum days").fill("");
  await expect(
    page.getByRole("button", { name: "Show 0 events", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Show 0 events", exact: true })
    .click();
  await expect(count(page)).toHaveText("0 events");
  await expect(
    page.getByRole("textbox", { name: "Search festival names" }),
  ).toHaveValue("atlantic");
});

test("country search and keyboard suggestions keep location edits pending", async ({
  page,
}) => {
  await page.goto(`${year}&country=ES`);
  await openFilter(page, "Where");
  await page.getByRole("searchbox", { name: "Search countries" }).fill("pT");
  await expect(page.getByLabel("Spain", { exact: true })).toBeChecked();
  await page.getByLabel("Portugal", { exact: true }).check();
  const place = page.getByRole("combobox", { name: "City or region" });
  await place.fill("lis");
  await expect(
    page.getByRole("option", { name: "Lisbon Portugal" }),
  ).toBeVisible();
  await place.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.locator("#filter-panel")).toBeVisible();
  await expect(place).toHaveValue("lis");
  await place.press("ArrowDown");
  await place.press("Enter");
  await expect(place).toHaveValue("Lisbon");
  await expect(page.locator("#filter-panel")).toBeVisible();
  await expect(page.getByLabel("Spain", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Portugal", { exact: true })).toBeChecked();
  await expect(count(page)).toHaveText("1 event");
  await expect(page).not.toHaveURL(/place=/);
  await page.getByRole("button", { name: "Show 1 event", exact: true }).click();
  await expect(page).toHaveURL(/country=ES&country=PT&place=Lisbon/);
  await openFilter(page, "Where");
  await expect(place).toHaveValue("Lisbon");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("native unfinished numbers suppress the preview until cleared", async ({
  page,
}) => {
  await page.goto(year);
  await openMore(page);
  const number = page.getByLabel("Minimum days");
  await number.press("-");
  await expect(number).toHaveJSProperty("value", "");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await expect(page.locator("#filter-feedback")).toContainText(
    "Complete or clear",
  );
  await number.press("Backspace");
  await expect(
    page.getByRole("button", { name: "Show 4 events" }),
  ).toBeEnabled();
  await number.press("-");
  await page.getByRole("button", { name: "2–3 days" }).click();
  await expect(
    page.getByRole("button", { name: "Show 4 events" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("native unfinished dates suppress the preview until cleared", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Mobile date pickers do not have keyboard date segments.",
  );
  await page.goto(year);
  await openFilter(page, "More");
  await page.getByLabel("From", { exact: true }).fill("");
  await page.getByLabel("To", { exact: true }).fill("");
  const date = page.getByLabel("From", { exact: true });
  await date.fill("");
  await date.press("ArrowLeft");
  await date.press("1");
  // Chromium's segmented native date editor holds an unfinished date outside value.
  await expect(date).toHaveJSProperty("value", "");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await expect(page.locator("#filter-feedback")).toContainText(
    "Complete or clear",
  );
  await openFilter(page, "Music");
  await openMore(page);
  await page.getByRole("button", { name: "2–3 days" }).click();
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await openFilter(page, "More");
  await expect(date).toHaveJSProperty("value", "");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  const month = page.locator(".month-buttons button").first();
  await month.click();
  await expect(month).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#filter-panel")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("from")).toMatch(
    /^\d{4}-\d{2}-01$/,
  );
  expect(new URL(page.url()).searchParams.has("durationMin")).toBe(false);
  expect(new URL(page.url()).searchParams.has("durationMax")).toBe(false);
});

test("selected countries outside inventory and invalid direct URLs stay recoverable", async ({
  page,
}) => {
  await page.goto(`${year}&country=JP`);

  await openFilter(page, "Where");
  await page
    .getByRole("searchbox", { name: "Search countries" })
    .fill("Portugal");
  await expect(page.getByLabel("Japan", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/?from=2027-01-01");
  await expect(count(page)).toHaveText("Invalid filters");
  await openFilter(page, "Where");
  await page.getByRole("combobox", { name: "City or region" }).fill("unlisted");
  await expect(
    page.getByRole("button", { name: "Show 0 events" }),
  ).toBeEnabled();
  await expect(count(page)).toHaveText("Invalid filters");
  await page.getByRole("button", { name: "Show 0 events" }).click();
  await expect(count(page)).toHaveText("0 events");
  await expect(page).toHaveURL(/place=unlisted/);
});

test("catalog refresh recomputes an open picker preview", async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/discovery", async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    const extra = {
      ...catalog.summaries.find(
        (summary: { year: number }) => summary.year === 2027,
      ),
      id: "refresh-extra",
    };
    await gate;
    await route.fulfill({
      json: { ...catalog, summaries: [...catalog.summaries, extra] },
    });
  });
  await page.goto(year);
  await openFilter(page, "Where");
  await expect(
    page.getByRole("button", { name: "Show 4 events", exact: true }),
  ).toBeEnabled();
  release();
  await expect(
    page.getByRole("button", { name: "Show 5 events", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Show 5 events", exact: true })
    .click();
  await expect(count(page)).toHaveText("5 events");
});

test("readable ranges survive reload and dates restore default matching when removed", async ({
  page,
}) => {
  await page.goto("/?from=2027-08-01&to=2027-08-31&genre=rock&durationMin=4");
  await page.reload();
  await openFilter(page, "More");
  await expect(page.getByLabel("From", { exact: true })).toHaveValue(
    "2027-08-01",
  );
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(
    "2027-08-31",
  );
  await expect(page.getByLabel("Minimum days")).toHaveValue("4");
  await openFilter(page, "Music");
  await expect(page.getByLabel("Rock", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/?from=2025-07-01&to=2025-07-03");
  await expect(count(page)).toHaveText("1 event");
  await openFilter(page, "More");
  await page.getByRole("button", { name: "Clear dates", exact: true }).click();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  await expect(count(page)).toHaveText("4 events");
  await expect(
    list(page).locator('a[href*="/events/fictional-field-days/2025"]'),
  ).toHaveCount(0);
});

test("nearby months apply at once and All preserves other filters", async ({
  page,
}) => {
  const fixedNow = new Date(2026, 11, 15, 12);
  await page.clock.install({ time: fixedNow });
  await page.goto(`${year}&country=PT&genre=rock`);
  const months = page.locator(".month-buttons button");
  await expect(months).toHaveCount(12);
  await expect(page.locator('input[type="month"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "This weekend" })).toHaveCount(
    0,
  );
  for (let offset = 0; offset < 12; offset++) {
    const start = new Date(2026, 11 + offset, 1);
    const prefix = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const lastDay = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    await months.nth(offset).click();
    const params = new URL(page.url()).searchParams;
    expect(params.get("from")).toBe(`${prefix}-01`);
    expect(params.get("to")).toBe(`${prefix}-${lastDay}`);
    expect(params.get("country")).toBe("PT");
    expect(params.get("genre")).toBe("rock");
    await expect(months.nth(offset)).toHaveAttribute("aria-pressed", "true");
    await expect(months.nth(offset)).toBeFocused();
  }
  await openFilter(page, "More");
  if (await page.locator(".sheet-toggle").isVisible()) {
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  const first = months.first();
  await first.click();
  await expect(first).toBeFocused();
  await expect(page.locator("#filter-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  const params = new URL(page.url()).searchParams;
  expect(params.has("from")).toBe(false);
  expect(params.has("to")).toBe(false);
  expect(params.get("country")).toBe("PT");
  expect(params.get("genre")).toBe("rock");
});

test("filter groups share a draft and cancel restores applied values", async ({
  page,
  isMobile,
}) => {
  await page.goto(year);
  const original = page.url();
  async function switchToMusic() {
    if (isMobile) {
      await openFilter(page, "Music");
    } else {
      await page.locator(".filter-trigger-genre").click();
    }
  }
  await openFilter(page, "Where");
  await page.getByLabel("Portugal", { exact: true }).check();
  await switchToMusic();
  await page.getByLabel("Rock", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: /^Show \d+ events?$/ }),
  ).toBeEnabled();
  expect(page.url()).toBe(original);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await openFilter(page, "Where");
  await expect(page.getByLabel("Portugal", { exact: true })).not.toBeChecked();
  await page.getByLabel("Portugal", { exact: true }).check();
  await switchToMusic();
  await page.getByLabel("Rock", { exact: true }).check();
  await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  expect(new URL(page.url()).searchParams.get("country")).toBe("PT");
  expect(new URL(page.url()).searchParams.get("genre")).toBe("rock");
});

test("keyboard suggestions stay visible in a short viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/discovery", async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    const source = catalog.summaries.find(
      (summary: { year: number }) => summary.year === 2027,
    );
    await route.fulfill({
      json: {
        ...catalog,
        summaries: Array.from({ length: 10 }, (_, index) => ({
          ...source,
          id: `town-${index}`,
          locality: `Town ${index}`,
          administrativeArea: null,
        })),
      },
    });
  });
  await page.goto(year);
  await openFilter(page, "Where");
  const input = page.getByRole("combobox", { name: "City or region" });
  await input.fill("Town");
  await expect(page.getByRole("option")).toHaveCount(10);
  for (let index = 0; index < 10; index++) {
    await input.press("ArrowDown");
  }
  const selected = page.getByRole("option", { selected: true });
  await expect(selected).toContainText("Town 9");
  await expect(selected).toBeInViewport();
  await expect(input).toBeFocused();
  const bounds = await selected.boundingBox();
  const fields = await page.locator(".filter-fields").boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(fields!.y);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    fields!.y + fields!.height + 1,
  );
  await input.press("Enter");
  await expect(input).toHaveValue("Town 9");
});

test("mobile sheet keeps focus inside and backdrop discards the draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(year);
  await openFilter(page, "Where");
  await page.getByLabel("Portugal", { exact: true }).check();
  const panel = page.getByRole("dialog", { name: "Filters", exact: true });
  await expect(panel).toHaveJSProperty("open", true);
  const cancel = panel.getByRole("button", { name: "Cancel", exact: true });
  await cancel.focus();
  // Native dialogs can move focus through browser controls before they cycle.
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () =>
        document.activeElement === document.body ||
        Boolean(
          document
            .querySelector("#filter-panel")
            ?.contains(document.activeElement),
        ),
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    panel.getByRole("button", { name: "Clear all", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await page.mouse.click(8, 8);
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".filter-trigger-where")).toBeFocused();
  await expect(page).not.toHaveURL(/country=/);
  await openFilter(page, "Where");
  await expect(page.getByLabel("Portugal", { exact: true })).not.toBeChecked();
});

test("Clear all resets unfinished native fields and remains pending until Apply", async ({
  page,
}) => {
  await page.goto(`${year}&q=atlantic&country=PT`);
  await openFilter(page, "More");
  await page.getByLabel("Minimum days").press("-");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await page
    .locator("#filter-panel")
    .getByRole("button", { name: "Clear all", exact: true })
    .click();
  await expect(page.getByLabel("Minimum days")).toHaveValue("");
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Show 4 events" }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/q=atlantic/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search festival names" }),
  ).toHaveValue("atlantic");
  await openFilter(page, "More");
  await page
    .locator("#filter-panel")
    .getByRole("button", { name: "Clear all", exact: true })
    .click();
  await page.getByRole("button", { name: "Show 4 events" }).click();
  await expect(page).toHaveURL("http://festivals.localhost:3137/");
  await expect(
    page.getByRole("textbox", { name: "Search festival names" }),
  ).toHaveValue("");
});

test("resize preserves native edits and returns focus to a visible trigger", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Use desktop keyboard input to make an unfinished number.",
  );
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(year);
  await openFilter(page, "More");
  const input = page.getByLabel("Minimum days");
  await input.press("-");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await openFilter(page, "Music");
  await openFilter(page, "More");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".filter-trigger-more")).toBeFocused();
  await openFilter(page, "More");
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".filter-trigger-more")).toBeFocused();
});
