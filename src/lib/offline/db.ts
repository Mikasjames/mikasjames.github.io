import Dexie, { type EntityTable } from 'dexie';

// Lazy initialization to avoid SSR issues (IndexedDB not available in Node.js)
let offlineDBInstance: Dexie | null = null;

export function getOfflineDB(): Dexie {
  if (!offlineDBInstance) {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not available');
    }
    offlineDBInstance = new Dexie('MikasDashboardOffline');
    offlineDBInstance.version(1).stores({
      habits: 'id, ownerUid, [ownerUid+order]',
      journalEntries: 'id, ownerUid, entryDate, [ownerUid+entryDate]',
      habitLogs: 'id, ownerUid, date, [ownerUid+date], [ownerUid+habitId+date]',
      pendingMutations: '++id, status, timestamp, type',
    });
  }
  return offlineDBInstance;
}

// For backwards compatibility - will throw in SSR
export const offlineDB = {
  get habits() { return getOfflineDB().table('habits'); },
  get journalEntries() { return getOfflineDB().table('journalEntries'); },
  get habitLogs() { return getOfflineDB().table('habitLogs'); },
  get pendingMutations() { return getOfflineDB().table('pendingMutations'); },
  version(version: number) {
    return getOfflineDB().version(version);
  },
  on(event: string, callback: Function) {
    return getOfflineDB().on(event, callback);
  },
};