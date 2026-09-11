import { vi, type Mock } from "vitest";
import type { User } from "firebase/auth";

let currentCallback: ((user: User | null) => void) | null = null;
let currentUser: User | null = null;

const mockSubscribeToAuth = vi.fn((cb: (user: User | null) => void) => {
	currentCallback = cb;
	cb(currentUser);
	return () => {
		currentCallback = null;
	};
});

const mockLogin = vi.fn(async (email: string, password: string): Promise<User> => {
	const user = { uid: "test-uid", email, displayName: "Test User" } as User;
	currentUser = user;
	if (currentCallback) currentCallback(user);
	return user;
});

const mockLogout = vi.fn(async (): Promise<void> => {
	currentUser = null;
	if (currentCallback) currentCallback(null);
});

const mockGetCurrentUser = vi.fn(async (): Promise<User | null> => {
	return currentUser;
});

export const mockAuth = {
	setUser: (user: User | null) => {
		currentUser = user;
		if (currentCallback) currentCallback(user);
	},
	subscribeToAuth: mockSubscribeToAuth,
	login: mockLogin,
	logout: mockLogout,
	getCurrentUser: mockGetCurrentUser,
	reset: () => {
		currentUser = null;
		currentCallback = null;
		mockSubscribeToAuth.mockClear();
		mockLogin.mockClear();
		mockLogout.mockClear();
		mockGetCurrentUser.mockClear();
	},
};

vi.mock("$lib/firebase/auth", () => ({
	subscribeToAuth: mockSubscribeToAuth,
	login: mockLogin,
	logout: mockLogout,
	getCurrentUser: mockGetCurrentUser,
}));

vi.mock("firebase/auth", () => ({
	getAuth: vi.fn(),
	signInWithEmailAndPassword: vi.fn(),
	signOut: vi.fn(),
	onAuthStateChanged: vi.fn(),
	User: vi.fn(),
}));