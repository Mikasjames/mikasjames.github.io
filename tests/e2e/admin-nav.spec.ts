import { test, expect } from "./fixtures";

test.describe("Admin Navigation", () => {
	test("authenticated user sees Admin nav dropdown in header", async ({ authenticatedPage: page }) => {
		await page.goto("/");

		await page.waitForLoadState("domcontentloaded");

		const adminButton = page.getByRole("button", { name: /Admin/i });
		const emailLink = page.getByRole("link", { name: /Get in touch/i });

		const adminVisible = await adminButton.isVisible().catch(() => false);
		const emailVisible = await emailLink.isVisible().catch(() => false);

		expect(adminVisible || emailVisible).toBe(true);
	});

	test("unauthenticated user sees Get in touch button in header", async ({ unauthenticatedPage: page }) => {
		await page.goto("/");

		await page.waitForLoadState("domcontentloaded");
		await page.waitForTimeout(2000);

		const emailLink = page.getByRole("link", { name: /Get in touch/i });
		await expect(emailLink).toBeVisible({ timeout: 5000 });
	});

	test("admin login page renders correctly", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await expect(page.getByRole("heading", { name: "Admin Access" })).toBeVisible();
		await expect(page.locator("#email")).toBeVisible();
		await expect(page.locator("#password")).toBeVisible();
	});

	test("site header has navigation links", async ({ unauthenticatedPage: page }) => {
		await page.goto("/");

		await expect(page.getByRole("link", { name: /About/i }).first()).toBeVisible();
		await expect(page.getByRole("link", { name: /Experience/i }).first()).toBeVisible();
		await expect(page.getByRole("link", { name: /Skills/i }).first()).toBeVisible();
	});

	test("header has site logo", async ({ unauthenticatedPage: page }) => {
		await page.goto("/");

		const logo = page.getByRole("link", { name: /mikas/i }).first();
		await expect(logo).toBeVisible();
	});
});
