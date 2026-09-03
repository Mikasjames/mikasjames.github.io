import { doc, collection } from 'firebase/firestore';
import { getDb } from '$lib/firebase/firebase';

// Firestore-compatible ID generators (client-side, synchronous, no network)
// These guarantee relational ID consistency when mutations are synced later
export function newHabitId(): string {
  return doc(collection(getDb(), 'habits')).id;
}
export function newJournalEntryId(): string {
  return doc(collection(getDb(), 'journal')).id;
}
export function newHabitLogId(): string {
  return doc(collection(getDb(), 'habitLogs')).id;
}
export function newBlogPostId(): string {
  return doc(collection(getDb(), 'blogs')).id;
}