import { expect, test, type Page } from "./fixtures";
import { openEdition } from "./discovery-controls";

const query = "/?from=2027-01-01&to=2027-12-31&country=PT";
const field = "Fictional Field Days 2027";
const fieldEvent = "Fictional Field Days";
const card = (page: Page) => page.locator(".detail-panel");
const fieldRow = (page: Page) =>
  page.getByRole("button", {
    name: `Select ${field}`,
    exact: true,
    includeHidden: true,
  });
const fieldPage = (page: Page) =>
  card(page).getByRole("link", { name: "Open page", exact: true });

async function expectField(page: Page) {
  await expect(fieldRow(page)).toHaveAttribute("aria-pressed", "true");
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
}
async function selectField(page: Page) {
  await fieldRow(page).click();
  await expectField(page);
}
test("the page link opens a new tab and keeps the selected result", async ({
  page,
}) => {
  await page.goto(query);
  const url = page.url();
  await selectField(page);
  await expect(page).toHaveURL(url);
  await expect(fieldRow(page)).toContainText("Not mapped");
  const popup = page.waitForEvent("popup");
  await fieldPage(page).click();
  const details = await popup;
  await expect(details.getByRole("heading", { level: 1 })).toHaveText(field);
  await expect(page).toHaveURL(url);
  await expectField(page);
  await expect(details.locator(".ticket-categories")).toContainText("€69.90");
  await expect(details.locator(".ticket-categories")).toContainText("Sold out");
  await expect(details.locator(".ticket-categories")).toContainText("Free");
  await expect(details.locator(".ticket-categories")).toContainText(
    "Price not available",
  );
});

