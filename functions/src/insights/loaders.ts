import { db } from '../firebase.js';
import type { HabitInsightLog, JournalInsightEntry } from './types.js';

async function queryJournalEntries(
  ownerUid: string,
  startDateStr: string,
  endDateStr: string,
): Promise<JournalInsightEntry[]> {
  const snapshot = await db
    .collection('journal')
    .where('ownerUid', '==', ownerUid)
    .where('entryDate', '>=', startDateStr)
    .where('entryDate', '<', endDateStr)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const entryDate = data.entryDate;
      const rating = data.happinessRating;
      const uid = data.ownerUid;
      if (!entryDate || typeof rating !== 'number' || !uid) {
        console.warn(`Skipping journal entry ${doc.id}: missing required fields`);
        return null;
      }
      return { id: doc.id, uid, content: data.content || '', rating, entryDate };
    })
    .filter((entry): entry is JournalInsightEntry => entry !== null);
}

export async function loadJournalEntries(
  start: Date,
  end: Date,
  ownerUid: string,
): Promise<JournalInsightEntry[]> {
  return queryJournalEntries(
    ownerUid,
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  );
}

export async function loadYearEntries(
  uid: string,
  year: number,
): Promise<JournalInsightEntry[]> {
  return queryJournalEntries(uid, `${year}-01-01`, `${year + 1}-01-01`);
}

export async function loadHabitLogs(
  start: Date,
  end: Date,
  ownerUid: string,
): Promise<HabitInsightLog[]> {
  // Compare against the YYYY-MM-DD `date` field rather than completedAt
  const startDateStr = start.toISOString().slice(0, 10);
  const endDateStr = end.toISOString().slice(0, 10);

  console.log(`Loading habit logs for ${ownerUid} from ${startDateStr} to ${endDateStr}`);

  const snapshot = await db
    .collection('habitLogs')
    .where('ownerUid', '==', ownerUid)
    .where('date', '>=', startDateStr)
    .where('date', '<', endDateStr)
    .get();

  const logs = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      if (!data.habitId || !data.habitName || !data.date) {
        console.warn(`Skipping habit log ${doc.id}: missing required fields`);
        return null;
      }
      return {
        habitId: data.habitId,
        habitName: data.habitName,
        date: data.date,
      };
    })
    .filter((log): log is HabitInsightLog => log !== null);

  console.log(`Found ${logs.length} habit logs for period`);
  return logs;
}
