import { expect, test, type Page } from "@playwright/test";
const query = "/?from=2027-01-01&to=2027-12-31&country=PT";
const card = (page: Page) =>
  page.getByRole("region", { name: "Selected edition details" });
const field = "Fictional Field Days 2027";
const fieldEvent = "Fictional Field Days";
async function selectField(page: Page) {
  await page.getByRole("button", { name: `Show details for ${field}` }).click();
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
}
async function snapshot(page: Page) {
  return page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem(
        `eventroam:discovery:${location.origin}:${history.state.eventroamDiscovery}`,
      ) ?? "null",
    ),
  );
}
test("active mobile view keeps its visit and Back/Forward context", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Needs the mobile view switch.");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?from=2027-01-01&to=2027-12-31");
  await selectField(page);
  await card(page).getByRole("button", { name: "Expand details" }).click();
  const column = page.locator(".list-column");
  await column.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const scroll = await column.evaluate((element) => element.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  const views = page.getByRole("group", { name: "Discovery view" });
  const map = views.getByRole("button", { name: "Map", exact: true });
  await map.click();
  await expect.poll(async () => (await snapshot(page))?.scroll).toBe(scroll);
  const before = await snapshot(page);
  const visit = () =>
    page.evaluate(() => ({
      token: history.state.eventroamDiscovery,
      entries: history.length,
    }));
  const initial = await visit();
  await map.click();
  await map.click();
  expect(await visit()).toEqual(initial);
  await page.goBack();
  await expect(
    views.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
  await expect
    .poll(() => column.evaluate((element) => element.scrollTop))
    .toBe(scroll);
  await page.goForward();
  await expect(map).toHaveAttribute("aria-pressed", "true");
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
  await expect(
    card(page).getByRole("button", { name: "Collapse details" }),
  ).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
});
for (const returnPath of ["browser Back", "Back to results"] as const) {
  test(`${returnPath} retains mobile list scroll after a Map visit`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "Needs the mobile view switch.");
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/?from=2027-01-01&to=2027-12-31");
    await selectField(page);
    const column = page.locator(".list-column");
    await column.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const scroll = await column.evaluate((element) => element.scrollTop);
    expect(scroll).toBeGreaterThan(0);
    const views = page.getByRole("group", { name: "Discovery view" });
    await views.getByRole("button", { name: "Map", exact: true }).click();
    await expect.poll(async () => (await snapshot(page))?.scroll).toBe(scroll);
    await card(page).getByRole("link", { name: "View", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(field);
    if (returnPath === "browser Back") {
      await page.goBack();
    } else {
      await page.getByRole("link", { name: returnPath, exact: true }).click();
    }
    await expect(
      views.getByRole("button", { name: "Map", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await views.getByRole("button", { name: "List", exact: true }).click();
    await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
    await expect
      .poll(() => column.evaluate((element) => element.scrollTop))
      .toBe(scroll);
  });

  test(`${returnPath} loads changed public detail into the restored card`, async ({
    page,
  }, info) => {
    await page.goto(query);
    await selectField(page);
    if (info.project.name === "mobile") {
      await card(page).getByRole("button", { name: "Expand details" }).click();
    }
    const before = await snapshot(page);
    await card(page).getByRole("link", { name: "View", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(field);
    await page.route("**/api/discovery/*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({
        json: { ...data, eventName: "Updated festival name" },
      });
    });
    if (returnPath === "browser Back") {
      await page.goBack();
    } else {
      await page.getByRole("link", { name: returnPath, exact: true }).click();
    }
    await expect(card(page).getByRole("heading")).toHaveText(
      "Updated festival name",
    );
    expect((await snapshot(page)).selectedId).toBe(before.selectedId);
    if (info.project.name === "mobile") {
      await expect(
        card(page).getByRole("button", { name: "Collapse details" }),
      ).toBeVisible();
    }
  });
}
test("Edition, Event history, and explicit return keep the same discovery visit", async ({
  page,
}, info) => {
  await page.goto(query);
  await selectField(page);
  if (info.project.name === "mobile") {
    await card(page).getByRole("button", { name: "Expand details" }).click();
  }
  const cardBounds = await card(page).boundingBox();
  const actionBounds = await card(page)
    .getByRole("link", { name: "View", exact: true })
    .boundingBox();
  expect(
    cardBounds!.x + cardBounds!.width - actionBounds!.x - actionBounds!.width,
  ).toBeLessThanOrEqual(16);
  expect(
    cardBounds!.y + cardBounds!.height - actionBounds!.y - actionBounds!.height,
  ).toBeLessThanOrEqual(10);
  const before = await snapshot(page);
  await card(page).getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(field);
  await expect(page.locator(".ticket-categories")).toContainText("€69.90");
  await expect(page.locator(".ticket-categories")).toContainText("Sold out");
  await expect(page.locator(".ticket-categories")).toContainText("Free");
  await expect(page.locator(".ticket-categories")).toContainText(
    "Price not available",
  );
  await expect(
    page.getByText("Not mapped", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Fictional Field Days", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Fictional Field Days",
  );
  await expect(page.locator(".ticket-categories")).toHaveCount(0);
  await page.getByRole("link", { name: "2025", exact: true }).click();
  await expect(page.getByText("Scheduled · Past edition")).toBeVisible();
  await expect(page.locator(".ticket-categories")).not.toContainText(
    ">Available<",
  );
  await expect(
    page.locator(".ticket-status").filter({ hasText: /^Available$/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Tickets (2025)", exact: true }),
  ).toHaveAttribute("title", "Tickets (2025)");
  await page
    .getByRole("link", { name: "Back to results", exact: true })
    .click();
  await expect(page).toHaveURL(/from=2027-01-01&to=2027-12-31&country=PT$/);
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
  if (info.project.name === "mobile") {
    await expect(
      card(page).getByRole("button", { name: "Collapse details" }),
    ).toBeVisible();
  }
  const after = await snapshot(page);
  expect(after.selectedId).toBe(before.selectedId);
  expect(after.expanded).toBe(before.expanded);
  await card(page).getByRole("link", { name: "View", exact: true }).click();
  await page.goBack();
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
});
test("direct details ignore unrelated snapshots and map failure keeps other content", async ({
  page,
}) => {
  await page.goto(query);
  await selectField(page);
  await page.goto("/events/fictional-atlantic-sounds/2027");
  await expect(
    page.getByRole("link", { name: "Back to results", exact: true }),
  ).toHaveAttribute("href", "/");
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
test("compact labeled links and fixed card actions work at 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(query);
  await selectField(page);
  await expect(
    card(page).getByRole("link", { name: "View", exact: true }),
  ).toBeInViewport();
  await expect(card(page).locator(".selected-more")).toBeHidden();
  await card(page)
    .getByRole("button", { name: "Expand details" })
    .press("Enter");
  const link = card(page).getByRole("link", {
    name: "Visitor information",
    exact: true,
  });
  await card(page)
    .getByRole("link", { name: "Festival website", exact: true })
    .press("Tab");
  await expect(link).toBeFocused();
  await expect(
    card(page).getByText("Visitor information", { exact: true }),
  ).toBeVisible();
  const bounds = await link.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(32);
  expect(bounds!.height).toBeLessThan(44);
  const icon = await link.locator("svg").boundingBox();
  expect(icon!.width).toBe(16);
  expect(icon!.height).toBe(16);
  await expect(card(page).getByRole("heading")).toBeInViewport();
  const controls = await card(page).locator(".card-controls").boundingBox();
  expect(controls!.y).toBeGreaterThanOrEqual(0);
  await expect(page.locator(".detail-panel")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await card(page).getByRole("link", { name: "View", exact: true }).click();
  await expect(page.locator(".ticket-categories")).toContainText(
    "Handling fees",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("return reloads selection and clears an Edition removed from eligible results", async ({
  page,
}) => {
  await page.goto(query);
  await selectField(page);
  await card(page).getByRole("link", { name: "View", exact: true }).click();
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
  await page
    .getByRole("link", { name: "Back to results", exact: true })
    .click();
  await expect(page.locator(".results-total strong")).toHaveText("1 event");
  await expect(card(page)).toHaveCount(0);
  await expect(page).toHaveURL(/country=PT$/);
});

test("browser history restores nonzero list scroll and separate search entries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 568 });
  await page.goto("/?from=2027-01-01&to=2027-12-31");
  await selectField(page);
  const column = page.locator(".list-column");
  await column.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(async () => (await snapshot(page))?.scroll)
    .toBeGreaterThan(0);
  const before = await snapshot(page);
  await card(page).getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(field);
  await page.goBack();
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
  await expect
    .poll(() => column.evaluate((element) => element.scrollTop))
    .toBeCloseTo(before.scroll, 0);
  const search = page.getByRole("search");
  await search.getByRole("textbox").fill("atlantic");
  await search.getByRole("button", { name: "Search festival names" }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator(".results-total strong")).toHaveText("1 event");
  await page.goBack();
  await expect(card(page).getByRole("heading")).toHaveText(fieldEvent);
  await expect
    .poll(() => column.evaluate((element) => element.scrollTop))
    .toBeCloseTo(before.scroll, 0);
  await page.goForward();
  await expect(card(page)).toHaveCount(0);
  await expect(page).toHaveURL(/q=atlantic&from=2027-01-01&to=2027-12-31$/);
});

test("enlarged mobile card content scrolls and a new selection starts compact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(query);
  await selectField(page);
  await card(page).getByRole("button", { name: "Expand details" }).click();
  await page.addStyleTag({ content: ".card-scroll { font-size: 200%; }" });
  const scroll = card(page).locator(".card-scroll");
  expect(
    await scroll.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  const action = card(page).getByRole("link", { name: "View", exact: true });
  const actionBeforeScroll = await action.boundingBox();
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(action).toBeInViewport();
  expect(await action.boundingBox()).toEqual(actionBeforeScroll);
  await expect(card(page).getByRole("heading")).toBeInViewport();
  await expect(
    card(page).getByRole("button", { name: "Collapse details" }),
  ).toBeInViewport();
  await expect(
    card(page).getByRole("link", { name: "Tickets", exact: true }),
  ).toBeInViewport();
  await card(page).getByRole("button", { name: "Close details" }).click();
  await page
    .getByRole("button", {
      name: "Show details for Fictional Atlantic Sounds 2027",
    })
    .click();
  await expect(
    card(page).getByRole("button", { name: "Expand details" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(card(page).locator(".selected-more")).toBeHidden();
});
