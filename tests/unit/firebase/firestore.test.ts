import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { QueryDocumentSnapshot, QuerySnapshot } from "firebase/firestore";

vi.mock("firebase/app", () => ({
	getApps: vi.fn().mockReturnValue([]),
	initializeApp: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
	collection: vi.fn(),
	query: vi.fn(),
	where: vi.fn(),
	limit: vi.fn(),
	getDocs: vi.fn(),
	getFirestore: vi.fn().mockReturnValue({}),
}));

import { where, limit, getDocs } from "firebase/firestore";

const mockGetDocs = vi.mocked(getDocs);

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

// Collect every where clause, in order. Queries here apply more than one
// filter, so tracking only the last would assert on an arbitrary clause.
type WhereClause = { field: string; operator: string; value: unknown };
let whereClauses: WhereClause[] = [];

// Limits are tracked separately -- they are not a filter.
let limitArgs: unknown[] = [];

// Re-installed before each test: the afterEach below resets implementations.
beforeEach(() => {
	whereClauses = [];
	limitArgs = [];

	vi.mocked(where).mockImplementation((
		field: string | import("firebase/firestore").FieldPath,
		operator: string,
		value: unknown,
	) => {
		whereClauses.push({ field: field.toString(), operator, value });
		return { field, operator, value } as unknown as ReturnType<typeof where>;
	});

	vi.mocked(limit).mockImplementation((count: unknown) => {
		limitArgs.push(count);
		return { kind: "limit", count } as unknown as ReturnType<typeof limit>;
	});
});

describe("getDraftBySlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

		// Both constraints are applied: drafts only, and this specific slug.
		// Reading is a single indexed lookup, not a collection scan.
		expect(whereClauses).toEqual([
			{ field: "status", operator: "==", value: "draft" },
			{ field: "slug", operator: "==", value: "my-draft" },
		]);
		expect(limitArgs).toEqual([1]);
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

describe("getPostBySlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

		// Looked up by slug via a single indexed read, rather than fetching
		// the whole collection and matching in JS. No status filter: the
		// route applies its own draft check, and this returns drafts.
		expect(whereClauses).toEqual([
			{ field: "slug", operator: "==", value: "my-draft" },
		]);
		expect(limitArgs).toEqual([1]);
	});

	it("returns null when the slug does not match any document", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));

		const { getPostBySlug } = await import("$lib/firebase/firestore.svelte");
		const result = await getPostBySlug("no-such-post");

		expect(result).toBeNull();
	});
});
