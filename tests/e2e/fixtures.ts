import { test as base, type Page } from "@playwright/test";

export const test = base.extend<{
	authenticatedPage: Page;
	unauthenticatedPage: Page;
}>({
	authenticatedPage: async ({ page }, use) => {
		await page.addInitScript(() => {
			window.localStorage.setItem("mj_admin_session", "1");
		});
		await use(page);
	},

	unauthenticatedPage: async ({ page }, use) => {
		await page.addInitScript(() => {
			window.localStorage.removeItem("mj_admin_session");
		});
		await page.context().clearCookies();
		await use(page);
	},
});

export { expect } from "@playwright/test";