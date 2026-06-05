import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a file to Firebase Storage and returns its public download URL.
 * @param file The file to upload.
 * @param folder The folder in Firebase Storage.
 */
export async function uploadImage(file: File, folder = 'blog-images'): Promise<string> {
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const storageRef = ref(storage, `${folder}/${filename}`);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
}

/**
 * Deletes a file from Firebase Storage using its download URL.
 * @param url The download URL of the file to delete.
 */
export async function deleteImage(url: string): Promise<void> {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
}

