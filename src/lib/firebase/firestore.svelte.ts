import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    orderBy,
    where,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    type DocumentData,
    type DocumentSnapshot,
    limit,
    startAfter,
    writeBatch
} from 'firebase/firestore';
import { getDb } from './firebase';
import {
    getCachedHabits,
    cacheHabits,
    getCachedJournalEntries,
    cacheJournalEntries,
    getCachedHabitLogs,
    cacheHabitLogs,
    queueMutation,
    isOnline,
} from '$lib/offline/store.svelte';

export const DEFAULT_PAGE_SIZE = 12;

export interface ImageMeta {
    width: number;
    height: number;
}

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string | null;
    imageMeta?: Record<string, ImageMeta>;
    createdAt: Date | null;
    status: 'draft' | 'published' | 'unlisted';
}

const COLLECTION = 'blogs';

// --- SWR Pattern Helper ---
async function swrRead<T>(
    cacheKey: string,
    cachedGetter: () => Promise<T[]>,
    networkFetcher: () => Promise<T[]>,
    cacheSetter: (data: T[]) => Promise<void>
): Promise<T[]> {
    const cached = await cachedGetter();
    if (cached.length > 0) {
        // Fire-and-forget background refresh
        networkFetcher()
            .then(async (fresh) => {
                await cacheSetter(fresh);
            })
            .catch(() => {}); // Silent fail - keep cached
        return cached;
    }

    // Cold load: no cache, must await network
    try {
        const fresh = await networkFetcher();
        await cacheSetter(fresh);
        return fresh;
    } catch {
        return [];
    }
}

// --- Blog Posts ---
export async function getPosts(): Promise<BlogPost[]> {
    return swrRead(
        'posts',
        () => getCachedJournalEntries('__posts__'), // reuse function, different cache key
        async () => {
            const q = query(collection(getDb(), COLLECTION), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((d) => docToPost(d.id, d.data()));
        },
        (data) => cacheJournalEntries('__posts__', data)
    );
}

export async function getPostsPage(
    cursor?: DocumentSnapshot,
    pageSize = DEFAULT_PAGE_SIZE,
    options?: { status?: 'draft' | 'published' | 'unlisted' }
): Promise<{ items: BlogPost[]; nextCursor: DocumentSnapshot | null; hasMore: boolean }> {
    // Paginated reads don't cache well - fetch directly
    let q = query(collection(getDb(), COLLECTION), orderBy('createdAt', 'desc'));
    if (options?.status) {
        q = query(q, where('status', '==', options.status));
    }
    if (cursor) {
        q = query(q, startAfter(cursor));
    }
    q = query(q, limit(pageSize + 1));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => docToPost(d.id, d.data()));
    const nextCursor = hasMore ? docs[pageSize - 1] : null;
    return { items, nextCursor, hasMore };
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
    const posts = await getPosts();
    return posts.filter((p) => p.status === 'published');
}

export async function getPrerenderPosts(): Promise<BlogPost[]> {
    const posts = await getPosts();
    return posts.filter((p) => p.status === 'published' || p.status === 'unlisted');
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
    const posts = await getPosts();
    return posts.find((p) => p.slug === slug) ?? null;
}

