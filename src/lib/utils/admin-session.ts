import type { User } from "firebase/auth";

export function onAdminSession(callback: (user: User) => void): (() => void) | void {
	if (typeof window === "undefined" || !localStorage.getItem("mj_admin_session")) {
		return;
	}

	let unsub: (() => void) | undefined;

	const init = async () => {
		const { subscribeToAuth } = await import("$lib/firebase/auth");
		unsub = subscribeToAuth((user) => {
			if (user) callback(user);
		});
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