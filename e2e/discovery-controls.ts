import type { Page } from "@playwright/test";

export async function openFilter(
  page: Page,
  group: "Where" | "Music" | "More",
) {
  const panel = page.getByRole("dialog", { name: "Filters", exact: true });
  if (!(await panel.isVisible())) {
    const mobile = page.locator(".filter-mobile-trigger");
    if (await mobile.isVisible()) {
      await mobile.click();
    } else {
      const key = { Where: "where", Music: "genre", More: "more" }[group];
      await page.locator(`.filter-trigger-${key}`).click();
      return;
    }
  }
  await panel
    .getByRole("group", { name: "Filter groups" })
    .getByRole("button", { name: group, exact: true })
    .click();
}

export function filterOpener(page: Page, group: "Where" | "Music" | "More") {
  const key = { Where: "where", Music: "genre", More: "more" }[group];
  return page.locator(
    `.filter-mobile-trigger:visible, .filter-trigger-${key}:visible`,
  );
}

export async function clearFilters(page: Page) {
  if (await page.locator(".filter-mobile-trigger").isVisible()) {
    await openFilter(page, "More");
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await page.getByRole("button", { name: /^Show \d+ events?$/ }).click();
  } else {
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
  }
}