export async function createPost(data: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string | null;
    status: 'draft' | 'published' | 'unlisted';
    imageMeta?: Record<string, ImageMeta>;
}): Promise<string> {
    try {
        const ref = await addDoc(collection(getDb(), COLLECTION), {
            ...data,
            createdAt: serverTimestamp()
        });
        return ref.id;
    } catch {
        await queueMutation('createPost', { ...data, clientUpdatedAt: new Date().toISOString() });
        // Optimistic: caller should update local state
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function updatePost(
    id: string,
    data: {
        title: string;
        slug: string;
        excerpt: string;
        content: string;
        coverImage: string | null;
        status: 'draft' | 'published' | 'unlisted';
        imageMeta?: Record<string, ImageMeta>;
    }
): Promise<void> {
    try {
        const postRef = doc(getDb(), COLLECTION, id);
        await updateDoc(postRef, data);
    } catch {
        await queueMutation('updatePost', { id, ...data, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function deletePost(id: string): Promise<void> {
    try {
        const postRef = doc(getDb(), COLLECTION, id);
        await deleteDoc(postRef);
    } catch {
        await queueMutation('deletePost', { id, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

function docToPost(id: string, data: DocumentData): BlogPost {
    return {
        id,
        title: data.title ?? '',
        slug: data.slug ?? '',
        excerpt: data.excerpt ?? '',
        content: data.content ?? '',
        coverImage: data.coverImage ?? null,
        imageMeta: data.imageMeta ?? {},
        createdAt: data.createdAt?.toDate?.() ?? null,
        status: data.status ?? 'published'
    };
}

// --- Media ---
export interface MediaItem {
    id: string;
    url: string;
    name: string;
    uploadedAt: Date | null;
    width?: number;
    height?: number;
}

const MEDIA_COLLECTION = 'media_gallery';

export async function getMediaItems(): Promise<MediaItem[]> {
    const q = query(collection(getDb(), MEDIA_COLLECTION), orderBy('uploadedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToMediaItem(d.id, d.data()));
}

export async function getMediaItemsPage(
    cursor?: DocumentSnapshot,
    pageSize = DEFAULT_PAGE_SIZE
): Promise<{ items: MediaItem[]; nextCursor: DocumentSnapshot | null; hasMore: boolean }> {
    let q = query(collection(getDb(), MEDIA_COLLECTION), orderBy('uploadedAt', 'desc'));
    if (cursor) {
        q = query(q, startAfter(cursor));
    }
    q = query(q, limit(pageSize + 1));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => docToMediaItem(d.id, d.data()));
    const nextCursor = hasMore ? docs[pageSize - 1] : null;
    return { items, nextCursor, hasMore };
}

export async function getRecentMediaItems(limitCount = 4): Promise<MediaItem[]> {
    const q = query(collection(getDb(), MEDIA_COLLECTION), orderBy('uploadedAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToMediaItem(d.id, d.data()));
}

export async function addMediaItem(data: { url: string; name: string; width?: number; height?: number }): Promise<string> {
    const ref = await addDoc(collection(getDb(), MEDIA_COLLECTION), {
        ...data,
        uploadedAt: serverTimestamp()
    });
    return ref.id;
}

export async function deleteMediaItem(id: string): Promise<void> {
    const mediaRef = doc(getDb(), MEDIA_COLLECTION, id);
    await deleteDoc(mediaRef);
}

function docToMediaItem(id: string, data: DocumentData): MediaItem {
    return {
        id,
        url: data.url ?? '',
        name: data.name ?? '',
        uploadedAt: data.uploadedAt?.toDate?.() ?? null,
        width: data.width ?? undefined,
        height: data.height ?? undefined
    };
}

// --- Journal Entries ---
export interface JournalEntry {
    id: string;
    title: string;
    excerpt?: string;
    content: string;
    coverImage?: string | null;
    imageMeta?: Record<string, ImageMeta>;
    happinessRating?: number | null;
    ownerUid?: string;
    entryDate: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    clientUpdatedAt?: string;
}

const JOURNAL_COLLECTION = 'journal';

export async function getJournalEntryByDate(ownerUid: string, date: string): Promise<JournalEntry | null> {
    const cached = await getCachedJournalEntries(ownerUid, date, date);
    if (cached.length > 0) return cached[0];

    try {
        const q = query(
            collection(getDb(), JOURNAL_COLLECTION),
            where('ownerUid', '==', ownerUid),
            where('entryDate', '==', date),
            limit(1)
        );
        const snapshot = await getDocs(q);
        const first = snapshot.docs[0];
        const entry = first ? docToJournalEntry(first.id, first.data()) : null;
        if (entry) await cacheJournalEntries(ownerUid, [entry]);
        return entry;
    } catch {
        return null;
    }
}

export async function deleteJournalEntryByDate(ownerUid: string, date: string): Promise<void> {
    const entry = await getJournalEntryByDate(ownerUid, date);
    if (entry) {
        try {
            await deleteDoc(doc(getDb(), JOURNAL_COLLECTION, entry.id));
        } catch {
            await queueMutation('deleteJournalEntry', { id: entry.id, clientUpdatedAt: new Date().toISOString() });
            throw new Error('OFFLINE_QUEUED');
        }
    }
}

export async function getJournalEntriesByMonth(ownerUid: string, year: number, month: number): Promise<JournalEntry[]> {
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const cached = await getCachedJournalEntries(ownerUid, startStr, endStr);
    if (cached.length > 0) {
        // Background refresh
        fetchJournalEntriesMonth(ownerUid, startStr, endStr).then(async (fresh) => {
            await cacheJournalEntries(ownerUid, fresh);
        }).catch(() => {});
        return cached;
    }

    return fetchJournalEntriesMonth(ownerUid, startStr, endStr);
}

async function fetchJournalEntriesMonth(ownerUid: string, startStr: string, endStr: string): Promise<JournalEntry[]> {
    const q = query(
        collection(getDb(), JOURNAL_COLLECTION),
        where('ownerUid', '==', ownerUid),
        where('entryDate', '>=', startStr),
        where('entryDate', '<=', endStr),
        orderBy('entryDate', 'asc')
    );
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map((d) => docToJournalEntry(d.id, d.data()));
    await cacheJournalEntries(ownerUid, entries);
    return entries;
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
    return swrRead(
        'journal_all',
        () => getCachedJournalEntries('__all__'),
        async () => {
            const q = query(collection(getDb(), JOURNAL_COLLECTION), orderBy('entryDate', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((d) => docToJournalEntry(d.id, d.data()));
        },
        (data) => cacheJournalEntries('__all__', data)
    );
}

export async function getJournalEntriesPage(
    cursor?: DocumentSnapshot,
    pageSize = DEFAULT_PAGE_SIZE,
    options?: { dateFrom?: string; dateTo?: string }
): Promise<{ items: JournalEntry[]; nextCursor: DocumentSnapshot | null; hasMore: boolean }> {
    let q = query(collection(getDb(), JOURNAL_COLLECTION), orderBy('entryDate', 'desc'));
    if (options?.dateFrom) {
        q = query(q, where('entryDate', '>=', options.dateFrom));
    }
    if (options?.dateTo) {
        q = query(q, where('entryDate', '<=', options.dateTo));
    }
    if (cursor) {
        q = query(q, startAfter(cursor));
    }
    q = query(q, limit(pageSize + 1));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => docToJournalEntry(d.id, d.data()));
    const nextCursor = hasMore ? docs[pageSize - 1] : null;
    return { items, nextCursor, hasMore };
}

export async function createJournalEntry(data: {
    title: string;
    excerpt?: string;
    content: string;
    coverImage?: string | null;
    imageMeta?: Record<string, ImageMeta>;
    happinessRating?: number | null;
    ownerUid?: string;
    entryDate?: string | null;
}): Promise<string> {
    try {
        const ref = await addDoc(collection(getDb(), JOURNAL_COLLECTION), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return ref.id;
    } catch {
        await queueMutation('upsertJournalEntry', { ...data, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function updateJournalEntry(
    id: string,
    data: {
        title: string;
        excerpt?: string;
        content: string;
        coverImage?: string | null;
        imageMeta?: Record<string, ImageMeta>;
        happinessRating?: number | null;
        ownerUid?: string;
        entryDate?: string | null;
    }
): Promise<void> {
    try {
        const entryRef = doc(getDb(), JOURNAL_COLLECTION, id);
        await updateDoc(entryRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    } catch {
        await queueMutation('upsertJournalEntry', { id, ...data, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function upsertJournalEntry(
    data: {
        title: string;
        excerpt?: string;
        content: string;
        coverImage?: string | null;
        imageMeta?: Record<string, ImageMeta>;
        happinessRating?: number | null;
        ownerUid?: string;
        entryDate?: string | null;
    },
    existingId?: string | null,
): Promise<string> {
    if (existingId) {
        await updateJournalEntry(existingId, data);
        return existingId;
    }
    return createJournalEntry(data);
}

export async function deleteJournalEntry(id: string): Promise<void> {
    try {
        const entryRef = doc(getDb(), JOURNAL_COLLECTION, id);
        await deleteDoc(entryRef);
    } catch {
        await queueMutation('deleteJournalEntry', { id, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

function docToJournalEntry(id: string, data: DocumentData): JournalEntry {
    return {
        id,
        title: data.title ?? '',
        excerpt: data.excerpt ?? '',
        content: data.content ?? '',
        coverImage: data.coverImage ?? null,
        imageMeta: data.imageMeta ?? {},
        happinessRating: typeof data.happinessRating === 'number' ? data.happinessRating : null,
        ownerUid: data.ownerUid ?? '',
        entryDate: data.entryDate ?? '',
        createdAt: data.createdAt?.toDate?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.() ?? null,
        clientUpdatedAt: data.clientUpdatedAt,
    };
}

// --- Habits ---
export interface Habit {
    id: string;
    name: string;
    emoji: string;
    ownerUid: string;
    createdAt: Date | null;
    order: number;
}

export interface HabitLog {
    id: string;
    habitId: string;
    habitName: string;
    emoji?: string;
    ownerUid: string;
    completedAt: Date | null;
    lastModifiedAt: Date | null;
    journalEntryId: string | null;
    date: string;
}

const HABITS_COLLECTION = 'habits';
const HABIT_LOGS_COLLECTION = 'habitLogs';

export async function getHabits(ownerUid: string): Promise<Habit[]> {
    return swrRead(
        `habits_${ownerUid}`,
        () => getCachedHabits(ownerUid),
        async () => {
            const q = query(
                collection(getDb(), HABITS_COLLECTION),
                where('ownerUid', '==', ownerUid),
                orderBy('order', 'asc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map((d) => docToHabit(d.id, d.data()));
        },
        (data) => cacheHabits(ownerUid, data)
    );
}

export async function addHabit(data: {
    name: string;
    emoji: string;
    ownerUid: string;
    order: number;
}): Promise<string> {
    try {
        const ref = await addDoc(collection(getDb(), HABITS_COLLECTION), {
            ...data,
            createdAt: serverTimestamp()
        });
        return ref.id;
    } catch {
        await queueMutation('addHabit', { ...data, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function deleteHabit(id: string): Promise<void> {
    try {
        await deleteDoc(doc(getDb(), HABITS_COLLECTION, id));
    } catch {
        await queueMutation('deleteHabit', { id, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function updateHabitOrder(id: string, order: number): Promise<void> {
    try {
        await updateDoc(doc(getDb(), HABITS_COLLECTION, id), { order });
    } catch {
        await queueMutation('updateHabitOrder', { id, order, clientUpdatedAt: new Date().toISOString() });
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function getHabitLogsForDate(ownerUid: string, date: string): Promise<HabitLog[]> {
    const cached = await getCachedHabitLogs(ownerUid, [date]);
    if (cached[date]?.length) return cached[date];

    try {
        const q = query(
            collection(getDb(), HABIT_LOGS_COLLECTION),
            where('ownerUid', '==', ownerUid),
            where('date', '==', date)
        );
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map((d) => docToHabitLog(d.id, d.data()));
        await cacheHabitLogs(ownerUid, { [date]: logs });
        return logs;
    } catch {
        return [];
    }
}

export async function getHabitLogsForJournalEntry(
    ownerUid: string,
    journalEntryId: string
): Promise<HabitLog[]> {
    try {
        const q = query(
            collection(getDb(), HABIT_LOGS_COLLECTION),
            where('ownerUid', '==', ownerUid),
            where('journalEntryId', '==', journalEntryId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => docToHabitLog(d.id, d.data()));
    } catch {
        return [];
    }
}

export async function saveHabitLogsForDateAtomic(
    ownerUid: string,
    date: string,
    journalEntryId: string | null,
    selectedHabits: Habit[]
): Promise<void> {
    const clientUpdatedAt = new Date().toISOString();
    try {
        const existingLogs = await getHabitLogsForDate(ownerUid, date);
        await replaceHabitLogsInBatch(
            existingLogs,
            selectedHabits,
            ownerUid,
            date,
            journalEntryId
        );
        // Update local cache
        const logs = selectedHabits.map((h) => ({
            id: `${ownerUid}_${date}_${h.id}`,
            habitId: h.id,
            habitName: h.name,
            emoji: h.emoji,
            ownerUid,
            completedAt: new Date(),
            lastModifiedAt: new Date(),
            journalEntryId,
            date,
            clientUpdatedAt,
        }));
        await cacheHabitLogs(ownerUid, { [date]: logs });
    } catch {
        await queueMutation('saveHabitLogsForDate', {
            ownerUid,
            date,
            journalEntryId,
            selectedHabits,
            clientUpdatedAt,
        });
        throw new Error('OFFLINE_QUEUED');
    }
}

export async function saveHabitLogsForJournalEntryAtomic(
    ownerUid: string,
    journalEntryId: string,
    date: string,
    selectedHabits: Habit[]
): Promise<void> {
    const clientUpdatedAt = new Date().toISOString();
    try {
        const existingLogs = await getHabitLogsForJournalEntry(ownerUid, journalEntryId);
        await replaceHabitLogsInBatch(
            existingLogs,
            selectedHabits,
            ownerUid,
            date,
            journalEntryId
        );
        const logs = selectedHabits.map((h) => ({
            id: `${ownerUid}_${date}_${h.id}`,
            habitId: h.id,
            habitName: h.name,
            emoji: h.emoji,
            ownerUid,
            completedAt: new Date(),
            lastModifiedAt: new Date(),
            journalEntryId,
            date,
            clientUpdatedAt,
        }));
        await cacheHabitLogs(ownerUid, { [date]: logs });
    } catch {
        await queueMutation('saveHabitLogsForJournalEntry', {
            ownerUid,
            journalEntryId,
            date,
            selectedHabits,
            clientUpdatedAt,
        });
        throw new Error('OFFLINE_QUEUED');
    }
}

async function replaceHabitLogsInBatch(
    existingLogs: HabitLog[],
    selectedHabits: Habit[],
    ownerUid: string,
    date: string,
    journalEntryId: string | null
): Promise<void> {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    const batch = writeBatch(getDb());
    const logRef = (habitId: string) =>
        doc(getDb(), HABIT_LOGS_COLLECTION, `${ownerUid}_${date}_${habitId}`);

    const selectedIds = new Set(selectedHabits.map((habit) => habit.id));
    for (const log of existingLogs) {
        if (!selectedIds.has(log.habitId)) {
            batch.delete(doc(getDb(), HABIT_LOGS_COLLECTION, log.id));
        }
    }

    for (const habit of selectedHabits) {
        batch.set(
            logRef(habit.id),
            {
                habitId: habit.id,
                habitName: habit.name,
                emoji: habit.emoji,
                ownerUid,
                completedAt: serverTimestamp(),
                lastModifiedAt: serverTimestamp(),
                journalEntryId,
                date,
                clientUpdatedAt: new Date().toISOString(),
            },
            { merge: true }
        );
    }

    await batch.commit();
}

export async function getHabitLogsForDates(
    ownerUid: string,
    dates: string[]
): Promise<Record<string, HabitLog[]>> {
    const uniqueDates = [...new Set(dates)].filter(Boolean);
    const cached = await getCachedHabitLogs(ownerUid, uniqueDates);
    const cachedDates = Object.keys(cached);
    const missingDates = uniqueDates.filter((d) => !cachedDates.includes(d));

    if (missingDates.length === 0) return cached;

    // Fetch missing dates
    const byDate: Record<string, HabitLog[]> = { ...cached };
    for (let i = 0; i < missingDates.length; i += 10) {
        const batch = missingDates.slice(i, i + 10);
        try {
            const q = query(
                collection(getDb(), HABIT_LOGS_COLLECTION),
                where('ownerUid', '==', ownerUid),
                where('date', 'in', batch)
            );
            const snapshot = await getDocs(q);
            for (const log of snapshot.docs.map((d) => docToHabitLog(d.id, d.data()))) {
                byDate[log.date] = [...(byDate[log.date] ?? []), log];
            }
        } catch {
            // Keep cached
        }
    }

    await cacheHabitLogs(ownerUid, byDate);
    return byDate;
}

// --- Insights ---
export interface AiAnalysisResult {
    briefSummary?: string;
    overallSentiment?: string;
    primaryEmotion?: string;
    keyThemes?: string[];
    patterns?: string[];
    ratingCorrelations?: Array<{ factor: string; impact: string; averageRating: number }>;
}

export interface LocalAnalysis {
    keywordFrequencyByRating?: {
        highRated?: Record<string, number>;
        lowRated?: Record<string, number>;
    };
    sentimentVsRating?: {
        lexicalSentimentScore?: number;
    };
}

export type TextAnalysis = {
    source: 'groq-api' | 'gemini-api';
    result: AiAnalysisResult;
    fallback?: LocalAnalysis;
} | {
    source: 'local-fallback';
} & LocalAnalysis;

export type InsightScope = {
    entryCount: number;
    ratedDayCount?: number;
    averageRating: number | null;
    trendSlopePerDay: number | null;
    variance: number | null;
    streaks: {
        longestHighDays: number;
        longestLowDays: number;
    };
    dailyRatings: Array<{ date: string; time: number; rating: number }>;
    textAnalysis?: TextAnalysis;
    habitSummary?: HabitSummary;
    habitCorrelations?: CalculatedHabitCorrelation[];
};

export interface MonthlyInsight {
    id: string;
    period: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    generatedAt: Date | null;
    monthly?: InsightScope;
    yearToDate?: InsightScope;
}

export async function getLatestMonthlyInsight(ownerUid: string): Promise<MonthlyInsight | null> {
    const q = query(
        collection(getDb(), 'insights', ownerUid, 'monthly'),
        orderBy('period', 'desc'),
        limit(1)
    );
    const snapshot = await getDocs(q);
    const first = snapshot.docs[0];
    return first ? docToMonthlyInsight(first.id, first.data()) : null;
}

export async function getMonthlyInsightByPeriod(
    ownerUid: string,
    period: string
): Promise<MonthlyInsight | null> {
    const snapshot = await getDoc(doc(getDb(), 'insights', ownerUid, 'monthly', period));
    return snapshot.exists() ? docToMonthlyInsight(snapshot.id, snapshot.data()) : null;
}

function docToHabit(id: string, data: DocumentData): Habit {
    return {
        id,
        name: data.name ?? '',
        emoji: data.emoji ?? '',
        ownerUid: data.ownerUid ?? '',
        createdAt: data.createdAt?.toDate?.() ?? null,
        order: typeof data.order === 'number' ? data.order : 0
    };
}

function docToHabitLog(id: string, data: DocumentData): HabitLog {
    return {
        id,
        habitId: data.habitId ?? '',
        habitName: data.habitName ?? '',
        emoji: data.emoji ?? '',
        ownerUid: data.ownerUid ?? '',
        completedAt: data.completedAt?.toDate?.() ?? null,
        lastModifiedAt: data.lastModifiedAt?.toDate?.() ?? null,
        journalEntryId: data.journalEntryId ?? null,
        date: data.date ?? ''
    };
}

function docToMonthlyInsight(id: string, data: DocumentData): MonthlyInsight {
    return {
        id,
        period: data.period ?? id,
        periodStart: data.periodStart?.toDate?.() ?? null,
        periodEnd: data.periodEnd?.toDate?.() ?? null,
        generatedAt: data.generatedAt?.toDate?.() ?? null,
        monthly: data.monthly,
        yearToDate: data.yearToDate
    };
}

export type HabitSummary = {
    totalCheckIns: number;
    byHabit: Record<string, { name: string; count: number; dates: string[] }>;
};

export interface CalculatedHabitCorrelation {
    habitId: string;
    habitName: string;
    averageRatingOnCompletedDays: number | null;
    averageRatingOnMissedDays: number | null;
    completedDaysCount: number;
    missedDaysCount: number;
    insight?: string;
}