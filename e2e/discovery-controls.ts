import { expect, type Page } from "@playwright/test";

export async function openFilter(
  page: Page,
  group: "Where" | "Music" | "More",
) {
  const panel = page.getByRole("dialog", { name: "Filters", exact: true });
  if (!(await panel.isVisible())) {
    const key = { Where: "where", Music: "genre", More: "more" }[group];
    await page.locator(`.filter-trigger-${key}`).click();
    return;
  }
  await panel
    .getByRole("group", { name: "Filter groups" })
    .getByRole("button", { name: group, exact: true })
    .click();
}

export function filterOpener(page: Page, group: "Where" | "Music" | "More") {
  const key = { Where: "where", Music: "genre", More: "more" }[group];
  return page.locator(`.filter-trigger-${key}:visible`);
}

export async function clearFilters(page: Page) {
  await page.locator(".clear-filters").click();
}

export async function openEdition(page: Page, name: string) {
  let link = page.getByRole("link", {
    name: `Open page for ${name}`,
    exact: true,
    includeHidden: true,
  });
  if (!(await link.isVisible())) {
    const href = await link.getAttribute("href");
    link = page.locator(".detail-panel .view-edition");
    await expect(link).toHaveAttribute("href", href!);
  }
  const popup = page.waitForEvent("popup");
  await link.click();
  return popup;
}
