import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage';
import app from './firebase';

let storageInstance: ReturnType<typeof getStorage> | null = null;
function getStorageInstance() {
	if (!storageInstance) storageInstance = getStorage(app);
	return storageInstance;
}

export async function uploadImage(file: File, folder = 'blog-images'): Promise<string> {
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const storageRef = ref(getStorageInstance(), `${folder}/${filename}`);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
}

export async function deleteImage(url: string): Promise<void> {
    const storageRef = ref(getStorageInstance(), url);
    await deleteObject(storageRef);
}

