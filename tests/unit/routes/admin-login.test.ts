import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import LoginPage from "../../../src/routes/admin/login/+page.svelte";
import { goto } from "$app/navigation";

const { mockLogin, mockGetCurrentUser } = vi.hoisted(() => ({
	mockLogin: vi.fn(),
	mockGetCurrentUser: vi.fn(),
}));

vi.mock("$lib/firebase/auth", () => ({
	login: mockLogin,
	getCurrentUser: mockGetCurrentUser,
}));

vi.mock("$app/navigation", () => ({
	goto: vi.fn(),
}));

describe("Admin Login Page", () => {
	const mockGoto = vi.mocked(goto);
	let originalLocation: Location;

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetCurrentUser.mockResolvedValue(null);
		originalLocation = window.location;
		const mockLocation = { ...originalLocation, href: "" };
		Object.defineProperty(window, "location", {
			value: mockLocation,
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, "location", {
			value: originalLocation,
			writable: true,
			configurable: true,
		});
	});

	it("redirects to /admin/ via full page reload after successful login", async () => {
		mockLogin.mockResolvedValue({ uid: "test-uid", email: "test@test.com" });

		render(LoginPage);
		await screen.findByText("Sign In");

		const emailInput = screen.getByLabelText("Email");
		const passwordInput = screen.getByLabelText("Password");

		await fireEvent.input(emailInput, { target: { value: "test@test.com" } });
		await fireEvent.input(passwordInput, { target: { value: "password123" } });
		await fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

		await waitFor(() => {
			expect(mockLogin).toHaveBeenCalledWith("test@test.com", "password123");
		});

		expect(window.location.href).toBe("/admin/");
		expect(mockGoto).not.toHaveBeenCalled();
	});

	it("redirects to /admin/ via goto when already authenticated on mount", async () => {
		mockGetCurrentUser.mockResolvedValue({ uid: "test-uid", email: "test@test.com" });

		render(LoginPage);

		await waitFor(() => {
			expect(mockGoto).toHaveBeenCalledWith("/admin/");
		});
	});
});
