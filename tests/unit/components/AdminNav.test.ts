import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import AdminNav from "$lib/components/AdminNav.svelte";
import { onAdminSession } from "$lib/utils/admin-session";
import { MOCK_USER } from "../../fixtures/user";

vi.mock("$lib/utils/admin-session", () => ({
	onAdminSession: vi.fn(),
}));

vi.mock("$lib/firebase/auth", () => ({
	logout: vi.fn().mockResolvedValue(undefined),
	subscribeToAuth: vi.fn(),
}));

describe("AdminNav", () => {
	const mockOnAdminSession = vi.mocked(onAdminSession);

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		window.localStorage.removeItem("mj_admin_session");
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("renders 'Get in touch' when unauthenticated (desktop)", () => {
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			cb(null as unknown as typeof MOCK_USER);
			return () => {};
		});

		render(AdminNav, { props: { mobileMode: false } });

		const contactLink = screen.getByRole("link", { name: /Get in touch/i });
		expect(contactLink).toBeInTheDocument();
		expect(contactLink).toHaveAttribute("href", "mailto:mikasjames@gmail.com");
	});

	it("renders Admin dropdown when authenticated (desktop)", async () => {
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			cb(MOCK_USER);
			return () => {};
		});

		render(AdminNav, { props: { mobileMode: false } });

		await vi.runAllTimersAsync();

		const adminButton = screen.getByRole("button", { name: /Admin/i });
		expect(adminButton).toBeInTheDocument();
	});

	it("dropdown opens on click", async () => {
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			cb(MOCK_USER);
			return () => {};
		});

		render(AdminNav, { props: { mobileMode: false } });

		await vi.runAllTimersAsync();

		const adminButton = screen.getByRole("button", { name: /Admin/i });
		fireEvent.click(adminButton);

		expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Drafts/i })).toBeInTheDocument();
	});

	it("mobile drawer shows Admin Controls when authenticated", async () => {
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			cb(MOCK_USER);
			return () => {};
		});

		render(AdminNav, { props: { mobileMode: true } });

		await vi.runAllTimersAsync();

		const adminControls = screen.getByText(/Admin Controls/i);
		expect(adminControls).toBeInTheDocument();

		const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
		expect(dashboardLink).toBeInTheDocument();
	});

	it("links navigate correctly", async () => {
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			cb(MOCK_USER);
			return () => {};
		});

		render(AdminNav, { props: { mobileMode: false } });

		await vi.runAllTimersAsync();

		const adminButton = screen.getByRole("button", { name: /Admin/i });
		fireEvent.click(adminButton);

		const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
		expect(dashboardLink).toHaveAttribute("href", "/admin/");

		const draftsLink = screen.getByRole("link", { name: /Drafts/i });
		expect(draftsLink).toHaveAttribute("href", "/blogs/drafts/");

		const blogLink = screen.getByRole("link", { name: /Blog/i });
		expect(blogLink).toHaveAttribute("href", "/blogs/");

		const journalLink = screen.getByRole("link", { name: /Journal/i });
		expect(journalLink).toHaveAttribute("href", "/journal/");

		const habitsLink = screen.getByRole("link", { name: /Habits/i });
		expect(habitsLink).toHaveAttribute("href", "/habits/");
	});

	it("does not render admin UI without session (SSR safety)", () => {
		mockOnAdminSession.mockImplementation(() => undefined);

		render(AdminNav, { props: { mobileMode: false } });

		expect(screen.getByRole("link", { name: /Get in touch/i })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Admin/i })).not.toBeInTheDocument();
	});

	it("shows Dashboard, Drafts, Blog, Journal, Habits", async () => {
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			cb(MOCK_USER);
			return () => {};
		});

		render(AdminNav, { props: { mobileMode: false } });

		await vi.runAllTimersAsync();

		const adminButton = screen.getByRole("button", { name: /Admin/i });
		fireEvent.click(adminButton);

		const items = ["Dashboard", "Drafts", "Blog", "Journal", "Habits"];
		items.forEach((item) => {
			expect(screen.getByRole("link", { name: new RegExp(item, "i") })).toBeInTheDocument();
		});
	});

	it("loading state handled", () => {
		mockOnAdminSession.mockImplementation(() => undefined);

		render(AdminNav, { props: { mobileMode: false } });

		expect(screen.getByRole("link", { name: /Get in touch/i })).toBeInTheDocument();
	});

	it("cleanup on unmount", async () => {
		const cleanup = vi.fn();
		mockOnAdminSession.mockImplementation((cb: (user: typeof MOCK_USER) => void) => {
			cb(MOCK_USER);
			return cleanup;
		});

		const { unmount } = render(AdminNav, { props: { mobileMode: false } });

		await vi.runAllTimersAsync();

		unmount();

		expect(cleanup).toHaveBeenCalled();
	});
});
