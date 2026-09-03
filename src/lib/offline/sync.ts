import { getDb } from '$lib/firebase/firebase';
import {
  doc,
  setDoc,
  getDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  newJournalEntryId,
  newHabitLogId,
  newHabitId,
  newBlogPostId,
  processQueue,
  markProcessed,
  markFailed,
  incrementRetries,
  getPendingMutations,
  offlineDB,
} from './store.svelte';

// --- Idempotent Mutation Execution ---

export async function executeMutationIdempotent(mut: any): Promise<void> {
  const { type, payload } = mut;

  switch (type) {
    case 'upsertJournalEntry':
      await executeUpsertJournalEntry(payload);
      break;
    case 'saveHabitLogsForDate':
      await executeSaveHabitLogsForDate(payload);
      break;
    case 'saveHabitLogsForJournalEntry':
      await executeSaveHabitLogsForJournalEntry(payload);
      break;
    case 'addHabit':
      await executeAddHabit(payload);
      break;
    case 'deleteHabit':
      await executeDeleteHabit(payload);
      break;
    case 'updateHabitOrder':
      await executeUpdateHabitOrder(payload);
      break;
    case 'createPost':
      await executeCreatePost(payload);
      break;
    case 'updatePost':
      await executeUpdatePost(payload);
      break;
    case 'deletePost':
      await executeDeletePost(payload);
      break;
    default:
      console.warn(`Unknown mutation type: ${type}`);
  }
}

// --- Journal Entries ---

async function executeUpsertJournalEntry(payload: {
  id?: string;
  title: string;
  excerpt?: string;
  content: string;
  coverImage?: string | null;
  imageMeta?: Record<string, { width: number; height: number }>;
  happinessRating?: number | null;
  ownerUid: string;
  entryDate: string;
  clientUpdatedAt: string; // ISO string from client
}): Promise<void> {
  const db = getDb();
  const entryId = payload.id ?? newJournalEntryId();
  const entryRef = doc(db, 'journal', entryId);

  // Check for conflict using clientUpdatedAt
  const existingSnap = await getDoc(entryRef);
  if (existingSnap.exists()) {
    const existingData = existingSnap.data();
    if (existingData.clientUpdatedAt && existingData.clientUpdatedAt > payload.clientUpdatedAt) {
      // Server has newer version - backup local to revisions
      await offlineDB.journalEntries.add({
        ...existingData,
        id: existingSnap.id,
        conflict: true,
        backedUpAt: new Date(),
      });
      // LWW: apply server version (skip local write)
      return;
    }
  }

  const data = {
    title: payload.title,
    excerpt: payload.excerpt ?? '',
    content: payload.content,
    coverImage: payload.coverImage ?? null,
    imageMeta: payload.imageMeta ?? {},
    happinessRating: payload.happinessRating ?? null,
    ownerUid: payload.ownerUid,
    entryDate: payload.entryDate,
    clientUpdatedAt: payload.clientUpdatedAt,
    updatedAt: Timestamp.now(),
  };

  await setDoc(entryRef, data, { merge: true });
}

// --- Habit Logs ---

async function executeSaveHabitLogsForDate(payload: {
  ownerUid: string;
  date: string;
  journalEntryId: string | null;
  selectedHabits: Array<{ id: string; name: string; emoji: string }>;
  clientUpdatedAt: string;
}): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  // Get existing logs for this date
  const { getHabitLogsForDate } = await import('$lib/firebase/firestore.svelte');
  const existingLogs = await getHabitLogsForDate(payload.ownerUid, payload.date);

  const selectedIds = new Set(payload.selectedHabits.map((h) => h.id));

  // Delete unselected
  for (const log of existingLogs) {
    if (!selectedIds.has(log.habitId)) {
      batch.delete(doc(db, 'habitLogs', log.id));
    }
  }

  // Upsert selected
  for (const habit of payload.selectedHabits) {
    const logId = `${payload.ownerUid}_${payload.date}_${habit.id}`;
    batch.set(
      doc(db, 'habitLogs', logId),
      {
        habitId: habit.id,
        habitName: habit.name,
        emoji: habit.emoji,
        ownerUid: payload.ownerUid,
        completedAt: Timestamp.now(),
        lastModifiedAt: Timestamp.now(),
        journalEntryId: payload.journalEntryId,
        date: payload.date,
        clientUpdatedAt: payload.clientUpdatedAt,
      },
      { merge: true },
    );
  }

  await batch.commit();
}

async function executeSaveHabitLogsForJournalEntry(payload: {
  ownerUid: string;
  journalEntryId: string;
  date: string;
  selectedHabits: Array<{ id: string; name: string; emoji: string }>;
  clientUpdatedAt: string;
}): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  const { getHabitLogsForJournalEntry } = await import('$lib/firebase/firestore.svelte');
  const existingLogs = await getHabitLogsForJournalEntry(payload.ownerUid, payload.journalEntryId);

  const selectedIds = new Set(payload.selectedHabits.map((h) => h.id));

  for (const log of existingLogs) {
    if (!selectedIds.has(log.habitId)) {
      batch.delete(doc(db, 'habitLogs', log.id));
    }
  }

  for (const habit of payload.selectedHabits) {
    const logId = `${payload.ownerUid}_${payload.date}_${habit.id}`;
    batch.set(
      doc(db, 'habitLogs', logId),
      {
        habitId: habit.id,
        habitName: habit.name,
        emoji: habit.emoji,
        ownerUid: payload.ownerUid,
        completedAt: Timestamp.now(),
        lastModifiedAt: Timestamp.now(),
        journalEntryId: payload.journalEntryId,
        date: payload.date,
        clientUpdatedAt: payload.clientUpdatedAt,
      },
      { merge: true },
    );
  }

  await batch.commit();
}

// --- Habits ---

async function executeAddHabit(payload: {
  name: string;
  emoji: string;
  ownerUid: string;
  order: number;
}): Promise<void> {
  const db = getDb();
  const habitId = newHabitId();
  await setDoc(doc(db, 'habits', habitId), {
    name: payload.name,
    emoji: payload.emoji,
    ownerUid: payload.ownerUid,
    order: payload.order,
    createdAt: Timestamp.now(),
  });
}

async function executeDeleteHabit(payload: { id: string }): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, 'habits', payload.id), { deleted: true }, { merge: true });
}

async function executeUpdateHabitOrder(payload: { id: string; order: number }): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, 'habits', payload.id), { order: payload.order }, { merge: true });
}

// --- Blog Posts ---

async function executeCreatePost(payload: {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  status: 'draft' | 'published' | 'unlisted';
  imageMeta?: Record<string, { width: number; height: number }>;
}): Promise<void> {
  const db = getDb();
  const postId = newBlogPostId();
  await setDoc(doc(db, 'blogs', postId), {
    ...payload,
    createdAt: Timestamp.now(),
  });
}

async function executeUpdatePost(payload: {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  status: 'draft' | 'published' | 'unlisted';
  imageMeta?: Record<string, { width: number; height: number }>;
}): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, 'blogs', payload.id), {
    ...payload,
    updatedAt: Timestamp.now(),
  });
}

async function executeDeletePost(payload: { id: string }): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, 'blogs', payload.id), { deleted: true }, { merge: true });
}