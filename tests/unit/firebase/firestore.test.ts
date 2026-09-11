import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { QueryDocumentSnapshot, QuerySnapshot, DocumentData } from "firebase/firestore";

vi.mock("firebase/app", () => ({
	getApps: vi.fn().mockReturnValue([]),
	initializeApp: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
	collection: vi.fn(),
	query: vi.fn(),
	where: vi.fn(),
	getDocs: vi.fn(),
	getFirestore: vi.fn().mockReturnValue({}),
}));

import { collection, query, where, getDocs, getFirestore } from "firebase/firestore";

const mockCollection = vi.mocked(collection);
const mockQuery = vi.mocked(query);
const mockWhere = vi.mocked(where);
const mockGetDocs = vi.mocked(getDocs);
const mockGetFirestore = vi.mocked(getFirestore);

function createMockDocSnapshot(id: string, data: Record<string, unknown>): QueryDocumentSnapshot {
	return {
		id,
		data: () => data,
		exists: () => true,
		get: (fieldPath: string) => data[fieldPath],
		toJSON: () => ({ id, ...data }),
		ref: {} as never,
		metadata: {} as never,
	} as unknown as QueryDocumentSnapshot;
}

function createMockQuerySnapshot(docs: QueryDocumentSnapshot[]): QuerySnapshot {
	return {
		docs,
		size: docs.length,
		empty: docs.length === 0,
		forEach: (callback: (result: QueryDocumentSnapshot) => void) => docs.forEach(callback),
		query: {} as never,
	} as unknown as QuerySnapshot;
}

// Track the last where clause used
let lastWhereClause: { field: string; operator: string; value: unknown } | null = null;

vi.mocked(where).mockImplementation((field: string | import("firebase/firestore").FieldPath, operator: string, value: unknown) => {
	lastWhereClause = { field: field.toString(), operator, value };
	return { field, operator, value } as unknown as ReturnType<typeof where>;
});

describe("getDraftBySlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		lastWhereClause = null;
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("returns draft post by slug when found", async () => {
		const draftPost = {
			title: "Draft Post",
			slug: "my-draft",
			excerpt: "Draft excerpt",
			content: "Draft content",
			status: "draft",
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
		};

		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([
			createMockDocSnapshot("draft-1", draftPost),
		]));

		const { getDraftBySlug } = await import("$lib/firebase/firestore.svelte");
		const result = await getDraftBySlug("my-draft");

		expect(result).toBeTruthy();
		expect(result?.title).toBe("Draft Post");
		expect(result?.slug).toBe("my-draft");
		expect(result?.status).toBe("draft");
		expect(result?.id).toBe("draft-1");

		// Verify the where clause was applied
		expect(lastWhereClause).toEqual({ field: "status", operator: "==", value: "draft" });
	});

	it("returns null for published post (status filter)", async () => {
		// The where clause should filter to only drafts, so this post shouldn't be in results
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));

		const { getDraftBySlug } = await import("$lib/firebase/firestore.svelte");
		const result = await getDraftBySlug("published-post");

		expect(result).toBeNull();
	});

	it("returns null for unlisted post (status filter)", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));

		const { getDraftBySlug } = await import("$lib/firebase/firestore.svelte");
		const result = await getDraftBySlug("unlisted-post");

		expect(result).toBeNull();
	});

	it("returns null when slug not found", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));

		const { getDraftBySlug } = await import("$lib/firebase/firestore.svelte");
		const result = await getDraftBySlug("non-existent");

		expect(result).toBeNull();
	});

	it("handles Firestore error gracefully", async () => {
		mockGetDocs.mockRejectedValue(new Error("Firestore connection failed"));

		const { getDraftBySlug } = await import("$lib/firebase/firestore.svelte");

		await expect(getDraftBySlug("any-slug")).rejects.toThrow(
			"Firestore connection failed"
		);
	});
});

describe("getPostBySlug (legacy)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		lastWhereClause = null;
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("returns post regardless of status", async () => {
		const draftPost = {
			title: "Draft Post",
			slug: "my-draft",
			excerpt: "Draft excerpt",
			content: "Draft content",
			status: "draft",
			coverImage: null,
			imageMeta: {},
			createdAt: new Date(),
		};

		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([
			createMockDocSnapshot("draft-1", draftPost),
		]));

		const { getPostBySlug } = await import("$lib/firebase/firestore.svelte");
		const result = await getPostBySlug("my-draft");

		expect(result).toBeTruthy();
		expect(result?.status).toBe("draft");

		// getPostBySlug should not apply any where clause
		expect(lastWhereClause).toBeNull();
	});
});
