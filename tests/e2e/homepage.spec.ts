import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
});

test('loads the homepage', async ({ page }) => {
	await expect(page).toHaveTitle(/Mikas James/);
});

test('displays hero section with key elements', async ({ page }) => {
	await expect(page.getByText('Hi, I\'m')).toBeVisible();
	await expect(page.getByRole('heading', { name: /Mikas James/ })).toBeVisible();
	await expect(page.getByText('Full-Stack Software Engineer')).toBeVisible();
});

test('hero CTA buttons are visible and link correctly', async ({ page }) => {
	const githubBtn = page.locator('#hero-github-link');
	await expect(githubBtn).toBeVisible();
	await expect(githubBtn).toHaveAttribute('href', 'https://github.com/Mikasjames');

	const emailBtn = page.locator('#hero-email-link');
	await expect(emailBtn).toBeVisible();
	await expect(emailBtn).toHaveAttribute('href', 'mailto:mikasjames@gmail.com');
});

test('experience section is present', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();
	await expect(page.getByText('Codefrost').first()).toBeVisible();
});

test('skills section is present', async ({ page }) => {
	await expect(page.getByText('Tech Stack')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Frontend' })).toBeVisible();
});

test('projects section is present', async ({ page }) => {
	await expect(page.getByText('Personal Projects')).toBeVisible();
});

test('contact section is present with buttons', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Get In Touch' })).toBeVisible();

	const emailBtn = page.locator('#contact-email-btn');
	await expect(emailBtn).toBeVisible();
	await expect(emailBtn).toHaveAttribute('href', 'mailto:mikasjames@gmail.com');

	const githubBtn = page.locator('#contact-github-btn');
	await expect(githubBtn).toBeVisible();
	await expect(githubBtn).toHaveAttribute('href', 'https://github.com/Mikasjames');
});

test('footer displays copyright', async ({ page }) => {
	await page.locator('.blink-cursor').waitFor({ state: 'detached', timeout: 10000 });
	const footer = page.locator('footer');
	await expect(footer.getByText(/All rights\s+reserved/)).toBeVisible();
});

test('switches skill tabs', async ({ page }) => {
	await page.getByRole('button', { name: 'Backend' }).click();
	await expect(page.getByText('Python')).toBeVisible();
	await expect(page.getByText('Django', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'QA' }).click();
	await expect(page.getByText('Playwright')).toBeVisible();
});

test('navigates project carousel', async ({ page }) => {
	const projectCards = page.locator('[role="region"] [role="button"]');
	await expect(projectCards.first()).toBeVisible();
});
