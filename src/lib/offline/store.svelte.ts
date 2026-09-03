import { state } from 'svelte';
import { offlineDB } from './db';
import { newJournalEntryId, newHabitLogId, newHabitId, newBlogPostId } from './ids';

// --- State ---
export const isOnline = $state(true);
export const syncStatus = $state<'idle' | 'syncing' | 'error'>('idle');
export const lastSynced = $state<Date | null>(null);
export const pendingCount = $state(0);

// --- Cache getters/setters ---
export async function cacheHabits(uid: string, habits: any[]) {
  await offlineDB.habits.bulkPut(
    habits.map((h: any) => ({ ...h, ownerUid: uid, syncedAt: new Date() })),
    uid,
  );
}
export async function getCachedHabits(uid: string) {
  return await offlineDB.habits
    .where('ownerUid')
    .equals(uid)
    .reverse();
}
export async function cacheJournalEntries(uid: string, entries: any[]) {
  await offlineDB.journalEntries.bulkPut(
    entries.map((e: any) => ({ ...e, ownerUid: uid, syncedAt: new Date() })),
  );
}
export async function getCachedJournalEntries(
  uid: string,
  from?: string,
  to?: string,
) {
  let query = offlineDB.journalEntries.where('ownerUid').equals(uid);
  if (from) query = query.and((entry) => entry.entryDate >= from);
  if (to) query = query.and((entry) => entry.entryDate <= to);
  return await query.reverse();
}
export async function cacheHabitLogs(uid: string, logsByDate: Record<string, any[]>) {
  const entries = Object.entries(logsByDate).flatMap(([date, logs]) =>
    logs.map((l: any) => ({ ...l, ownerUid: uid, date })),
  );
  await offlineDB.habitLogs.bulkPut(entries);
}
export async function getCachedHabitLogs(uid: string, dates: string[]) {
  if (!dates?.length) return {};
  return await offlineDB.habitLogs
    .where('ownerUid')
    .equals(uid)
    .and((log) => dates.includes(log.date));
}

// --- Mutation Queue ---
export async function queueMutation(type: string, payload: any) {
  const id = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await offlineDB.pendingMutations.add({
    id,
    type,
    payload,
    timestamp: new Date(),
    retries: 0,
    status: 'pending',
  });
  return id;
}
export async function getPendingMutations() {
  return await offlineDB.pendingMutations
    .where('status')
    .equals('pending')
    .reverse();
}
export async function markProcessed(id: string) {
  await offlineDB.pendingMutations.update(id, { status: 'synced' });
}
export async function incrementRetries(id: string) {
  const mut = await offlineDB.pendingMutations.get(id);
  if (mut) {
    await offlineDB.pendingMutations.update(id, {
      retries: (mut.retries ?? 0) + 1,
    });
  }
}
export async function markFailed(id: string) {
  await offlineDB.pendingMutations.update(id, { status: 'failed' });
}

// --- Initialization ---
export async function initOnlineStatus() {
  isOnline = navigator.onLine;
  window.addEventListener('online', () => {
    isOnline = true;
    if (syncStatus === 'idle') {
      processQueue();
    }
  });
  window.addEventListener('offline', () => {
    isOnline = false;
  });
}

// --- Sync Engine with Mutex ---
let isSyncing = false;

export async function processQueue() {
  if (isSyncing || !isOnline) return;
  isSyncing = true;
  syncStatus = 'syncing';
  try {
    const mutations = await getPendingMutations();
    for (const mut of mutations) {
      try {
        await executeMutationIdempotent(mut);
        await markProcessed(mut.id);
        lastSynced = new Date();
      } catch (e) {
        const retries = (mut.retries ?? 0) + 1;
        if (retries >= 3) {
          await markFailed(mut.id);
        } else {
          await incrementRetries(mut.id);
        }
      }
    }
    syncStatus = 'idle';
    pendingCount = await offlineDB.pendingMutations.where('status').equals('pending').count();
  } finally {
    isSyncing = false;
    syncStatus = 'idle';
  }
}

async function executeMutationIdempotent(mut: any) {
  const { type, payload } = mut;
  // Execute based on mutation type - these will be called from
  // the firestore wrapper which handles the actual DB writes
  switch (type) {
    case 'upsertJournalEntry':
      // Will be handled by firestore.svelte.ts with clientUpdatedAt
      // For now, just mark as processed - the actual write is handled elsewhere
      break;
    case 'saveHabitLogsForDate':
    case 'saveHabitLogsForJournalEntry':
    case 'addHabit':
    case 'deleteHabit':
    case 'updateHabitOrder':
    case 'createPost':
    case 'updatePost':
    case 'deletePost':
    default:
      // Actual Firestore writes happen in firestore.svelte.ts
      // This queue just ensures retries and ordering
      break;
  }
}

// Export ID generators for use in mutations
export { newJournalEntryId, newHabitLogId, newHabitId, newBlogPostId };