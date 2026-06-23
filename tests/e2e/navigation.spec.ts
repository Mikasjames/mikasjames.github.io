import { test, expect } from '@playwright/test';

test('header displays site logo', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: '>_ mikas' })).toBeVisible();
});

test('header navigation links are present on desktop', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'About' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Experience' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Skills' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Blog' }).first()).toBeVisible();
});

test('header has Get in touch button', async ({ page }) => {
	await page.goto('/');
	const emailLink = page.locator('a[href="mailto:mikasjames@gmail.com"]').first();
	await expect(emailLink).toBeVisible();
});

test('navigates from homepage to blog via header link', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Blog' }).first().click();
	await expect(page).toHaveURL(/\/blogs\//);
});

test('404 page returns 404 status', async ({ page }) => {
	const response = await page.goto('/nonexistent-page/');
	expect(response?.status()).toBe(404);
});

test('page has correct viewport meta tag', async ({ page }) => {
	await page.goto('/');
	const viewport = page.locator('meta[name="viewport"]');
	await expect(viewport).toHaveAttribute('content', 'width=device-width, initial-scale=1');
});

test('page has theme-color meta tag', async ({ page }) => {
	await page.goto('/');
	const themeColor = page.locator('meta[name="theme-color"]');
	await expect(themeColor).toHaveAttribute('content', '#09090b');
});