test("closing an edition tab keeps selection and the mobile sheet", async ({
  page,
}) => {
  await page.goto(query);
  const toggle = page.locator(".sheet-toggle");
  const mobile = await toggle.isVisible();
  if (mobile) {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  await selectField(page);
  const details = await openEdition(page, field);
  await expect(details.getByRole("heading", { level: 1 })).toHaveText(field);
  await expect(
    details.getByRole("link", { name: "Back to results", exact: true }),
  ).toHaveCount(0);
  await details.close();
  await expectField(page);
  if (mobile) {
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
});

test("festival and edition history links open separate tabs", async ({
  page,
}) => {
  await page.goto("/events/fictional-field-days/2027");
  await expect(
    page.locator('a[href="/events/fictional-field-days"]'),
  ).toHaveCount(1);
  const eventPopup = page.waitForEvent("popup");
  await page
    .getByRole("region", { name: "Other editions" })
    .getByRole("link", { name: "Festival overview", exact: true })
    .click();
  const event = await eventPopup;
  await expect(event.getByRole("heading", { level: 1 })).toHaveText(fieldEvent);
  await expect(event.locator(".ticket-categories")).toHaveCount(0);
  const pastPopup = event.waitForEvent("popup");
  await event.getByRole("link", { name: "2025", exact: true }).click();
  const past = await pastPopup;
  await expect(past.getByText("Scheduled · Past edition")).toBeVisible();
  await expect(
    past.locator(".ticket-status").filter({ hasText: /^Available$/ }),
  ).toHaveCount(0);
  await expect(
    past.getByRole("link", { name: "Tickets (2025)", exact: true }),
  ).toHaveAttribute("title", "Tickets (2025)");
  await expect(
    past.getByRole("link", { name: "Back to results", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(field);
});

test("direct details retain content if the map fails", async ({ page }) => {
  await page.goto(query);
  await selectField(page);
  await page.goto("/events/fictional-atlantic-sounds/2027");
  await expect(
    page.getByRole("link", { name: "Back to results", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open approximate location", exact: true }),
  ).toHaveAttribute("href", /google.com\/maps\/search\//);
  if (process.env.E2E_REAL_MAP !== "1") {
    await expect(
      page.getByText(
        "Map is unavailable. Use the external map link to view this location.",
      ),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "About the festival" }),
  ).toBeVisible();
});

for (const width of [320, 390]) {
  test(`the map, results sheet, page action, and footer fit at ${width} pixels`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await page.goto(query);
    const toggle = page.locator(".sheet-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const compact = await page.locator(".results-panel").boundingBox();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const expanded = await page.locator(".results-panel").boundingBox();
    expect(expanded!.height).toBeGreaterThan(compact!.height);
    await selectField(page);
    await expect(card(page)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "List results" }),
    ).toBeHidden();
    await expect(card(page).locator(".preview-date")).toContainText(
      "1–3 Jul 2027",
    );
    await expect(
      card(page).getByText("Example Valley, Portugal", { exact: false }),
    ).toBeVisible();
    await expect(card(page).getByText("From €69.90")).toBeHidden();
    await card(page).getByRole("button", { name: "Expand details" }).click();
    await expect(card(page).getByText("From €69.90")).toBeVisible();
    await expect(
      card(page).getByRole("link", { name: "Festival website", exact: true }),
    ).toBeVisible();
    await card(page).getByRole("button", { name: "Collapse details" }).click();
    await expect(card(page).getByText("From €69.90")).toBeHidden();
    await expect(fieldPage(page)).toBeInViewport();
    await expect(
      page.getByRole("region", { name: "Map results" }),
    ).toBeInViewport();
    await expect(page.locator(".discovery-footer")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const popup = page.waitForEvent("popup");
    await fieldPage(page).click();
    const details = await popup;
    await expect(details.locator(".ticket-categories")).toContainText(
      "Handling fees",
    );
    expect(
      await details.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await details.close();
    await card(page).getByRole("button", { name: "Close details" }).click();
    await expect(fieldRow(page)).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("region", { name: "List results" }),
    ).toBeVisible();
  });
}

test("a short mobile card keeps its controls and page action reachable with a long title and a catalog error", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const name =
    "Fictional Festival of Independent Music and Arts with Performances from Across Portugal";
  await page.route("**/api/discovery", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.route("**/api/discovery/*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), eventName: name },
    });
  });
  await page.goto(query);
  const retry = page.getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeVisible();
  await fieldRow(page).click();
  const selected = card(page);
  await expect(selected.getByRole("heading")).toHaveText(name);

  for (const action of [null, "Expand details", "Collapse details"]) {
    if (action) {
      await selected.getByRole("button", { name: action }).click();
    }
    await expect
      .poll(() =>
        selected.evaluate((element) => {
          const panel = element.getBoundingClientRect();
          const header = element
            .querySelector(".card-header")!
            .getBoundingClientRect();
          const footer = element
            .querySelector(".card-footer")!
            .getBoundingClientRect();
          const body = element.querySelector(".card-scroll")!;
          const padding = getComputedStyle(body);
          return {
            headerInside:
              header.top >= panel.top && header.bottom <= panel.bottom,
            footerInside:
              footer.top >= panel.top && footer.bottom <= panel.bottom,
            bodyHasRoom:
              body.clientHeight -
                parseFloat(padding.paddingTop) -
                parseFloat(padding.paddingBottom) >
              0,
          };
        }),
      )
      .toMatchObject({
        headerInside: true,
        footerInside: true,
        bodyHasRoom: true,
      });
  }

  const popup = page.waitForEvent("popup");
  await fieldPage(page).click();
  const details = await popup;
  await expect(details.getByRole("heading", { level: 1 })).toHaveText(field);
  await details.close();
  await retry.click();
  await selected.getByRole("button", { name: "Close details" }).click();
  await expect(fieldRow(page)).toBeFocused();
});

test("reload clears a selection removed from eligible results", async ({
  page,
}) => {
  await page.goto(query);
  await selectField(page);
  const details = await openEdition(page, field);
  await expect(details.getByRole("heading", { level: 1 })).toHaveText(field);
  await details.close();
  await page.route("**/api/discovery", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      json: {
        ...data,
        summaries: data.summaries.filter(
          (item: { eventSlug: string }) =>
            item.eventSlug !== "fictional-field-days",
        ),
      },
    });
  });
  await page.reload();
  await expect(page.locator(".results-count")).toHaveText("1 event");
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator(".edition-select[aria-pressed=true]")).toHaveCount(
    0,
  );
});

