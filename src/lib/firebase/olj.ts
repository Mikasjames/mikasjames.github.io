import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

export interface OljLoginLog {
	id: string;
	date: string;
	status: 'success' | 'failed';
	pointsBalance: number | null;
	previousBalance: number | null;
	ranAt: Date | null;
	atCap: boolean;
	detail?: string | null;
	debug?: Record<string, unknown> | null;
}

let dbInstance: ReturnType<typeof getFirestore> | null = null;
function getDb() {
	if (!dbInstance) dbInstance = getFirestore(app);
	return dbInstance;
}

function docToOljLoginLog(id: string, data: Record<string, unknown>): OljLoginLog {
	return {
		id,
		date: typeof data.date === 'string' ? data.date : '',
		status: data.status === 'success' ? 'success' : 'failed',
		pointsBalance: typeof data.pointsBalance === 'number' ? data.pointsBalance : null,
		previousBalance: typeof data.previousBalance === 'number' ? data.previousBalance : null,
		ranAt: (data.ranAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? null,
		atCap: data.atCap === true,
		detail: typeof data.detail === 'string' ? data.detail : null,
		debug: (data.debug ?? null) as Record<string, unknown> | null,
	};
}

export async function getLatestOljLoginLog(): Promise<OljLoginLog | null> {
	const snapshot = await getDoc(doc(getDb(), 'oljLoginLogs', 'latest'));
	return snapshot.exists()
		? docToOljLoginLog(snapshot.id, snapshot.data())
		: null;
}

export type OljLoginNowResult = {
	ok: boolean;
	pointsBalance: number | null;
	detail: string;
	debug?: Record<string, unknown> | null;
};

export async function callOljLoginNow(): Promise<OljLoginNowResult> {
	const callable = httpsCallable<undefined, OljLoginNowResult>(getFunctions(app), 'oljLoginNow');
	const result = await callable();
	return result.data;
}
