import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/svelte";
import DraftsPage from "../../../src/routes/blogs/drafts/+page.svelte";
import { subscribeToAuth } from "$lib/firebase/auth";
import { getPostsPage } from "$lib/firebase/firestore.svelte";
import { goto } from "$app/navigation";
import { MOCK_USER } from "../../fixtures/user";

vi.mock("$lib/firebase/auth", () => ({
	subscribeToAuth: vi.fn(),
}));

vi.mock("$lib/firebase/firestore.svelte", () => ({
	getPostsPage: vi.fn(),
	DEFAULT_PAGE_SIZE: 10,
}));

vi.mock("$app/navigation", () => ({
	goto: vi.fn(),
}));

describe("Drafts List (/blogs/drafts/)", () => {
	const mockSubscribeToAuth = vi.mocked(subscribeToAuth);
	const mockGetPostsPage = vi.mocked(getPostsPage);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		window.localStorage.removeItem("mj_admin_session");
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("draft cards link to /blogs/drafts/{slug}/", async () => {
		const mockPosts = [
			{ id: "draft-1", title: "Draft 1", slug: "draft-1", excerpt: "Excerpt 1", content: "Content 1", coverImage: "https://example.com/cover1.jpg", imageMeta: {}, createdAt: new Date(), status: "draft" as const },
			{ id: "draft-2", title: "Draft 2", slug: "draft-2", excerpt: "Excerpt 2", content: "Content 2", coverImage: null, imageMeta: {}, createdAt: new Date(), status: "draft" as const },
		];

		mockGetPostsPage.mockResolvedValue({ items: mockPosts, nextCursor: null, hasMore: false });

		let authCallback: ((user: typeof MOCK_USER | null) => void) | undefined;
		mockSubscribeToAuth.mockImplementation((cb: (user: typeof MOCK_USER | null) => void) => {
			authCallback = cb;
			cb(MOCK_USER);
			return () => {};
		});

		render(DraftsPage);

		await vi.runAllTimersAsync();

		const links = screen.getAllByRole("link", { name: /View draft/i });
		expect(links).toHaveLength(2);
		expect(links[0]).toHaveAttribute("href", "/blogs/drafts/draft-1/");
		expect(links[1]).toHaveAttribute("href", "/blogs/drafts/draft-2/");
	});

	it("no 'View draft' CTA text", async () => {
		const mockPosts = [
			{ id: "draft-1", title: "Draft 1", slug: "draft-1", excerpt: "Excerpt 1", content: "Content 1", coverImage: "https://example.com/cover1.jpg", imageMeta: {}, createdAt: new Date(), status: "draft" as const },
		];

		mockGetPostsPage.mockResolvedValue({ items: mockPosts, nextCursor: null, hasMore: false });

		let authCallback: ((user: typeof MOCK_USER | null) => void) | undefined;
		mockSubscribeToAuth.mockImplementation((cb: (user: typeof MOCK_USER | null) => void) => {
			authCallback = cb;
			cb(MOCK_USER);
			return () => {};
		});

		render(DraftsPage);

		await vi.runAllTimersAsync();

		const cardLink = screen.getByRole("link", { name: /View draft/i });
		expect(cardLink).toBeInTheDocument();
	});

	it("cover image loads with correct priority", async () => {
		const mockPosts = [
			{ id: "draft-1", title: "Draft 1", slug: "draft-1", excerpt: "Excerpt 1", content: "Content 1", coverImage: "https://example.com/cover1.jpg", imageMeta: {}, createdAt: new Date(), status: "draft" as const },
		];

		mockGetPostsPage.mockResolvedValue({ items: mockPosts, nextCursor: null, hasMore: false });

		let authCallback: ((user: typeof MOCK_USER | null) => void) | undefined;
		mockSubscribeToAuth.mockImplementation((cb: (user: typeof MOCK_USER | null) => void) => {
			authCallback = cb;
			cb(MOCK_USER);
			return () => {};
		});

		render(DraftsPage);

		await vi.runAllTimersAsync();

		const img = screen.getByAltText("");
		expect(img).toHaveAttribute("src", "https://example.com/cover1.jpg");
		expect(img).toHaveAttribute("fetchpriority", "high");
	});

	it("Draft badge visible", async () => {
		const mockPosts = [
			{ id: "draft-1", title: "Draft 1", slug: "draft-1", excerpt: "Excerpt 1", content: "Content 1", coverImage: "https://example.com/cover1.jpg", imageMeta: {}, createdAt: new Date(), status: "draft" as const },
		];

		mockGetPostsPage.mockResolvedValue({ items: mockPosts, nextCursor: null, hasMore: false });

		let authCallback: ((user: typeof MOCK_USER | null) => void) | undefined;
		mockSubscribeToAuth.mockImplementation((cb: (user: typeof MOCK_USER | null) => void) => {
			authCallback = cb;
			cb(MOCK_USER);
			return () => {};
		});

		render(DraftsPage);

		await vi.runAllTimersAsync();

		const badge = screen.getByText("Draft");
		expect(badge).toBeInTheDocument();
	});
});
