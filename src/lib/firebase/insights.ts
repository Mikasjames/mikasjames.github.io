import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

export interface GenerateInsightsResult {
	ok: boolean;
	period?: string;
	generatedAt?: string;
	message?: string;
}

export async function callGenerateInsightsNow(): Promise<GenerateInsightsResult> {
	const callable = httpsCallable<undefined, GenerateInsightsResult>(getFunctions(app), 'generateInsightsNow');
	const result = await callable();
	return result.data;
}