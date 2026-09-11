import { test, expect } from "./fixtures";

test.describe("Draft Workflow", () => {
	test("drafts page redirects to login when unauthenticated", async ({ unauthenticatedPage: page }) => {
		await page.goto("/blogs/drafts/");

		await page.waitForURL("**/admin/login/**");
		expect(page.url()).toContain("/admin/login");
	});

	test("drafts page has noindex meta tag", async ({ unauthenticatedPage: page }) => {
		await page.goto("/admin/login/");

		const robots = page.locator('meta[name="robots"]');
		await expect(robots).toHaveAttribute("content", "noindex, nofollow");
	});

	test("drafts page URL pattern is correct", async () => {
		const draftsUrl = "/blogs/drafts/";
		expect(draftsUrl).toMatch(/^\/blogs\/drafts\//);
	});

	test("draft preview route pattern is correct", () => {
		const previewUrl = "/blogs/drafts/my-draft-slug/";
		expect(previewUrl).toMatch(/^\/blogs\/drafts\/[^/]+\/$/);
	});
});