test("browser history restores list scroll and separate search entries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 568 });
  await page.goto("/?from=2027-01-01&to=2027-12-31");
  await selectField(page);
  const column = page.locator(".list-column");
  const lastPage = page.getByRole("link", {
    name: "Open page for Fictional Rhône Sessions 2027",
  });
  await lastPage.scrollIntoViewIfNeeded();
  const scroll = await column.evaluate((element) => element.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  const details = await openEdition(page, "Fictional Rhône Sessions 2027");
  await expect(details.getByRole("heading", { level: 1 })).toHaveText(
    "Fictional Rhône Sessions 2027",
  );
  await details.close();
  await expectField(page);
  await expect
    .poll(() => column.evaluate((element) => element.scrollTop))
    .toBeCloseTo(scroll, 0);
  const search = page.getByRole("search");
  await search.getByRole("textbox").fill("atlantic");
  await search.getByRole("button", { name: "Search festival names" }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator(".results-count")).toHaveText("1 event");
  await page.goBack();
  await expectField(page);
  await expect
    .poll(() => column.evaluate((element) => element.scrollTop))
    .toBeCloseTo(scroll, 0);
  await page.goForward();
  await expect(card(page)).toHaveCount(0);
  await expect(page).toHaveURL(/q=atlantic&from=2027-01-01&to=2027-12-31$/);
});

test("mobile history restores list scroll at each sheet height", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "This checks the mobile sheet.");
  await page.setViewportSize({ width: 390, height: 568 });
  await page.goto("/?from=2027-01-01&to=2027-12-31");
  const toggle = page.locator(".sheet-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("link", {
      name: "Open page for Fictional Rhône Sessions 2027",
    })
    .scrollIntoViewIfNeeded();
  const column = page.locator(".list-column");
  const expandedScroll = await column.evaluate((element) => element.scrollTop);
  expect(expandedScroll).toBeGreaterThan(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const compactScroll = await column.evaluate((element) => element.scrollTop);
  expect(compactScroll).toBeGreaterThan(0);
  await page.goBack();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(() => column.evaluate((element) => element.scrollTop))
    .toBeCloseTo(expandedScroll, 0);
  await page.goForward();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() => column.evaluate((element) => element.scrollTop))
    .toBeCloseTo(compactScroll, 0);
});

test("desktop preview shows all facts and opens pages in new tabs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(query);
  await selectField(page);
  await expect(
    card(page).getByRole("button", { name: /Expand details|Collapse details/ }),
  ).toHaveCount(0);
  await expect(card(page).getByText("From €69.90")).toBeVisible();
  await card(page)
    .getByRole("link", { name: "Festival website", exact: true })
    .press("Tab");
  await expect(
    card(page).getByRole("link", { name: "Visitor information", exact: true }),
  ).toBeFocused();
  await expect(
    card(page).getByRole("link", { name: "Open page", exact: true }),
  ).toBeInViewport();
  for (const link of [
    card(page).getByRole("link", { name: fieldEvent, exact: true }),
    card(page).getByRole("link", { name: "Open page", exact: true }),
  ]) {
    const popup = page.waitForEvent("popup");
    await link.click();
    const details = await popup;
    await expect(details.getByRole("heading", { level: 1 })).toHaveText(field);
    await details.close();
    await expectField(page);
  }
  await card(page).getByRole("button", { name: "Close details" }).click();
  await expect(fieldRow(page)).toBeFocused();
});
