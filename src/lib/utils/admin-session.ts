import type { User } from "firebase/auth";

export interface AdminSessionOptions {
	subscribeToAuth: (callback: (user: User | null) => void) => (() => void) | Promise<() => void>;
}

export function onAdminSession(
	callback: (user: User) => void,
	options?: AdminSessionOptions
): (() => void) | void {
	const subscribeToAuth = options?.subscribeToAuth ?? defaultSubscribeToAuth;

	if (typeof window === "undefined" || !localStorage.getItem("mj_admin_session")) {
		return;
	}

	let unsub: (() => void) | undefined;

	const init = async () => {
		const result = subscribeToAuth((user) => {
			if (user) callback(user);
		});
		if (result instanceof Promise) {
			unsub = await result;
		} else {
			unsub = result;
		}
	};

	if ("requestIdleCallback" in window) {
		window.requestIdleCallback(() => init());
	} else {
		setTimeout(init, 100);
	}

	return () => {
		if (unsub) unsub();
	};
}

async function defaultSubscribeToAuth(callback: (user: User | null) => void): Promise<() => void> {
	const { subscribeToAuth } = await import("$lib/firebase/auth");
	return subscribeToAuth(callback);
}