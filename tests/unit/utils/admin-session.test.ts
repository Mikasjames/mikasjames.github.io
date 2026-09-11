import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { User } from "firebase/auth";
import { onAdminSession } from "$lib/utils/admin-session";

describe("onAdminSession", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns void when window is undefined (SSR safety)", () => {
		const originalWindow = global.window;
		// @ts-expect-error - delete window for SSR test
		delete global.window;

		const cleanup = onAdminSession(() => {});

		expect(cleanup).toBeUndefined();

		global.window = originalWindow;
	});

	it("returns void when no mj_admin_session in localStorage (visitor fast-path)", () => {
		window.localStorage.removeItem("mj_admin_session");

		const cleanup = onAdminSession(() => {});

		expect(cleanup).toBeUndefined();
	});

	it("calls subscribeToAuth when session exists (admin path triggers)", () => {
		window.localStorage.setItem("mj_admin_session", "1");

		const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
			cb({ uid: "test-uid" } as User);
			return () => {};
		});

		let called = false;
		onAdminSession(() => { called = true; }, { subscribeToAuth: mockSubscribeToAuth });

		vi.runAllTimers();

		expect(called).toBe(true);
	});

	it("defers via requestIdleCallback when available", () => {
		window.localStorage.setItem("mj_admin_session", "1");

		const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
			cb({ uid: "test-uid" } as User);
			return () => {};
		});

		const requestIdleCallbackSpy = vi.spyOn(window, "requestIdleCallback");
		onAdminSession(() => {}, { subscribeToAuth: mockSubscribeToAuth });

		expect(requestIdleCallbackSpy).toHaveBeenCalled();
	});

	it("falls back to setTimeout when requestIdleCallback is not available", () => {
		const originalRIC = window.requestIdleCallback;
		// @ts-expect-error - remove for test
		delete window.requestIdleCallback;

		const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
			cb({ uid: "test-uid" } as User);
			return () => {};
		});

		const setTimeoutSpy = vi.spyOn(window, "setTimeout");
		onAdminSession(() => {}, { subscribeToAuth: mockSubscribeToAuth });

		expect(setTimeoutSpy).toHaveBeenCalled();

		window.requestIdleCallback = originalRIC;
	});

	it("calls callback with user when auth resolves to user", () => {
		const mockUser = { uid: "test-uid", email: "test@example.com" } as User;

		const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
			cb(mockUser);
			return () => {};
		});

		let receivedUser: User | null = null;
		onAdminSession((user) => { receivedUser = user; }, { subscribeToAuth: mockSubscribeToAuth });

		vi.runAllTimers();

		expect(receivedUser).toBeTruthy();
		expect(receivedUser).toHaveProperty("uid");
	});

	it("cleanup function unsubscribes from auth", () => {
		let callCount = 0;

		const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
			cb({ uid: "test-uid" } as User);
			return () => {};
		});

		const cleanup = onAdminSession(() => { callCount++; }, { subscribeToAuth: mockSubscribeToAuth });

		vi.runAllTimers();
		expect(callCount).toBe(1);

		cleanup?.();

		vi.runAllTimers();

		expect(callCount).toBe(1);
	});

	it("handles rapid mount/unmount without race conditions", () => {
		const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
			cb({ uid: "test-uid" } as User);
			return () => {};
		});

		let lastUser: User | null = null;
		const cleanup1 = onAdminSession((user) => { lastUser = user; }, { subscribeToAuth: mockSubscribeToAuth });

		vi.runAllTimers();
		const firstUser = lastUser;

		cleanup1?.();

		const cleanup2 = onAdminSession((user) => { lastUser = user; }, { subscribeToAuth: mockSubscribeToAuth });

		vi.runAllTimers();

		expect(lastUser).toBeTruthy();
		expect(lastUser).toEqual(firstUser);

		cleanup2?.();
	});

	it("does not leak callbacks on multiple mount cycles", () => {
		const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
			cb({ uid: "test-uid" } as User);
			return () => {};
		});

		let callCount = 0;

		for (let i = 0; i < 5; i++) {
			const cleanup = onAdminSession(() => { callCount++; }, { subscribeToAuth: mockSubscribeToAuth });
			vi.runAllTimers();
			cleanup?.();
		}

		expect(callCount).toBe(5);
	});
});
