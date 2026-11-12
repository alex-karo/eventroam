import { expect, test, type Page } from "./fixtures";
import { openEdition } from "./discovery-controls";
test.skip(
  process.env.E2E_REAL_MAP !== "1",
  "Needs an opt-in local Mapbox token.",
);
async function camera(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem(
          `eventroam:discovery:${location.origin}:${history.state?.eventroamDiscovery}`,
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
async function expectClearSelection(page: Page) {
  await expect
    .poll(async () => {
      const marker = await page.locator(".selected-map-point").boundingBox();
      const map = await page.locator(".map-region").boundingBox();
      if (
        !marker ||
        !map ||
        marker.x < map.x ||
        marker.x + marker.width > map.x + map.width ||
        marker.y < map.y ||
        marker.y + marker.height > map.y + map.height
      ) {
        return false;
      }
      for (const selector of [
        ".detail-panel",
        ".results-panel",
        ".discovery-controls",
        ".discovery-months",
        '[aria-label="Map controls"]',
      ]) {
        const panel = await page.locator(selector).boundingBox();
        if (!panel) {
          continue;
        }
        const gap = Math.max(
          panel.x - marker.x - marker.width,
          marker.x - panel.x - panel.width,
          panel.y - marker.y - marker.height,
          marker.y - panel.y - panel.height,
        );
        if (gap < (selector === ".detail-panel" ? 27 : 0)) {
          return false;
        }
      }
      return true;
    })
    .toBe(true);
}

test("a mobile tap opens the bottom card and keeps the selected point clear", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "This checks touch selection.");
  await page.goto("/?from=2027-01-01&to=2027-12-31&country=PT");
  await expect
    .poll(() => camera(page))
    .toMatchObject({ zoom: expect.any(Number) });
  const card = page.getByRole("region", { name: "Selected edition details" });
  await page
    .getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
    })
    .click();
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds",
  );
  await expectClearSelection(page);
  const marker = (await page.locator(".selected-map-point").boundingBox())!;
  const selectedMap = (await page.locator(".map-canvas").boundingBox())!;
  await card.getByRole("button", { name: "Close details" }).click();
  const map = (await page.locator(".map-canvas").boundingBox())!;
  await expect
    .poll(
      async () =>
        (await page.locator(".mapboxgl-canvas").boundingBox())?.height,
    )
    .toBeCloseTo(map.height, 0);
  const before = await camera(page);

  await page.touchscreen.tap(
    marker.x + marker.width / 2,
    marker.y + marker.height / 2 + (map.height - selectedMap.height) / 2,
  );
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds",
  );
  await expect(
    card.getByRole("link", { name: "Open page", exact: true }),
  ).toBeInViewport();
  await expect(page.getByRole("region", { name: "List results" })).toBeHidden();
  await expectClearSelection(page);
  expect((await camera(page)).zoom).toBeCloseTo(before.zoom, 6);

  await card.getByRole("button", { name: "Expand details" }).click();
  await expectClearSelection(page);
  expect((await camera(page)).zoom).toBeCloseTo(before.zoom, 6);
  const expanded = await camera(page);
  await card.getByRole("button", { name: "Close details" }).click();
  await expect(
    page.getByRole("region", { name: "List results" }),
  ).toBeVisible();
  expect(await camera(page)).toEqual(expanded);
});

test("selecting a point covered by the results reveals it between overlays", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Needs the desktop map overlays.");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?from=2027-01-01&to=2027-12-31");
  await expect
    .poll(() => camera(page))
    .toMatchObject({ zoom: expect.any(Number) });
  const select = page.getByRole("button", {
    name: "Show on map: Fictional Atlantic Sounds 2027",
    includeHidden: true,
  });
  await select.click();
  await expect(page.locator(".detail-panel h2")).toHaveText(
    "Fictional Atlantic Sounds",
  );
  await expectClearSelection(page);
  const point = page.locator(".selected-map-point");
  const marker = (await point.boundingBox())!;
  const results = (await page.locator(".results-panel").boundingBox())!;
  const controls = (await page.locator(".discovery-controls").boundingBox())!;
  const target = {
    x: results.x + results.width / 2,
    y: results.y + results.height / 2,
  };
  const delta = {
    x: target.x - marker.x - marker.width / 2,
    y: target.y - marker.y - marker.height / 2,
  };
  // Keep the drag itself on the exposed canvas, clear of the panels.
  const start = {
    x: results.x + results.width + 40 - Math.min(0, delta.x),
    y: controls.y + controls.height + 40 - Math.min(0, delta.y),
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 10 });
  // Stop before release so map inertia does not move the point past the panel.
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect
    .poll(async () => {
      const covered = await point.boundingBox();
      return (
        covered !== null &&
        covered.x >= results.x &&
        covered.x + covered.width <= results.x + results.width &&
        covered.y >= results.y &&
        covered.y + covered.height <= results.y + results.height
      );
    })
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(point).toHaveCount(0);
  await select.click();
  await expectClearSelection(page);
});

