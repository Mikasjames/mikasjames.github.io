import { vi } from "vitest";
import type { BlogPost } from "$lib/firebase/firestore.svelte";
import type { User } from "firebase/auth";

export function createMockPost(overrides: Partial<BlogPost> = {}): BlogPost {
	const now = new Date();
	return {
		id: "test-post-1",
		title: "Test Blog Post",
		slug: "test-blog-post",
		excerpt: "This is a test post excerpt.",
		content: "# Hello World\n\nThis is a test post content.",
		coverImage: null,
		imageMeta: {},
		createdAt: now,
		status: "published",
		...overrides,
	};
}

export function createMockDraft(overrides: Partial<BlogPost> = {}): BlogPost {
	return createMockPost({
		status: "draft",
		title: "Draft Post",
		slug: "draft-post",
		excerpt: "This is a draft post.",
		content: "# Draft\n\nDraft content here.",
		...overrides,
	});
}

export function createMockUser(overrides: Partial<User> = {}): User {
	return {
		uid: "test-uid-123",
		email: "test@example.com",
		displayName: "Test User",
		photoURL: null,
		emailVerified: true,
		isAnonymous: false,
		metadata: {
			creationTime: new Date().toISOString(),
			lastSignInTime: new Date().toISOString(),
		},
		providerData: [],
		refreshToken: "mock-refresh-token",
		tenantId: null,
		delete: vi.fn(),
		getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
		getIdTokenResult: vi.fn(),
		reload: vi.fn(),
		toJSON: () => ({}),
		...overrides,
	} as User;
}

export function createMockPostArray(count = 3): BlogPost[] {
	return Array.from({ length: count }, (_, i) =>
		createMockPost({
			id: `post-${i + 1}`,
			title: `Test Post ${i + 1}`,
			slug: `test-post-${i + 1}`,
			excerpt: `Excerpt for post ${i + 1}`,
			content: `Content for post ${i + 1}`,
			createdAt: new Date(Date.now() - i * 86400000),
		})
	);
}