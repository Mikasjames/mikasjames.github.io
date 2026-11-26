import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

export interface GenerateInsightsResult {
	ok: boolean;
	period?: string;
	generatedAt?: string;
	message?: string;
}

export async function callGenerateInsightsNow(period?: string): Promise<GenerateInsightsResult> {
	const callable = httpsCallable<{ period?: string }, GenerateInsightsResult>(
		getFunctions(app),
		'generateInsightsNow',
	);
	const result = await callable(period ? { period } : {});
	return result.data;
}
