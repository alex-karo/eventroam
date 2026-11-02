import { expect, test } from "./fixtures";
import { preferenceKey } from "../src/site/analytics";

test.use({ showAnalyticsBanner: true });

for (const [label, value] of [
  ["Disable analytics", "disabled"],
  ["Basic statistics", "0"],
  ["Allow cookies", "1"],
] as const) {
  test(`${label} closes the banner and keeps the choice after reload`, async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByRole("complementary", {
      name: "Analytics choice",
    });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: label, exact: true }).click();
    await expect(banner).toHaveCount(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
    ).toBe(value);
    await page.reload();
    await expect(banner).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue(
              "--analytics-banner-height",
            ),
          ),
      )
      .toBe("");
  });
}

test("catalog retry stays usable with the banner and a selected map card", async ({
  page,
}, info) => {
  let unavailable = true;
  await page.route("**/api/discovery", async (route) => {
    if (unavailable) {
      await route.fulfill({ status: 503, body: "Unavailable" });
    } else {
      await route.continue();
    }
  });
  await page.goto("/?from=2027-01-01&to=2027-12-31");
  const banner = page.getByRole("complementary", { name: "Analytics choice" });
  await expect(banner).toBeVisible();
  const retry = page.getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeVisible();
  await page
    .getByRole("button", {
      name: "Show details for Fictional Atlantic Sounds 2027",
    })
    .click();
  const card = page.getByRole("region", { name: "Selected edition details" });
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds",
  );
  if (info.project.name === "mobile") {
    await page
      .getByRole("group", { name: "Discovery view" })
      .getByRole("button", { name: "Map", exact: true })
      .click();
  }
  unavailable = false;
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(card.getByRole("heading")).toHaveText(
    "Fictional Atlantic Sounds",
  );
  await banner.getByRole("button", { name: "Disable analytics" }).click();
  await expect(banner).toHaveCount(0);
  await expect(
    card.getByRole("link", { name: "View", exact: true }),
  ).toBeInViewport();
});
