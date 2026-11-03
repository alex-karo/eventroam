import { openFilter } from "./discovery-controls";
import { expect, test, type Page, type Route } from "./fixtures";

test.beforeEach(async ({}, info) => {
  test.skip(
    info.project.name === "mobile",
    "The preview is a desktop and tablet panel.",
  );
});

const year = "/?from=2027-01-01&to=2027-12-31";
const preview = (page: Page) =>
  page.getByRole("region", { name: "Selected edition details" });
const details = (page: Page, name: string) =>
  page.getByRole("button", {
    name: `${name.includes("Field Days") ? "Select" : "Show on map:"} ${name}`,
  });

async function fulfillAndSettle(page: Page, route: Route) {
  const request = route.request();
  await route.fulfill({ response: await route.fetch() });
  const response = await request.response();
  await response?.finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test("a month that excludes the selected edition keeps month focus", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 11, 15, 12) });
  await page.goto(year);
  await details(page, "Fictional Atlantic Sounds 2027").click();
  await expect(preview(page)).toBeVisible();
  const month = page.getByRole("button", { name: "Dec 2026", exact: true });
  await month.click();
  await expect(preview(page)).toHaveCount(0);
  await expect(month).toBeFocused();
});

test("a late first response cannot replace a newer selection", async ({
  page,
}) => {
  const pending: Route[] = [];
  await page.route("**/api/discovery/*", (route) => {
    pending.push(route);
  });
  await page.goto(year);

  await details(page, "Fictional Atlantic Sounds 2027").click();
  await expect.poll(() => pending.length).toBe(1);
  await details(page, "Fictional Field Days 2027").click();
  await expect.poll(() => pending.length).toBe(2);

  await fulfillAndSettle(page, pending[1]);
  await expect(preview(page).getByRole("heading", { level: 2 })).toHaveText(
    "Fictional Field Days",
  );
  await fulfillAndSettle(page, pending[0]);
  await expect(preview(page).getByRole("heading", { level: 2 })).toHaveText(
    "Fictional Field Days",
  );
  await expect(details(page, "Fictional Field Days 2027")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("closing before a response keeps the preview closed and restores focus", async ({
  page,
}) => {
  let pending: Route | null = null;
  await page.route("**/api/discovery/*", (route) => {
    pending = route;
  });
  await page.goto(year);

  const opener = details(page, "Fictional Atlantic Sounds 2027");
  await opener.click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(preview(page)).toBeVisible();
  await preview(page).getByRole("button", { name: "Close details" }).click();
  await expect(preview(page)).toHaveCount(0);
  await expect(opener).toBeFocused();

  const delayed = pending as Route | null;
  if (!delayed) {
    throw new Error("Expected a held detail request");
  }
  await fulfillAndSettle(page, delayed);
  await expect(preview(page)).toHaveCount(0);
});

test("retry keeps the original opener and Escape closes filters before details", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/discovery/*", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, body: "Unavailable" });
    } else {
      await route.continue();
    }
  });
  await page.goto(year);

  const opener = details(page, "Fictional Atlantic Sounds 2027");
  await opener.click();
  await expect(preview(page).getByRole("alert")).toBeVisible();
  await preview(page).getByRole("button", { name: "Retry details" }).click();
  await expect(preview(page).getByRole("heading", { level: 2 })).toHaveText(
    "Fictional Atlantic Sounds",
  );
  await expect.poll(() => attempts).toBe(2);

  await openFilter(page, "More");
  await expect(page.locator("#filter-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#filter-panel")).toHaveCount(0);
  await expect(preview(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(preview(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
});
