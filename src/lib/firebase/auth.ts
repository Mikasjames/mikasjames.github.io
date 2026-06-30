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
	return credential.user;
}

export async function logout(): Promise<void> {
	await signOut(getAuthInstance());
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
	return onAuthStateChanged(getAuthInstance(), callback);
}

export function getCurrentUser(): Promise<User | null> {
	return new Promise((resolve) => {
		const unsub = onAuthStateChanged(getAuthInstance(), (user) => {
			unsub();
			resolve(user);
		});
	});
}
