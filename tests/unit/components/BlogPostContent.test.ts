import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import BlogPostContent from "$lib/components/BlogPostContent.svelte";
import { onAdminSession } from "$lib/utils/admin-session";
import { MOCK_USER } from "../../fixtures/user";

vi.mock("$lib/utils/admin-session", () => ({
	onAdminSession: vi.fn(),
}));

vi.mock("$lib/utils/renderMarkdown", () => ({
	renderMarkdown: vi.fn((content: string) => `<p>${content}</p>`),
}));

vi.mock("$lib/utils/date", () => ({
	formatDateLong: vi.fn(() => "Jan 15, 2024"),
	readingTime: vi.fn(() => "5 min read"),
}));

const mockPost = {
	id: "post-1",
	title: "Test Post",
	slug: "test-post",
	excerpt: "This is a test excerpt.",
	content: "# Hello World\n\nThis is test content.",
	coverImage: "https://example.com/cover.jpg",
	imageMeta: {},
	createdAt: new Date("2024-01-15"),
	status: "published" as const,
};

const mockOnAdminSession = vi.mocked(onAdminSession);

describe("BlogPostContent", () => {
	beforeEach(() => {
		window.localStorage.removeItem("mj_admin_session");
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders post metadata (date, reading time)", () => {
		mockOnAdminSession.mockImplementation(() => () => {});

		render(BlogPostContent, { props: { post: mockPost } });

		expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
		expect(screen.getByText("5 min read")).toBeInTheDocument();
	});

	it("shows Edit button when admin + postId", async () => {
		let callback: (user: typeof MOCK_USER) => void | undefined;
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			callback = cb;
			return () => {};
		});

		render(BlogPostContent, { props: { post: mockPost, postId: "post-1" } });

		await waitFor(() => {
			expect(callback).toBeDefined();
		});

		callback!(MOCK_USER);
		await tick();

		const editLink = screen.getByRole("link", { name: /Edit/i });
		expect(editLink).toBeInTheDocument();
		expect(editLink).toHaveAttribute("href", "/admin/?edit=post-1");
	});

	it("hides Edit button when unauthenticated", () => {
		mockOnAdminSession.mockImplementation(() => () => {});

		render(BlogPostContent, { props: { post: mockPost } });

		expect(screen.queryByRole("link", { name: /Edit/i })).not.toBeInTheDocument();
	});

	it("hides Edit button when no postId", () => {
		render(BlogPostContent, { props: { post: mockPost } });

		expect(screen.queryByRole("link", { name: /Edit/i })).not.toBeInTheDocument();
	});

	it("Edit link has correct /admin/?edit=ID", async () => {
		let callback: (user: typeof MOCK_USER) => void | undefined;
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			callback = cb;
			return () => {};
		});

		render(BlogPostContent, { props: { post: { ...mockPost, id: "post-123" }, postId: "post-123" } });

		await waitFor(() => {
			expect(callback).toBeDefined();
		});

		callback!(MOCK_USER);
		await tick();

		const editLink = screen.getByRole("link", { name: /Edit/i });
		expect(editLink).toHaveAttribute("href", "/admin/?edit=post-123");
	});

	it("back link uses backHref", () => {
		mockOnAdminSession.mockImplementation(() => () => {});

		render(BlogPostContent, { props: { post: mockPost, backHref: "/custom/" } });

		const backLinks = screen.getAllByRole("link", { name: /All posts/i });
		const customBackLink = backLinks.find((link) => link.getAttribute("href") === "/custom/");
		expect(customBackLink).toBeInTheDocument();
	});

	it("back link uses backLabel when provided", () => {
		mockOnAdminSession.mockImplementation(() => () => {});

		render(BlogPostContent, { props: { post: mockPost, backHref: "/custom/", backLabel: "Custom Label" } });

		const backLinks = screen.getAllByRole("link", { name: /Custom Label/i });
		expect(backLinks.length).toBeGreaterThanOrEqual(1);
	});

	it("falls back to 'All posts' / 'Back'", () => {
		mockOnAdminSession.mockImplementation(() => () => {});

		const { unmount } = render(BlogPostContent, { props: { post: mockPost, backHref: "/blogs/" } });
		const backLinks = screen.getAllByRole("link", { name: /All posts/i });
		expect(backLinks.length).toBeGreaterThanOrEqual(1);
		unmount();

		const { unmount: unmount2 } = render(BlogPostContent, { props: { post: mockPost, backHref: "/admin/" } });
		const backLink = screen.getAllByRole("link", { name: /Back/i });
		expect(backLink.length).toBeGreaterThanOrEqual(1);
		unmount2();
	});

	it("renders cover image if present", () => {
		mockOnAdminSession.mockImplementation(() => () => {});

		render(BlogPostContent, { props: { post: mockPost } });

		const img = screen.getByAltText("Test Post");
		expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
	});

	it("renders markdown content", () => {
		mockOnAdminSession.mockImplementation(() => () => {});

		render(BlogPostContent, { props: { post: mockPost } });

		expect(screen.getByText(/Hello World/)).toBeInTheDocument();
		expect(screen.getByText(/This is test content/)).toBeInTheDocument();
	});
});
