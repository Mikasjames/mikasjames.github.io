import { test, expect } from "./fixtures";

test.describe("Admin Auth Flow", () => {
	test("unauthenticated user visiting /admin gets redirected to login", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/");

		await page.waitForURL("**/admin/login/**");
		expect(page.url()).toContain("/admin/login");
	});

	test("login page renders with email and password fields", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await expect(page.locator("#email")).toBeVisible();
		await expect(page.locator("#password")).toBeVisible();
		await expect(page.locator("#login-submit-btn")).toBeVisible();
	});

	test("login page displays correct title and heading", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await expect(page).toHaveTitle(/Admin Login/);
		await expect(page.getByRole("heading", { name: "Admin Access" })).toBeVisible();
		await expect(page.getByText("Sign in to manage your content")).toBeVisible();
	});

	test("login form requires email and password", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		const emailInput = page.locator("#email");
		const passwordInput = page.locator("#password");
		await expect(emailInput).toHaveAttribute("required", "");
		await expect(passwordInput).toHaveAttribute("required", "");
	});

	test("login page has noindex meta tag", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		const robots = page.locator('meta[name="robots"]');
		await expect(robots).toHaveAttribute("content", "noindex, nofollow");
	});

	test("login button is disabled while loading", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await page.fill("#email", "test@example.com");
		await page.fill("#password", "password123");
		await page.click("#login-submit-btn");

		const submitBtn = page.locator("#login-submit-btn");
		await expect(submitBtn).toBeDisabled();
	});

	test("login form has proper labels", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		await expect(page.locator('label[for="email"]')).toHaveText("Email");
		await expect(page.locator('label[for="password"]')).toHaveText("Password");
	});
});
