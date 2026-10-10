import { expect, test, type Page, type TestInfo } from "@playwright/test";

const year = "/?from=2027-01-01&to=2027-12-31";
const list = (page: Page) => page.getByRole("region", { name: "List results" });
const count = (page: Page) => page.locator(".results-summary strong");

async function expectNames(page: Page, names: string[]) {
  await expect(list(page).locator(".edition-name")).toHaveText(names);
  await expect(count(page)).toHaveText(
    `${names.length} ${names.length === 1 ? "edition" : "editions"}`,
  );
}

async function expectViews(page: Page, testInfo: TestInfo) {
  await expect(list(page)).toBeVisible();
  if (testInfo.project.name === "mobile") {
    const views = page.getByRole("group", { name: "Discovery view" });
    await views.getByRole("button", { name: "Map" }).click();
    await expect(
      page.getByRole("region", { name: "Map results" }),
    ).toBeVisible();
    await expect(list(page)).toBeHidden();
    await views.getByRole("button", { name: "List" }).click();
    await expect(list(page)).toBeVisible();
  } else {
    await expect(
      page.getByRole("region", { name: "Map results" }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Discovery view" }),
    ).toBeHidden();
  }
}

async function openMore(page: Page, testInfo: TestInfo) {
  await page
    .getByRole("button", {
      name: testInfo.project.name === "mobile" ? "Filters" : "More filters",
    })
    .click();
}

test("direct date ranges include overlap and history but exclude cancellations", async ({
  page,
}, testInfo) => {
  await page.goto("/?from=2025-07-02&to=2025-07-02");
  await expectNames(page, ["Fictional Field Days 2025"]);
  await expect(page.locator(".results-geography")).toHaveText(
    "0 mapped · 1 unlocated",
  );
  await expectViews(page, testInfo);

  await page.goto("/?from=2026-07-02&to=2026-07-02");
  await expect(count(page)).toHaveText("0 editions");
  await expect(
    page.getByText("No editions match these filters."),
  ).toBeVisible();

  await page.goto("/?from=2027-07-02&to=2027-07-02");
  await expectNames(page, ["Fictional Field Days 2027"]);
  await expect(list(page).getByText("Tentative dates")).toBeVisible();
});

test("combined date, country, place, and name filters survive reload and view switch", async ({
  page,
}, testInfo) => {
  await page.goto(year);
  await page.getByRole("button", { name: "When", exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("2027-06-01");
  await page.getByLabel("To", { exact: true }).fill("2027-07-31");
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  await expectNames(page, [
    "Fictional Atlantic Sounds 2027",
    "Fictional Field Days 2027",
    "Fictional Mediterranean Nights 2027",
  ]);

  await page.getByRole("button", { name: "Where", exact: true }).click();
  await page.getByLabel("Portugal", { exact: true }).check();
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  await expectNames(page, [
    "Fictional Atlantic Sounds 2027",
    "Fictional Field Days 2027",
  ]);

  await page.getByRole("button", { name: "Where", exact: true }).click();
  await page.getByRole("combobox", { name: "City or region" }).fill("lisbon");
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  await expectNames(page, ["Fictional Atlantic Sounds 2027"]);

  const search = page.getByRole("search");
  const searchInput = search.getByRole("textbox", {
    name: "Search festival names",
  });
  const searchButton = search.getByRole("button", {
    name: "Search festival names",
  });
  await searchInput.fill("field");
  await searchButton.click();
  await expect(count(page)).toHaveText("0 editions");
  await searchInput.fill("atlantic");
  await searchButton.click();

  await expectNames(page, ["Fictional Atlantic Sounds 2027"]);
  await expect(page.locator(".results-geography")).toHaveText(
    "1 mapped · 0 unlocated",
  );
  await expect(page).toHaveURL(
    /from=2027-06-01.*to=2027-07-31.*country=PT.*place=lisbon/,
  );
  await expectViews(page, testInfo);
  await page.reload();
  await expectNames(page, ["Fictional Atlantic Sounds 2027"]);
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
  await expect(count(page)).toHaveText("4 editions");
  const where = page.getByRole("button", { name: "Where", exact: true });
  await where.click();
  await page.getByLabel("Spain", { exact: true }).check();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(where).toBeFocused();
  await expect(count(page)).toHaveText("4 editions");
  await expect(page).toHaveURL(/to=2027-12-31$/);

  await where.click();
  await expect(page.getByLabel("Spain", { exact: true })).not.toBeChecked();
  await page.getByLabel("Spain", { exact: true }).check();
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  await expectNames(page, ["Fictional Mediterranean Nights 2027"]);
  await expect(page).toHaveURL(/country=ES/);

  await page.goBack();
  await expect(count(page)).toHaveText("4 editions");
  await expect(page).not.toHaveURL(/country=ES/);
  await page.goForward();
  await expectNames(page, ["Fictional Mediterranean Nights 2027"]);
  await expectViews(page, testInfo);
});

test("duration and unknown capacity produce honest empty states and Clear all resets", async ({
  page,
}, testInfo) => {
  await page.goto(year);
  await openMore(page, testInfo);
  await page.getByRole("button", { name: "2–3 days" }).click();
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  await expect(count(page)).toHaveText("4 editions");
  await expect(page).toHaveURL(/durationMin=2&durationMax=3/);

  await openMore(page, testInfo);
  await page.getByRole("button", { name: "4+ days" }).click();
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  await expect(count(page)).toHaveText("0 editions");
  await expect(page).toHaveURL(/durationMin=4/);
  await expect(
    page.getByText("No editions match these filters."),
  ).toBeVisible();
  const search = page.getByRole("search");
  const searchInput = search.getByRole("textbox", {
    name: "Search festival names",
  });
  await searchInput.fill("atlantic");
  await search.getByRole("button", { name: "Search festival names" }).click();
  await expect(page).toHaveURL(/q=atlantic/);
  await expect(count(page)).toHaveText("0 editions");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page).toHaveURL("http://festivals.localhost:3137/");
  await expect(page.locator(".chips")).toHaveCount(0);
  await expect(searchInput).toHaveValue("");
  await expect(count(page)).toHaveText("4 editions");

  await page.goto(year);
  await openMore(page, testInfo);
  await page.getByLabel("Under 1,000").check();
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  await expect(count(page)).toHaveText("0 editions");
  await expect(page).toHaveURL(/size=lt-1000/);
  await expectViews(page, testInfo);
});

test("value removal preserves other selections, view, focus and history", async ({
  page,
}) => {
  await page.goto(
    `${year}&country=PT&country=ES&place=Lisbon&genre=rock&view=list`,
  );
  const spain = page.getByRole("button", {
    name: "Remove Spain filter",
    exact: true,
  });
  await expect(spain).toBeVisible();
  await spain.focus();
  await spain.press("Enter");
  await expect(page).toHaveURL(/country=PT&place=Lisbon&genre=rock&view=list/);
  await expect(page).not.toHaveURL(/country=ES/);
  await expect(
    page.getByRole("button", { name: "Remove Portugal filter" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Remove Lisbon filter" }),
  ).toBeVisible();
  await page.goBack();
  await expect(spain).toBeVisible();
  await page.reload();
  await expect(spain).toBeVisible();
  await page.goto("/?country=PT&view=list");
  await page
    .getByRole("button", { name: "Remove Portugal filter" })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: "Clear all", exact: true }),
  ).toBeFocused();
  await expect(page).toHaveURL(/\?view=list$/);
});

test("pending counts and validation preserve applied state and applied name query", async ({
  page,
}, testInfo) => {
  await page.goto(`${year}&q=atlantic`);
  await page
    .getByRole("textbox", { name: "Search festival names" })
    .fill("field");
  await page.getByRole("button", { name: "When", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show 1 edition", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("To", { exact: true }).fill("");
  await expect(
    page.getByRole("button", { name: "Apply filters" }),
  ).toBeDisabled();
  await expect(page.locator("#filter-feedback")).toContainText("date range");
  await expect(count(page)).toHaveText("1 edition");
  await expect(page).toHaveURL(/q=atlantic/);
  await page.getByLabel("To", { exact: true }).fill("2027-12-31");
  await page.getByLabel("To", { exact: true }).press("Escape");
  await expect(
    page.getByRole("button", { name: "When", exact: true }),
  ).toBeFocused();
  await openMore(page, testInfo);
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
    page.getByRole("button", { name: "Show 0 editions", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Show 0 editions", exact: true })
    .click();
  await expect(count(page)).toHaveText("0 editions");
  await expect(
    page.getByRole("button", { name: "Remove atlantic filter" }),
  ).toBeVisible();
});

test("country search and keyboard suggestions keep location edits pending", async ({
  page,
}) => {
  await page.goto(`${year}&country=ES`);
  await page.getByRole("button", { name: "Where", exact: true }).click();
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
  await expect(count(page)).toHaveText("1 edition");
  await expect(page).not.toHaveURL(/place=/);
  await page
    .getByRole("button", { name: "Show 1 edition", exact: true })
    .click();
  await expect(page).toHaveURL(/country=ES&country=PT&place=Lisbon/);
  await expect(
    page.getByRole("button", { name: "Remove Lisbon filter" }),
  ).toBeVisible();
});

test("native unfinished numbers and dates suppress the preview until cleared", async ({
  page,
}, testInfo) => {
  await page.goto(year);
  await openMore(page, testInfo);
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
    page.getByRole("button", { name: "Show 4 editions" }),
  ).toBeEnabled();
  await number.press("-");
  await page.getByRole("button", { name: "2–3 days" }).click();
  await expect(
    page.getByRole("button", { name: "Show 4 editions" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "When", exact: true }).click();
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
  const month = page.locator('[aria-label="Nearby months"] button').first();
  await month.click();
  await expect(month).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /^Show \d+ editions?$/ }),
  ).toBeEnabled();
});

test("selected countries outside inventory and invalid direct URLs stay recoverable", async ({
  page,
}) => {
  await page.goto(`${year}&country=JP`);
  await expect(
    page.getByRole("button", { name: "Remove Japan filter" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Where", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search countries" })
    .fill("Portugal");
  await expect(page.getByLabel("Japan", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/?from=2027-01-01");
  await expect(count(page)).toHaveText("Invalid filters");
  await page.getByRole("button", { name: "Where", exact: true }).click();
  await page.getByRole("combobox", { name: "City or region" }).fill("unlisted");
  await expect(
    page.getByRole("button", { name: "Show 0 editions" }),
  ).toBeEnabled();
  await expect(count(page)).toHaveText("Invalid filters");
  await page.getByRole("button", { name: "Show 0 editions" }).click();
  await expect(count(page)).toHaveText("0 editions");
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
  await page.getByRole("button", { name: "Where", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show 4 editions", exact: true }),
  ).toBeEnabled();
  release();
  await expect(
    page.getByRole("button", { name: "Show 5 editions", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Show 5 editions", exact: true })
    .click();
  await expect(count(page)).toHaveText("5 editions");
});

test("readable ranges survive reload and dates restore default matching when removed", async ({
  page,
}) => {
  await page.goto("/?from=2027-08-01&to=2027-08-31&genre=rock&durationMin=4");
  const dates = page.getByRole("button", {
    name: "Remove 1 Aug 2027 – 31 Aug 2027 filter",
  });
  await expect(dates).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Rock filter" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove 4 or more days filter" }),
  ).toBeVisible();
  await page.reload();
  await expect(dates).toBeVisible();
  await page.goto("/?from=2025-07-01&to=2025-07-03");
  await expect(count(page)).toHaveText("1 edition");
  await page.locator(".chips button").click();
  await expect(count(page)).toHaveText("4 editions");
  await expect(
    list(page).getByText("Fictional Field Days 2025", { exact: true }),
  ).toHaveCount(0);
});

test("nearby month buttons fill dates and preserve explicit apply", async ({
  page,
}) => {
  await page.goto(year);
  await page.getByRole("button", { name: "When", exact: true }).click();
  const months = page.locator('[aria-label="Nearby months"] button');
  await expect(months).toHaveCount(6);
  await expect(page.locator('input[type="month"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "This weekend" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Upcoming and ongoing" }),
  ).toHaveCount(0);
  const originalUrl = page.url();
  for (let offset = 0; offset < 6; offset++) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const prefix = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const lastDay = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    await months.nth(offset).click();
    await expect(page.getByLabel("From", { exact: true })).toHaveValue(
      `${prefix}-01`,
    );
    await expect(page.getByLabel("To", { exact: true })).toHaveValue(
      `${prefix}-${lastDay}`,
    );
    await expect(months.nth(offset)).toHaveAttribute("aria-pressed", "true");
    expect(page.url()).toBe(originalUrl);
  }
  const from = await page.getByLabel("From", { exact: true }).inputValue();
  const to = await page.getByLabel("To", { exact: true }).inputValue();
  await page.getByRole("button", { name: /^Show \d+ editions?$/ }).click();
  expect(new URL(page.url()).searchParams.get("from")).toBe(from);
  expect(new URL(page.url()).searchParams.get("to")).toBe(to);
});
