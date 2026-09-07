import {
	getAuth,
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import app from './firebase';

let authInstance: ReturnType<typeof getAuth> | null = null;
function getAuthInstance() {
	if (!authInstance) authInstance = getAuth(app);
	return authInstance;
}

export async function login(email: string, password: string): Promise<User> {
	const credential = await signInWithEmailAndPassword(getAuthInstance(), email, password);
	if (typeof window !== "undefined") localStorage.setItem("mj_admin_session", "1");
	return credential.user;
}

export async function logout(): Promise<void> {
	await signOut(getAuthInstance());
	if (typeof window !== "undefined") localStorage.removeItem("mj_admin_session");
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
	return onAuthStateChanged(getAuthInstance(), (user) => {
		if (typeof window !== "undefined") {
			if (user) localStorage.setItem("mj_admin_session", "1");
			else localStorage.removeItem("mj_admin_session");
		}
		callback(user);
	});
}

export function getCurrentUser(): Promise<User | null> {
	return new Promise((resolve) => {
		const unsub = onAuthStateChanged(getAuthInstance(), (user) => {
			unsub();
			resolve(user);
		});
	});
}
