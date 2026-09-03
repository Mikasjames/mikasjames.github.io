import { getOfflineDB } from './db';
import { newJournalEntryId, newHabitLogId, newHabitId, newBlogPostId } from './ids';

function db() { return getOfflineDB(); }

// --- State (wrapped in object to allow mutation) ---
const offlineState = {
    isOnline: true,
    syncStatus: 'idle' as 'idle' | 'syncing' | 'error',
    lastSynced: null as Date | null,
    pendingCount: 0,
};

// --- Reactive getters/setters ---
export function getIsOnline() { return offlineState.isOnline; }
export function setIsOnline(v: boolean) { offlineState.isOnline = v; }
// Alias for backwards compatibility
export const isOnline = { get: getIsOnline, set: setIsOnline };
export function getSyncStatus() { return offlineState.syncStatus; }
export function setSyncStatus(v: 'idle' | 'syncing' | 'error') { offlineState.syncStatus = v; }
export function getLastSynced() { return offlineState.lastSynced; }
export function setLastSynced(v: Date | null) { offlineState.lastSynced = v; }
export function getPendingCount() { return offlineState.pendingCount; }
export function setPendingCount(v: number) { offlineState.pendingCount = v; }

// --- Cache getters/setters ---
export async function cacheHabits(uid: string, habits: any[]) {
  if (!isBrowser()) return;
  await db().habits.bulkPut(
    habits.map((h: any) => ({ ...h, ownerUid: uid, syncedAt: new Date() })),
    uid,
  );
}
export async function getCachedHabits(uid: string) {
  if (!isBrowser()) return [];
  return await db().habits
    .where('ownerUid')
    .equals(uid)
    .reverse();
}
export async function cacheJournalEntries(uid: string, entries: any[]) {
  if (!isBrowser()) return;
  await db().journalEntries.bulkPut(
    entries.map((e: any) => ({ ...e, ownerUid: uid, syncedAt: new Date() })),
  );
}
export async function getCachedJournalEntries(
  uid: string,
  from?: string,
  to?: string,
) {
  if (!isBrowser()) return [];
  let query = db().journalEntries.where('ownerUid').equals(uid);
  if (from) query = query.and((entry) => entry.entryDate >= from);
  if (to) query = query.and((entry) => entry.entryDate <= to);
  return await query.reverse();
}
export async function cacheHabitLogs(uid: string, logsByDate: Record<string, any[]>) {
  if (!isBrowser()) return;
  const entries = Object.entries(logsByDate).flatMap(([date, logs]) =>
    logs.map((l: any) => ({ ...l, ownerUid: uid, date })),
  );
  await db().habitLogs.bulkPut(entries);
}
export async function getCachedHabitLogs(uid: string, dates: string[]) {
  if (!isBrowser()) return {};
  if (!dates?.length) return {};
  return await db().habitLogs
    .where('ownerUid')
    .equals(uid)
    .and((log) => dates.includes(log.date));
}

// --- Mutation Queue ---
export async function queueMutation(type: string, payload: any) {
  if (!isBrowser()) return '';
  const id = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db().pendingMutations.add({
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
  if (!isBrowser()) return [];
  return await db().pendingMutations
    .where('status')
    .equals('pending')
    .reverse();
}
export async function markProcessed(id: string) {
  if (!isBrowser()) return;
  await db().pendingMutations.update(id, { status: 'synced' });
}
export async function incrementRetries(id: string) {
  if (!isBrowser()) return;
  const mut = await db().pendingMutations.get(id);
  if (mut) {
    await db().pendingMutations.update(id, {
      retries: (mut.retries ?? 0) + 1,
    });
  }
}
export async function markFailed(id: string) {
  if (!isBrowser()) return;
  await db().pendingMutations.update(id, { status: 'failed' });
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

// --- Initialization ---
export async function initOnlineStatus() {
  if (!isBrowser()) return;
  setIsOnline(navigator.onLine);
  window.addEventListener('online', () => {
    setIsOnline(true);
    if (getSyncStatus() === 'idle') {
      processQueue();
    }
  });
  window.addEventListener('offline', () => {
    setIsOnline(false);
  });
}

// --- Sync Engine with Mutex ---
let isSyncing = false;

export async function processQueue() {
  if (!isBrowser()) return;
  if (isSyncing || !getIsOnline()) return;
  isSyncing = true;
  setSyncStatus('syncing');
  try {
    const mutations = await getPendingMutations();
    for (const mut of mutations) {
      try {
        await executeMutationIdempotent(mut);
        await markProcessed(mut.id);
        setLastSynced(new Date());
      } catch (e) {
        const retries = (mut.retries ?? 0) + 1;
        if (retries >= 3) {
          await markFailed(mut.id);
        } else {
          await incrementRetries(mut.id);
        }
      }
    }
    setSyncStatus('idle');
    setPendingCount(await db().pendingMutations.where('status').equals('pending').count());
  } finally {
    isSyncing = false;
    setSyncStatus('idle');
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