for (const change of ["moved", "removed"] as const) {
  test(`catalog retry updates a selected point when coordinates are ${change}`, async ({
    page,
  }) => {
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
        name: "Show on map: Fictional Atlantic Sounds 2027",
        includeHidden: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Show on map: Fictional Atlantic Sounds 2027",
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".detail-panel h2")).toHaveText(
      "Fictional Atlantic Sounds",
    );
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
    }
    // The new coordinates can be outside the current camera view.
    expect(await renderedCamera(page)).toEqual(before);
    await expect(
      page.getByRole("button", {
        name: `${change === "removed" ? "Select" : "Show on map:"} Fictional Atlantic Sounds 2027`,
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}
test("opening an edition tab preserves a camera panned away from the selection", async ({
  page,
}, info) => {
  await page.goto("/?from=2027-01-01&to=2027-12-31");
  const select = page.getByRole("button", {
    name: "Show on map: Fictional Atlantic Sounds 2027",
    includeHidden: true,
  });
  await select.click();
  await expect(
    page.getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => camera(page))
    .toMatchObject({ zoom: expect.any(Number) });
  const map = await page.locator(".map-canvas").boundingBox();
  const y =
    info.project.name === "mobile" ? map!.y + map!.height / 2 : map!.y + 160;
  const startX = info.project.name === "mobile" ? map!.x + 30 : map!.x + 410;
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
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(map!.x + map!.width - 30, y, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => camera(page)).not.toEqual(initial);
  }
  await expect.poll(pointOutside).toBe(true);
  const saved = await camera(page);
  const rendered = await renderedCamera(page);
  const details = await openEdition(page, "Fictional Atlantic Sounds 2027");
  await expect(details.getByRole("heading", { level: 1 })).toHaveText(
    "Fictional Atlantic Sounds 2027",
  );
  await details.close();
  await expect(
    page.getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(point).toHaveCount(1);
  await expect.poll(() => renderedCamera(page)).toEqual(rendered);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Expand details" }).click();
    await expect(
      page.getByRole("button", { name: "Collapse details" }),
    ).toHaveAttribute("aria-expanded", "true");
  } else {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ ...viewport, height: viewport.height + 40 });
  }
  await expect.poll(() => renderedCamera(page)).toEqual(rendered);
  const restored = await camera(page);
  expect(restored.longitude).toBeCloseTo(saved.longitude, 5);
  expect(restored.latitude).toBeCloseTo(saved.latitude, 5);
  expect(restored.zoom).toBeCloseTo(saved.zoom, 6);

  await page.keyboard.press("Escape");
  await select.click();
  await expect(
    page.getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(point).toBeInViewport();
  expect((await camera(page)).zoom).toBeCloseTo(saved.zoom, 6);
});
test("clustered selection stays visible and preserves the camera when opening details", async ({
  page,
}) => {
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
  await page
    .getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  const point = page.locator(".selected-map-point");
  await expect(point).toBeVisible();
  await expectClearSelection(page);
  expect((await camera(page)).zoom).toBeCloseTo(before.zoom, 6);
  const selected = await camera(page);
  await page.keyboard.press("Escape");
  expect(await camera(page)).toEqual(selected);
  await page
    .getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    })
    .click();
  await expect(page.locator(".detail-panel .view-edition")).toBeVisible();
  const details = await openEdition(page, "Fictional Atlantic Sounds 2027");
  await expect(details.locator(".location-canvas canvas")).toBeVisible();
  await details.close();
  await expect(
    page.getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
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
  const card = page.locator(".detail-panel");
  await page
    .getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  const point = await page.locator(".selected-map-point").boundingBox();
  const position = {
    x: point!.x + point!.width / 2,
    y: point!.y + point!.height / 2,
  };
  await page.mouse.move(position.x, position.y);
  await expect(page.locator(".mapboxgl-popup")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0);
  await page.mouse.move(position.x, position.y);
  await expect(page.locator(".mapboxgl-popup")).toContainText(
    "Fictional Atlantic Sounds",
  );
  await page.mouse.click(position.x, position.y);
  await expect(
    page.getByRole("button", {
      name: "Show on map: Fictional Atlantic Sounds 2027",
      includeHidden: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".mapboxgl-popup")).toHaveCount(0);
  const before = await camera(page);
  await page
    .getByRole("button", { name: "Select Fictional Field Days 2027" })
    .click();
  await expect(card.getByRole("heading")).toHaveText("Fictional Field Days");
  await expect(page.locator(".selected-map-point")).toHaveCount(0);
  expect(await camera(page)).toEqual(before);
});

test.describe("with the analytics banner", () => {
  test.use({ showAnalyticsBanner: true });

  test("the selected point stays clear of the detail card", async ({
    page,
  }) => {
    await page.goto("/?from=2027-01-01&to=2027-12-31");
    const banner = page.getByRole("complementary", {
      name: "Analytics choice",
    });
    await expect(banner).toBeVisible();
    await page
      .getByRole("button", {
        name: "Show on map: Fictional Atlantic Sounds 2027",
        includeHidden: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Show on map: Fictional Atlantic Sounds 2027",
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expectClearSelection(page);
    await banner.getByRole("button", { name: "Disable analytics" }).click();
    await expect(banner).toHaveCount(0);
    await expectClearSelection(page);
  });
});
