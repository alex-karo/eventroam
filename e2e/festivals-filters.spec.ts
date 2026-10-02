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
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expectNames(page, [
    "Fictional Atlantic Sounds 2027",
    "Fictional Field Days 2027",
    "Fictional Mediterranean Nights 2027",
  ]);

  await page.getByRole("button", { name: "Where", exact: true }).click();
  await page.getByLabel("PT", { exact: true }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expectNames(page, [
    "Fictional Atlantic Sounds 2027",
    "Fictional Field Days 2027",
  ]);

  await page.getByRole("button", { name: "Where", exact: true }).click();
  await page.getByLabel("Locality or region").fill("lisbon");
  await page.getByRole("button", { name: "Apply filters" }).click();
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
  await page.getByLabel("ES", { exact: true }).check();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(where).toBeFocused();
  await expect(count(page)).toHaveText("4 editions");
  await expect(page).toHaveURL(/to=2027-12-31$/);

  await where.click();
  await expect(page.getByLabel("ES", { exact: true })).not.toBeChecked();
  await page.getByLabel("ES", { exact: true }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
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
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(count(page)).toHaveText("4 editions");
  await expect(page).toHaveURL(/durationMin=2&durationMax=3/);

  await openMore(page, testInfo);
  await page.getByRole("button", { name: "4+ days" }).click();
  await page.getByRole("button", { name: "Apply filters" }).click();
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
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(count(page)).toHaveText("0 editions");
  await expect(page).toHaveURL(/size=lt-1000/);
  await expectViews(page, testInfo);
});
