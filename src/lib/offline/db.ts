import Dexie, { type EntityTable } from 'dexie';

export const offlineDB = new Dexie('MikasDashboardOffline');

offlineDB.version(1).stores({
  // Only index fields used in .where() queries or compound indexes
  habits: 'id, ownerUid, [ownerUid+order]',
  journalEntries: 'id, ownerUid, entryDate, [ownerUid+entryDate]',
  habitLogs: 'id, ownerUid, date, [ownerUid+date], [ownerUid+habitId+date]',
  pendingMutations: '++id, status, timestamp, type',
  // Note: Firebase Auth persists its own credentials to internal IndexedDB;
  // no separate 'auth' table needed here
});