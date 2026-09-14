import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('firebase/storage', () => ({
	ref: vi.fn(),
	uploadBytes: vi.fn(),
	getDownloadURL: vi.fn(),
	deleteObject: vi.fn(),
	getStorage: vi.fn().mockReturnValue({}),
}));

vi.mock('firebase/app', () => ({
	getApps: vi.fn().mockReturnValue([]),
	initializeApp: vi.fn(),
}));

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { uploadImage, deleteImage } from './storage';

const mockRef = vi.mocked(ref);
const mockUploadBytes = vi.mocked(uploadBytes);
const mockGetDownloadURL = vi.mocked(getDownloadURL);
const mockDeleteObject = vi.mocked(deleteObject);

describe('storage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('uploadImage', () => {
		it('uploads file and returns download URL', async () => {
			const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
			const mockUrl = 'https://storage.example.com/test.png';
			const mockSnapshot = { ref: 'storage-ref' };

			mockRef.mockReturnValue('storage-ref' as never);
			mockUploadBytes.mockResolvedValue(mockSnapshot as never);
			mockGetDownloadURL.mockResolvedValue(mockUrl);

			const result = await uploadImage(mockFile);

			expect(mockRef).toHaveBeenCalled();
			expect(mockUploadBytes).toHaveBeenCalledWith('storage-ref', mockFile);
			expect(mockGetDownloadURL).toHaveBeenCalledWith('storage-ref');
			expect(result).toBe(mockUrl);
		});

		it('uses custom folder', async () => {
			const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
			mockRef.mockReturnValue('storage-ref' as never);
			mockUploadBytes.mockResolvedValue({ ref: 'storage-ref' } as never);
			mockGetDownloadURL.mockResolvedValue('url');

			await uploadImage(mockFile, 'custom-folder');

			expect(mockRef).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining('custom-folder/'),
			);
		});

		it('sanitizes filename spaces', async () => {
			const mockFile = new File(['test'], 'my file name.png', { type: 'image/png' });
			mockRef.mockReturnValue('storage-ref' as never);
			mockUploadBytes.mockResolvedValue({ ref: 'storage-ref' } as never);
			mockGetDownloadURL.mockResolvedValue('url');

			await uploadImage(mockFile);

			expect(mockRef).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringMatching(/my-file-name\.png$/),
			);
		});
	});

	describe('deleteImage', () => {
		it('deletes image at given URL', async () => {
			const mockStorageRef = 'storage-ref';
			mockRef.mockReturnValue(mockStorageRef as never);
			mockDeleteObject.mockResolvedValue(undefined);

			await deleteImage('https://storage.example.com/image.png');

			expect(mockRef).toHaveBeenCalled();
			expect(mockDeleteObject).toHaveBeenCalledWith(mockStorageRef);
		});
	});
});
