import {
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import { auth } from './firebase';

export async function login(email: string, password: string): Promise<User> {
	const credential = await signInWithEmailAndPassword(auth, email, password);
	return credential.user;
}

export async function logout(): Promise<void> {
	await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
	return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): Promise<User | null> {
	return new Promise((resolve) => {
		const unsub = onAuthStateChanged(auth, (user) => {
			unsub();
			resolve(user);
		});
	});
}
