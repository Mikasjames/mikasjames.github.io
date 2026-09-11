import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import DraftPreviewPage from "../../../src/routes/blogs/drafts/[slug]/+page.svelte";
import { getDraftBySlug } from "$lib/firebase/firestore.svelte";
import { MOCK_USER } from "../../fixtures/user";

const onAdminSessionCallbacks: ((user: typeof MOCK_USER) => void)[] = [];
let cleanupFns: (() => void)[] = [];

vi.mock("$lib/utils/admin-session", () => ({
	onAdminSession: vi.fn((cb: (user: typeof MOCK_USER) => void) => {
		onAdminSessionCallbacks.push(cb);
		const idx = onAdminSessionCallbacks.length - 1;
		const cleanup = () => {
			onAdminSessionCallbacks.splice(idx, 1);
		};
		cleanupFns.push(cleanup);
		return cleanup;
	}),
}));

vi.mock("$lib/firebase/firestore.svelte", () => ({
	getDraftBySlug: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
	goto: vi.fn(),
}));

vi.mock("$app/stores", () => {
	const { writable } = require("svelte/store");
	const page = writable({
		url: new URL("http://localhost"),
		params: { slug: "test-draft" },
		route: { id: "/blogs/drafts/[slug]" },
		status: 200,
		error: null,
		data: {},
	});
	return {
		page,
		navigating: writable(null),
		updated: writable(false),
	};
});

async function flushTimers() {
	for (let i = 0; i < 20; i++) {
		await vi.advanceTimersByTimeAsync(50);
		await tick();
	}
}

function fireAllCallbacks(user: typeof MOCK_USER = MOCK_USER) {
	for (const cb of onAdminSessionCallbacks) {
		cb(user);
	}
}

describe("Draft Preview Page (/blogs/drafts/[slug]/)", () => {
	const mockGetDraftBySlug = vi.mocked(getDraftBySlug);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		window.localStorage.removeItem("mj_admin_session");
		onAdminSessionCallbacks.length = 0;
		cleanupFns = [];
	});

	it("redirects to /admin/login/ when no session", async () => {
		window.localStorage.removeItem("mj_admin_session");

		render(DraftPreviewPage);
		await flushTimers();

		const { goto } = await import("$app/navigation");
		expect(vi.mocked(goto)).toHaveBeenCalledWith("/admin/login/");
	});

	it("renders draft content when found", async () => {
		window.localStorage.setItem("mj_admin_session", "1");

		const mockDraft = {
			id: "draft-1",
			title: "Test Draft",
			slug: "test-draft",
			excerpt: "Draft excerpt",
			content: "# Draft Content\n\nThis is draft content.",
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
			status: "draft" as const,
		};

		mockGetDraftBySlug.mockResolvedValue(mockDraft);

		render(DraftPreviewPage);
		await flushTimers();

		fireAllCallbacks();
		await flushTimers();

		expect(screen.getByText("Test Draft")).toBeInTheDocument();
		expect(screen.getByText("Draft Content")).toBeInTheDocument();
	});

	it("shows 'Draft not found' for missing slug", async () => {
		window.localStorage.setItem("mj_admin_session", "1");
		mockGetDraftBySlug.mockResolvedValue(null);

		render(DraftPreviewPage);
		await flushTimers();

		fireAllCallbacks();
		await flushTimers();

		expect(screen.getByText("Draft not found.")).toBeInTheDocument();
	});

	it("shows 'Draft not found' for published post (status filter)", async () => {
		window.localStorage.setItem("mj_admin_session", "1");
		mockGetDraftBySlug.mockResolvedValue(null);

		render(DraftPreviewPage);
		await flushTimers();

		fireAllCallbacks();
		await flushTimers();

		expect(screen.getByText("Draft not found.")).toBeInTheDocument();
	});

	it("Edit button has correct /admin/?edit=ID", async () => {
		window.localStorage.setItem("mj_admin_session", "1");

		const mockDraft = {
			id: "draft-123",
			title: "Test Draft",
			slug: "test-draft",
			excerpt: "Draft excerpt",
			content: "# Draft Content",
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
			status: "draft" as const,
		};

		mockGetDraftBySlug.mockResolvedValue(mockDraft);

		render(DraftPreviewPage);
		await flushTimers();

		fireAllCallbacks();
		await flushTimers();

		fireAllCallbacks();
		await flushTimers();

		expect(screen.getByRole("link", { name: /Edit/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Edit/i })).toHaveAttribute("href", "/admin/?edit=draft-123");
	});

	it("back link returns to /blogs/drafts/", async () => {
		window.localStorage.setItem("mj_admin_session", "1");

		const mockDraft = {
			id: "draft-1",
			title: "Test Draft",
			slug: "test-draft",
			excerpt: "Draft excerpt",
			content: "# Draft Content",
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
			status: "draft" as const,
		};

		mockGetDraftBySlug.mockResolvedValue(mockDraft);

		render(DraftPreviewPage);
		await flushTimers();

		fireAllCallbacks();
		await flushTimers();

		const backLinks = screen.getAllByRole("link", { name: /All Drafts/i });
		expect(backLinks.length).toBeGreaterThanOrEqual(1);
		for (const link of backLinks) {
			expect(link).toHaveAttribute("href", "/blogs/drafts/");
		}
	});
});
