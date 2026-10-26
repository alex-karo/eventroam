import { expect, test, type Page } from "@playwright/test";
test.skip(
  process.env.E2E_REAL_MAP !== "1",
  "Needs an opt-in local Mapbox token.",
);
async function camera(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem(
          `eventroam:discovery:${location.origin}:${history.state.eventroamDiscovery}`,
        ) ?? "null",
      )?.camera,
  );
}
async function renderedCamera(page: Page) {
  const href = await page
    .locator(
      ".mapboxgl-ctrl-attrib a[href^='https://apps.mapbox.com/feedback/']",
    )
    .getAttribute("href");
  return new URL(href!).hash.slice(2).split("/").map(Number);
}
for (const change of ["moved", "removed"] as const) {
  test(`catalog retry updates a selected point when coordinates are ${change}`, async ({
    page,
  }, info) => {
    let refresh = false;
    await page.route("**/api/discovery", async (route) => {
      if (!refresh) {
        await route.fulfill({ status: 503, body: "Unavailable" });
        return;
      }
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({
        json: {
          ...data,
          summaries: data.summaries.map((item: { eventSlug: string }) =>
            item.eventSlug === "fictional-atlantic-sounds"
              ? {
                  ...item,
                  latitude: change === "moved" ? 41.1579 : null,
                  longitude: change === "moved" ? -8.6291 : null,
                }
              : item,
          ),
        },
      });
    });
    await page.goto("/?from=2027-01-01&to=2027-12-31&country=PT");
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    await expect(retry).toBeVisible();
    await page
      .getByRole("button", {
        name: "Show details for Fictional Atlantic Sounds 2027",
      })
      .click();
    const card = page.getByRole("region", { name: "Selected edition details" });
    await expect(card.getByRole("heading")).toHaveText(
      "Fictional Atlantic Sounds 2027",
    );
    if (info.project.name === "mobile") {
      await page
        .getByRole("group", { name: "Discovery view" })
        .getByRole("button", { name: "Map", exact: true })
        .click();
    }
    const point = page.locator(".selected-map-point");
    await expect(point).toBeInViewport();
    await expect
      .poll(() => camera(page))
      .toMatchObject({ zoom: expect.any(Number) });
    const before = await renderedCamera(page);
    const position = await point.getAttribute("style");
    refresh = true;
    await retry.click();
    await expect(retry).toHaveCount(0);
    if (change === "removed") {
      await expect(point).toHaveCount(0);
    } else {
      await expect(point).not.toHaveAttribute("style", position!);
      await expect(point).toBeInViewport();
    }
    expect(await renderedCamera(page)).toEqual(before);
    await expect(card.getByRole("heading")).toHaveText(
      "Fictional Atlantic Sounds 2027",
    );
  });
}
for (const returnPath of ["browser Back", "Back to results"] as const) {
  test(`${returnPath} preserves a camera panned away from the selection`, async ({
    page,
  }, info) => {
    await page.goto("/?from=2027-01-01&to=2027-12-31");
    const card = page.getByRole("region", { name: "Selected edition details" });
    const select = page.getByRole("button", {
      name: "Show details for Fictional Atlantic Sounds 2027",
    });
    await select.click();
    await expect(card.getByRole("heading")).toHaveText(
      "Fictional Atlantic Sounds 2027",
    );
    const views = page.getByRole("group", { name: "Discovery view" });
    if (info.project.name === "mobile") {
      await views.getByRole("button", { name: "Map", exact: true }).click();
    }
    await expect
      .poll(() => camera(page))
      .toMatchObject({ zoom: expect.any(Number) });
    const map = await page.locator(".map-canvas").boundingBox();
    const y = map!.y + 160;
    const point = page.locator(".selected-map-point");
    const pointOutside = async () => {
      const marker = await point.boundingBox();
      return (
        marker !== null &&
        (marker.x >= map!.x + map!.width ||
          marker.x + marker.width <= map!.x ||
          marker.y >= map!.y + map!.height ||
          marker.y + marker.height <= map!.y)
      );
    };
    for (let attempt = 0; attempt < 3 && !(await pointOutside()); attempt++) {
      const initial = await camera(page);
      await page.mouse.move(map!.x + 30, y);
      await page.mouse.down();
      await page.mouse.move(map!.x + map!.width - 30, y, { steps: 10 });
      await page.mouse.up();
      await expect.poll(() => camera(page)).not.toEqual(initial);
    }
    await expect.poll(pointOutside).toBe(true);
    const saved = await camera(page);
    const rendered = await renderedCamera(page);
    await card.getByRole("link", { name: "View", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fictional Atlantic Sounds 2027",
    );
    if (returnPath === "browser Back") {
      await page.goBack();
    } else {
      await page.getByRole("link", { name: returnPath, exact: true }).click();
    }
    await expect(card.getByRole("heading")).toHaveText(
      "Fictional Atlantic Sounds 2027",
    );
    await expect(point).toHaveCount(1);
    await expect.poll(() => renderedCamera(page)).toEqual(rendered);
    if (info.project.name === "mobile") {
      await card.getByRole("button", { name: "Expand details" }).click();
      await expect(
        card.getByRole("button", { name: "Collapse details" }),
      ).toBeVisible();
    } else {
      const viewport = page.viewportSize()!;
      await page.setViewportSize({ ...viewport, height: viewport.height + 40 });
    }
    await expect.poll(() => renderedCamera(page)).toEqual(rendered);
    const restored = await camera(page);
    expect(restored.longitude).toBeCloseTo(saved.longitude, 5);
    expect(restored.latitude).toBeCloseTo(saved.latitude, 5);
    expect(restored.zoom).toBeCloseTo(saved.zoom, 6);

    await card.getByRole("button", { name: "Close details" }).click();
    if (info.project.name === "mobile") {
      await views.getByRole("button", { name: "List", exact: true }).click();
    }
    await select.click();
    await expect(card.getByRole("heading")).toHaveText(
      "Fictional Atlantic Sounds 2027",
    );
    if (info.project.name === "mobile") {
      await views.getByRole("button", { name: "Map", exact: true }).click();
    }
    await expect(point).toBeInViewport();
    expect((await camera(page)).zoom).toBeCloseTo(saved.zoom, 6);
  });
}
test("clustered selection stays visible, preserves zoom, and returns to the same camera", async ({
  page,
}, info) => {
  await page.route("**/api/discovery", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      json: {
        ...data,
        summaries: data.summaries.map(
          (item: { latitude: number | null; longitude: number | null }) =>
            item.latitude === null
              ? item
              : { ...item, latitude: 38.7223, longitude: -9.1393 },
        ),
      },
    });
  });
  await page.goto("/?from=2027-01-01&to=2027-12-31&view=map");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await expect
    .poll(() => camera(page))
    .toMatchObject({ zoom: expect.any(Number) });
  const before = await camera(page);
  if (info.project.name === "mobile") {
    await page
      .getByRole("group", { name: "Discovery view" })
      .getByRole("button", { name: "List", exact: true })
      .click();
  }
  await page
    .getByRole("button", {
      name: "Show details for Fictional Atlantic Sounds 2027",
    })
    .click();
  const card = page.getByRole("region", { name: "Selected edition details" });
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds 2027",
  );
  if (info.project.name === "mobile") {
    await page
      .getByRole("group", { name: "Discovery view" })
      .getByRole("button", { name: "Map", exact: true })
      .click();
  }
  const point = page.locator(".selected-map-point");
  await expect(point).toBeVisible();
  const marker = await point.boundingBox(),
    panel = await card.boundingBox();
  expect(
    marker!.x + marker!.width + 27 <= panel!.x ||
      marker!.x >= panel!.x + panel!.width + 27 ||
      marker!.y + marker!.height + 27 <= panel!.y ||
      marker!.y >= panel!.y + panel!.height + 27,
  ).toBe(true);
  expect((await camera(page)).zoom).toBeCloseTo(before.zoom, 6);
  const selected = await camera(page);
  await card.getByRole("button", { name: "Close details" }).click();
  expect(await camera(page)).toEqual(selected);
  if (info.project.name === "mobile") {
    await page
      .getByRole("group", { name: "Discovery view" })
      .getByRole("button", { name: "List", exact: true })
      .click();
  }
  await page
    .getByRole("button", {
      name: "Show details for Fictional Atlantic Sounds 2027",
    })
    .click();
  await expect(
    card.getByRole("link", { name: "View", exact: true }),
  ).toBeVisible();
  await card.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.locator(".location-canvas canvas")).toBeVisible();
  await page
    .getByRole("link", { name: "Back to results", exact: true })
    .click();
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds 2027",
  );
  await expect.poll(() => camera(page)).toMatchObject({ zoom: selected.zoom });
  const restored = await camera(page);
  expect(restored.latitude).toBeCloseTo(selected.latitude, 5);
  expect(restored.longitude).toBeCloseTo(selected.longitude, 5);
});

