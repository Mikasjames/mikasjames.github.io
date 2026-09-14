import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
	doc: vi.fn(),
	getDoc: vi.fn(),
	getFirestore: vi.fn().mockReturnValue({}),
}));

vi.mock('firebase/functions', () => ({
	getFunctions: vi.fn().mockReturnValue({}),
	httpsCallable: vi.fn(),
}));

vi.mock('firebase/app', () => ({
	getApps: vi.fn().mockReturnValue([]),
	initializeApp: vi.fn(),
}));

import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getLatestOljLoginLog, callOljLoginNow } from './olj';

const mockDoc = vi.mocked(doc);
const mockGetDoc = vi.mocked(getDoc);
const mockHttpsCallable = vi.mocked(httpsCallable);

describe('olj', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getLatestOljLoginLog', () => {
		it('returns log when document exists', async () => {
			const mockData = {
				date: '2026-01-15',
				status: 'success',
				pointsBalance: 1250,
				previousBalance: 1000,
				ranAt: { toDate: () => new Date('2026-01-15') },
				atCap: false,
			};
			mockDoc.mockReturnValue('doc-ref' as never);
			mockGetDoc.mockResolvedValue({
				exists: () => true,
				id: 'latest',
				data: () => mockData,
			} as never);

			const result = await getLatestOljLoginLog();

			expect(result).not.toBeNull();
			expect(result?.id).toBe('latest');
			expect(result?.date).toBe('2026-01-15');
			expect(result?.status).toBe('success');
			expect(result?.pointsBalance).toBe(1250);
			expect(result?.previousBalance).toBe(1000);
			expect(result?.atCap).toBe(false);
		});

		it('returns null when document does not exist', async () => {
			mockDoc.mockReturnValue('doc-ref' as never);
			mockGetDoc.mockResolvedValue({
				exists: () => false,
			} as never);

			const result = await getLatestOljLoginLog();
			expect(result).toBeNull();
		});

		it('handles missing fields gracefully', async () => {
			mockDoc.mockReturnValue('doc-ref' as never);
			mockGetDoc.mockResolvedValue({
				exists: () => true,
				id: 'latest',
				data: () => ({ date: '2026-01-15' }),
			} as never);

			const result = await getLatestOljLoginLog();
			expect(result?.status).toBe('failed');
			expect(result?.pointsBalance).toBeNull();
			expect(result?.previousBalance).toBeNull();
			expect(result?.atCap).toBe(false);
		});
	});

	describe('callOljLoginNow', () => {
		it('calls cloud function and returns result', async () => {
			const mockResult = {
				ok: true,
				pointsBalance: 1250,
				detail: 'Authenticated',
				debug: null,
			};
			const callableFn = vi.fn().mockResolvedValue({ data: mockResult });
			mockHttpsCallable.mockReturnValue(callableFn as never);

			const result = await callOljLoginNow();

			expect(mockHttpsCallable).toHaveBeenCalled();
			expect(callableFn).toHaveBeenCalled();
			expect(result.ok).toBe(true);
			expect(result.pointsBalance).toBe(1250);
			expect(result.detail).toBe('Authenticated');
		});

		it('propagates errors from cloud function', async () => {
			const callableFn = vi.fn().mockRejectedValue(new Error('Function failed'));
			mockHttpsCallable.mockReturnValue(callableFn as never);

			await expect(callOljLoginNow()).rejects.toThrow('Function failed');
		});
	});
});
