import type { User } from "firebase/auth";

export const MOCK_USER: User = {
	uid: "test-uid",
	email: "test@example.com",
	emailVerified: true,
	isAnonymous: false,
	displayName: "Test User",
	phoneNumber: null,
	photoURL: null,
	providerId: "firebase",
	metadata: {
		creationTime: "2024-01-01T00:00:00Z",
		lastSignInTime: "2024-01-15T00:00:00Z",
	},
	providerData: [
		{
			uid: "test-uid",
			email: "test@example.com",
			displayName: "Test User",
			phoneNumber: null,
			photoURL: null,
			providerId: "password",
		},
	],
	refreshToken: "mock-refresh-token",
	tenantId: null,
	delete: async () => {},
	getIdToken: async () => "mock-id-token",
	getIdTokenResult: async () => ({
		token: "mock-id-token",
		authTime: "2024-01-15T00:00:00Z",
		issuedAtTime: "2024-01-15T00:00:00Z",
		expirationTime: "2024-01-16T00:00:00Z",
		signInProvider: "password",
		signInSecondFactor: null,
		claims: {},
	}),
	reload: async () => {},
	toJSON: () => ({}),
};