test("marker hover resumes after close and unlocated selection leaves the camera unchanged", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Hover needs a pointer.");
  await page.goto("/?from=2027-01-01&to=2027-12-31&view=map");
  await expect
    .poll(() => camera(page))
    .toMatchObject({ zoom: expect.any(Number) });
  const card = page.getByRole("region", { name: "Selected edition details" });
  await page
    .getByRole("button", {
      name: "Show details for Fictional Atlantic Sounds 2027",
    })
    .click();
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds 2027",
  );
  const point = await page.locator(".selected-map-point").boundingBox();
  const position = {
    x: point!.x + point!.width / 2,
    y: point!.y + point!.height / 2,
  };
  await page.mouse.move(position.x, position.y);
  await expect(page.locator(".mapboxgl-popup")).toHaveCount(0);
  await card.getByRole("button", { name: "Close details" }).click();
  await page.mouse.move(0, 0);
  await page.mouse.move(position.x, position.y);
  await expect(page.locator(".mapboxgl-popup")).toContainText(
    "Fictional Atlantic Sounds 2027",
  );
  await page.mouse.click(position.x, position.y);
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds 2027",
  );
  await expect(page.locator(".mapboxgl-popup")).toHaveCount(0);
  const before = await camera(page);
  await page
    .getByRole("button", { name: "Show details for Fictional Field Days 2027" })
    .click();
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Field Days 2027",
  );
  await expect(page.locator(".selected-map-point")).toHaveCount(0);
  expect(await camera(page)).toEqual(before);
});
