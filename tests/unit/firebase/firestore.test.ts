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

describe("getHabitLogsInRange", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("reads a whole span in one indexed range query", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));

		const { getHabitLogsInRange } = await import("$lib/firebase/firestore.svelte");
		await getHabitLogsInRange("u1", "2026-01-01", "2026-12-31");

		// A single getDocs covering the full year, rather than a chunked `in`
		// loop. The order matters: equality first, then the range bounds.
		expect(whereClauses).toEqual([
			{ field: "ownerUid", operator: "==", value: "u1" },
			{ field: "date", operator: ">=", value: "2026-01-01" },
			{ field: "date", operator: "<=", value: "2026-12-31" },
		]);
		expect(limitArgs).toEqual([]);
	});

	it("maps documents onto habit logs", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([
			createMockDocSnapshot("u1_2026-07-10_h1", {
				habitId: "h1",
				habitName: "Gym",
				emoji: "🏋️",
				ownerUid: "u1",
				date: "2026-07-10",
				journalEntryId: "e1",
			}),
		]));

		const { getHabitLogsInRange } = await import("$lib/firebase/firestore.svelte");
		const [log] = await getHabitLogsInRange("u1", "2026-07-01", "2026-07-31");

		expect(log).toMatchObject({
			id: "u1_2026-07-10_h1",
			habitId: "h1",
			habitName: "Gym",
			date: "2026-07-10",
			journalEntryId: "e1",
		});
		// Pending server timestamps resolve to null rather than throwing.
		expect(log.completedAt).toBeNull();
	});
});

describe("getAllHabitLogs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("filters by owner only, with no date bound", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));

		const { getAllHabitLogs } = await import("$lib/firebase/firestore.svelte");
		await getAllHabitLogs("u1");

		expect(whereClauses).toEqual([
			{ field: "ownerUid", operator: "==", value: "u1" },
		]);
	});
});

describe("getJournalRatingsInRange", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("averages several entries recorded on the same date", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([
			createMockDocSnapshot("e1", { entryDate: "2026-07-10", happinessRating: 5 }),
			createMockDocSnapshot("e2", { entryDate: "2026-07-10", happinessRating: 3 }),
			createMockDocSnapshot("e3", { entryDate: "2026-07-11", happinessRating: 1 }),
		]));

		const { getJournalRatingsInRange } = await import("$lib/firebase/firestore.svelte");
		const ratings = await getJournalRatingsInRange("u1", "2026-07-01", "2026-07-31");

		expect(ratings).toEqual({ "2026-07-10": 4, "2026-07-11": 1 });
		expect(whereClauses).toEqual([
			{ field: "ownerUid", operator: "==", value: "u1" },
			{ field: "entryDate", operator: ">=", value: "2026-07-01" },
			{ field: "entryDate", operator: "<=", value: "2026-07-31" },
		]);
	});

	it("skips entries with a missing date or a non-numeric rating", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([
			createMockDocSnapshot("e1", { entryDate: "2026-07-10", happinessRating: 4 }),
			createMockDocSnapshot("e2", { entryDate: "", happinessRating: 5 }),
			createMockDocSnapshot("e3", { entryDate: "2026-07-11" }),
			createMockDocSnapshot("e4", { entryDate: "2026-07-12", happinessRating: null }),
			createMockDocSnapshot("e5", { entryDate: "2026-07-13", happinessRating: "5" }),
		]));

		const { getJournalRatingsInRange } = await import("$lib/firebase/firestore.svelte");
		const ratings = await getJournalRatingsInRange("u1", "2026-07-01", "2026-07-31");

		expect(ratings).toEqual({ "2026-07-10": 4 });
	});

	it("returns an empty map when nothing is rated", async () => {
		mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));

		const { getJournalRatingsInRange } = await import("$lib/firebase/firestore.svelte");

		expect(await getJournalRatingsInRange("u1", "2026-07-01", "2026-07-31")).toEqual({});
	});
});
