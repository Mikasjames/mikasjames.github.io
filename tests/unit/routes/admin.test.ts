import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import AdminPage from "../../../src/routes/admin/+page.svelte";
import { subscribeToAuth } from "$lib/firebase/auth";
import { getPostsPage, getJournalEntriesPage } from "$lib/firebase/firestore.svelte";
import { goto } from "$app/navigation";
import { MOCK_USER } from "../../fixtures/user";

interface PageStoreValue {
	url: { searchParams: URLSearchParams };
	params: Record<string, string>;
}

const { mockPageStore } = vi.hoisted(() => {
	let value: PageStoreValue = { url: { searchParams: new URLSearchParams() }, params: {} };
	const subscribers: Set<(value: PageStoreValue) => void> = new Set();
	return {
		mockPageStore: {
			subscribe: (callback: (value: PageStoreValue) => void) => {
				subscribers.add(callback);
				callback(value);
				return () => subscribers.delete(callback);
			},
			set: (newValue: PageStoreValue) => {
				value = newValue;
				subscribers.forEach((cb) => cb(value));
			},
		},
	};
});

vi.mock("$lib/firebase/auth", () => ({
	subscribeToAuth: vi.fn(),
	logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("$lib/firebase/firestore.svelte", () => ({
	getPostsPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
	deletePost: vi.fn(),
	DEFAULT_PAGE_SIZE: 10,
	getJournalEntriesPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
	deleteJournalEntry: vi.fn(),
}));

vi.mock("$app/stores", () => ({
	page: mockPageStore,
}));

vi.mock("$app/navigation", () => ({
	goto: vi.fn(),
}));

vi.mock("$lib/stores/toast.svelte", () => ({
	toast: vi.fn(),
}));

vi.mock("$lib/firebase/insights.svelte", () => ({
	createInsightsStore: () => ({
		loadLatest: vi.fn(),
	}),
}));

vi.mock("$lib/firebase/media.svelte", () => ({
	createMediaStore: () => ({
		loadRecentMedia: vi.fn(),
		recentMediaItems: [],
		mediaItems: [],
		mediaUploading: false,
		mediaUploadError: "",
		mediaLoadError: "",
		openMediaGallery: vi.fn(),
		handleGalleryUpload: vi.fn(),
		handleDeleteMedia: vi.fn(),
	}),
}));

vi.mock("$lib/firebase/habits.svelte", () => ({
	createHabitsStore: () => ({
		loadHabits: vi.fn(),
		habits: [],
	}),
}));

vi.mock("$lib/firebase/olj.svelte", () => ({
	createOljStore: () => ({
		loadLog: vi.fn(),
	}),
}));

describe("Admin Dashboard", () => {
	const mockSubscribeToAuth = vi.mocked(subscribeToAuth);
	const mockGoto = vi.mocked(goto);

	beforeEach(() => {
		vi.clearAllMocks();
		window.localStorage.removeItem("mj_admin_session");
		mockPageStore.set({ url: { searchParams: new URLSearchParams() }, params: {} });
	});

	it("redirects to /admin/login/ when unauthenticated", async () => {
		mockSubscribeToAuth.mockImplementation((cb) => {
			cb(null);
			return () => {};
		});

		render(AdminPage);

		expect(mockGoto).toHaveBeenCalledWith("/admin/login/");
	});

	it("renders dashboard when authenticated", async () => {
		mockSubscribeToAuth.mockImplementation((cb) => {
			cb(MOCK_USER);
			return () => {};
		});

		render(AdminPage);

		expect(screen.getByText("Dashboard")).toBeInTheDocument();
	});

	it("defaults to journal section", async () => {
		mockSubscribeToAuth.mockImplementation((cb) => {
			cb(MOCK_USER);
			return () => {};
		});

		render(AdminPage);

		await waitFor(() => {
			expect(screen.getByText(/Write your first entry/i)).toBeInTheDocument();
		});
	});
});
