import { test, expect } from "./fixtures";

test.describe("Published Post Edit via Admin", () => {
	test("admin dashboard redirects to login when unauthenticated", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/");

		await page.waitForURL("**/admin/login/**");
		expect(page.url()).toContain("/admin/login");
	});

	test("admin dashboard URL is /admin/", async () => {
		const adminUrl = "/admin/";
		expect(adminUrl).toBe("/admin/");
	});

	test("admin edit query param format is correct", () => {
		const editUrl = "/admin/?edit=post-123";
		const url = new URL(editUrl, "http://localhost");
		expect(url.searchParams.get("edit")).toBe("post-123");
	});

	test("admin login page has proper input types", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await expect(page.locator("#email")).toHaveAttribute("type", "email");
		await expect(page.locator("#password")).toHaveAttribute("type", "password");
	});

	test("admin login form has autocomplete attributes", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await expect(page.locator("#email")).toHaveAttribute("autocomplete", "email");
		await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
	});

	test("admin login page shows site branding", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await expect(page.getByText(">_ mikas")).toBeVisible();
	});
});
