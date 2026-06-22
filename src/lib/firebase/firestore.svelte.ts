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
    limit,
    setDoc
} from 'firebase/firestore';
import { db } from './firebase';

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

export async function getPosts(): Promise<BlogPost[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToPost(d.id, d.data()));
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
    const snapshot = await getDocs(collection(db, COLLECTION));
    const match = snapshot.docs.find((d) => d.data().slug === slug);
    if (!match) return null;
    return docToPost(match.id, match.data());
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
    const ref = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp()
    });
    return ref.id;
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
    const postRef = doc(db, COLLECTION, id);
    await updateDoc(postRef, data);
}

export async function deletePost(id: string): Promise<void> {
    const postRef = doc(db, COLLECTION, id);
    await deleteDoc(postRef);
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
    const q = query(collection(db, MEDIA_COLLECTION), orderBy('uploadedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToMediaItem(d.id, d.data()));
}

export async function getRecentMediaItems(limitCount = 4): Promise<MediaItem[]> {
    const q = query(collection(db, MEDIA_COLLECTION), orderBy('uploadedAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToMediaItem(d.id, d.data()));
}

export async function addMediaItem(data: { url: string; name: string; width?: number; height?: number }): Promise<string> {
    const ref = await addDoc(collection(db, MEDIA_COLLECTION), {
        ...data,
        uploadedAt: serverTimestamp()
    });
    return ref.id;
}

export async function deleteMediaItem(id: string): Promise<void> {
    const mediaRef = doc(db, MEDIA_COLLECTION, id);
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
}

const JOURNAL_COLLECTION = 'journal';

export async function getJournalEntries(): Promise<JournalEntry[]> {
    const q = query(collection(db, JOURNAL_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToJournalEntry(d.id, d.data()));
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
    const ref = await addDoc(collection(db, JOURNAL_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return ref.id;
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
    const entryRef = doc(db, JOURNAL_COLLECTION, id);
    await updateDoc(entryRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

export async function deleteJournalEntry(id: string): Promise<void> {
    const entryRef = doc(db, JOURNAL_COLLECTION, id);
    await deleteDoc(entryRef);
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
        updatedAt: data.updatedAt?.toDate?.() ?? null
    };
}

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
    completedAt: Date | null;     // When the habit was actually done
    lastModifiedAt: Date | null;  // When this log was last edited
    journalEntryId: string | null;
    date: string;                 // The date the habit applies to (YYYY-MM-DD)
}

export interface CalculatedHabitCorrelation {
    habitId: string;
    habitName: string;
    averageRatingOnCompletedDays: number | null;
    averageRatingOnMissedDays: number | null;
    completedDaysCount: number;
    missedDaysCount: number;
    insight?: string;
}

export type HabitSummary = {
    totalCheckIns: number;
    byHabit: Record<string, { name: string; count: number; dates: string[] }>;
};

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
    textAnalysis?: any;
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

const HABITS_COLLECTION = 'habits';
const HABIT_LOGS_COLLECTION = 'habitLogs';

export async function getHabits(ownerUid: string): Promise<Habit[]> {
    const q = query(
        collection(db, HABITS_COLLECTION),
        where('ownerUid', '==', ownerUid),
        orderBy('order', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToHabit(d.id, d.data()));
}

export async function addHabit(data: {
    name: string;
    emoji: string;
    ownerUid: string;
    order: number;
}): Promise<string> {
    const ref = await addDoc(collection(db, HABITS_COLLECTION), {
        ...data,
        createdAt: serverTimestamp()
    });
    return ref.id;
}

export async function deleteHabit(id: string): Promise<void> {
    await deleteDoc(doc(db, HABITS_COLLECTION, id));
}

export async function updateHabitOrder(id: string, order: number): Promise<void> {
    await updateDoc(doc(db, HABITS_COLLECTION, id), { order });
}

export async function getHabitLogsForDate(ownerUid: string, date: string): Promise<HabitLog[]> {
    const q = query(
        collection(db, HABIT_LOGS_COLLECTION),
        where('ownerUid', '==', ownerUid),
        where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToHabitLog(d.id, d.data()));
}

export async function getHabitLogsForJournalEntry(
    ownerUid: string,
    journalEntryId: string
): Promise<HabitLog[]> {
    const q = query(
        collection(db, HABIT_LOGS_COLLECTION),
        where('ownerUid', '==', ownerUid),
        where('journalEntryId', '==', journalEntryId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToHabitLog(d.id, d.data()));
}

export async function deleteHabitLogsForJournalEntry(
    ownerUid: string,
    journalEntryId: string
): Promise<void> {
    const logs = await getHabitLogsForJournalEntry(ownerUid, journalEntryId);
    await Promise.all(logs.map((log) => deleteDoc(doc(db, HABIT_LOGS_COLLECTION, log.id))));
}

export async function getHabitLogsForDates(
    ownerUid: string,
    dates: string[]
): Promise<Record<string, HabitLog[]>> {
    const uniqueDates = [...new Set(dates)].filter(Boolean);
    const byDate: Record<string, HabitLog[]> = {};
    for (let i = 0; i < uniqueDates.length; i += 10) {
        const batch = uniqueDates.slice(i, i + 10);
        const q = query(
            collection(db, HABIT_LOGS_COLLECTION),
            where('ownerUid', '==', ownerUid),
            where('date', 'in', batch)
        );
        const snapshot = await getDocs(q);
        for (const log of snapshot.docs.map((d) => docToHabitLog(d.id, d.data()))) {
            byDate[log.date] = [...(byDate[log.date] ?? []), log];
        }
    }
    return byDate;
}

export async function upsertHabitLog(data: {
    habit: Habit;
    ownerUid: string;
    date: string;
    journalEntryId: string | null;
}): Promise<void> {
    // Validate date format
    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        throw new Error(`Invalid date format: ${data.date}. Expected YYYY-MM-DD`);
    }

    const logId = `${data.ownerUid}_${data.date}_${data.habit.id}`;
    await setDoc(
        doc(db, HABIT_LOGS_COLLECTION, logId),
        {
            habitId: data.habit.id,
            habitName: data.habit.name,
            emoji: data.habit.emoji,
            ownerUid: data.ownerUid,
            completedAt: serverTimestamp(),        // When the habit was actually done
            lastModifiedAt: serverTimestamp(),     // When this log was last edited
            journalEntryId: data.journalEntryId,
            date: data.date                        // The date this habit applies to
        },
        { merge: true }
    );
}

export async function getLatestMonthlyInsight(ownerUid: string): Promise<MonthlyInsight | null> {
    const q = query(
        collection(db, 'insights', ownerUid, 'monthly'),
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
    const snapshot = await getDoc(doc(db, 'insights', ownerUid, 'monthly', period));
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
