import { test, expect } from '@playwright/test';

test('blog listing page loads', async ({ page }) => {
	await page.goto('/blogs/');
	await expect(page).toHaveTitle(/Blog/);
	await expect(page.getByText('Some stuff that came to mind.')).toBeVisible();
});

function firstPostLink(page: import('@playwright/test').Page) {
	return page.locator('a[href^="/blogs/"]:not([href="/blogs/"])').first();
}

test('blog listing shows posts or empty state', async ({ page }) => {
	await page.goto('/blogs/');
	await page.waitForLoadState('networkidle');

	const post = firstPostLink(page);
	const href = await post.getAttribute('href');

	if (href) {
		await expect(post).toBeVisible();
	} else {
		await expect(page.getByText('No posts yet')).toBeVisible();
	}
});

test('clicking a blog post navigates to detail page', async ({ page }) => {
	await page.goto('/blogs/');
	await page.waitForLoadState('networkidle');

	const post = firstPostLink(page);
	const href = await post.getAttribute('href');

	if (!href) {
		test.skip();
		return;
	}

	await post.click();
	await page.waitForLoadState('networkidle');
	await expect(page).not.toHaveTitle(/Blog · Mikas/);
});

test('blog post detail page has expected structure', async ({ page }) => {
	await page.goto('/blogs/');
	await page.waitForLoadState('networkidle');

	const post = firstPostLink(page);
	const href = await post.getAttribute('href');

	if (!href) {
		test.skip();
		return;
	}

	await post.click();
	await page.waitForLoadState('networkidle');
	await expect(page.locator('article')).toBeVisible();
});

test('sitemap.xml is accessible', async ({ page }) => {
	const response = await page.goto('/sitemap.xml');
	expect(response?.status()).toBe(200);
	expect(await response?.headerValue('content-type')).toContain('xml');
});

test('robots.txt is accessible', async ({ page }) => {
	const response = await page.goto('/robots.txt');
	expect(response?.status()).toBe(200);
});
