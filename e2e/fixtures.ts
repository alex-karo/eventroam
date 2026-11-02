import { test as base } from "@playwright/test";
import { preferenceKey } from "../src/site/analytics";

export { expect, type Page, type Route, type TestInfo } from "@playwright/test";

export const test = base.extend<{ showAnalyticsBanner: boolean }>({
  showAnalyticsBanner: [false, { option: true }],
  page: async ({ page, showAnalyticsBanner }, run) => {
    if (!showAnalyticsBanner) {
      await page.addInitScript((key) => {
        localStorage.setItem(key, "disabled");
      }, preferenceKey);
    }
    await run(page);
  },
});
