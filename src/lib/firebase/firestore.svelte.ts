import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    type DocumentData
} from 'firebase/firestore';
import { db } from './firebase';

export interface ImageMeta {
    width: number;
    height: number;
}

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string | null;
    imageMeta?: Record<string, ImageMeta>;
    createdAt: Date | null;
    status: 'draft' | 'published' | 'unlisted';
}

const COLLECTION = 'blogs';

export async function getPosts(): Promise<BlogPost[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToPost(d.id, d.data()));
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
    const posts = await getPosts();
    return posts.filter((p) => p.status === 'published');
}

export async function getPrerenderPosts(): Promise<BlogPost[]> {
    const posts = await getPosts();
    return posts.filter((p) => p.status === 'published' || p.status === 'unlisted');
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
    const snapshot = await getDocs(collection(db, COLLECTION));
    const match = snapshot.docs.find((d) => d.data().slug === slug);
    if (!match) return null;
    return docToPost(match.id, match.data());
}

export async function createPost(data: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string | null;
    status: 'draft' | 'published' | 'unlisted';
    imageMeta?: Record<string, ImageMeta>;
}): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp()
    });
    return ref.id;
}

export async function updatePost(
    id: string,
    data: {
        title: string;
        slug: string;
        excerpt: string;
        content: string;
        coverImage: string | null;
        status: 'draft' | 'published' | 'unlisted';
        imageMeta?: Record<string, ImageMeta>;
    }
): Promise<void> {
    const postRef = doc(db, COLLECTION, id);
    await updateDoc(postRef, data);
}

export async function deletePost(id: string): Promise<void> {
    const postRef = doc(db, COLLECTION, id);
    await deleteDoc(postRef);
}

function docToPost(id: string, data: DocumentData): BlogPost {
    return {
        id,
        title: data.title ?? '',
        slug: data.slug ?? '',
        excerpt: data.excerpt ?? '',
        content: data.content ?? '',
        coverImage: data.coverImage ?? null,
        imageMeta: data.imageMeta ?? {},
        createdAt: data.createdAt?.toDate?.() ?? null,
        status: data.status ?? 'published'
    };
}

export interface MediaItem {
    id: string;
    url: string;
    name: string;
    uploadedAt: Date | null;
    width?: number;
    height?: number;
}

const MEDIA_COLLECTION = 'media_gallery';

export async function getMediaItems(): Promise<MediaItem[]> {
    const q = query(collection(db, MEDIA_COLLECTION), orderBy('uploadedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToMediaItem(d.id, d.data()));
}

export async function addMediaItem(data: { url: string; name: string; width?: number; height?: number }): Promise<string> {
    const ref = await addDoc(collection(db, MEDIA_COLLECTION), {
        ...data,
        uploadedAt: serverTimestamp()
    });
    return ref.id;
}

export async function deleteMediaItem(id: string): Promise<void> {
    const mediaRef = doc(db, MEDIA_COLLECTION, id);
    await deleteDoc(mediaRef);
}

function docToMediaItem(id: string, data: DocumentData): MediaItem {
    return {
        id,
        url: data.url ?? '',
        name: data.name ?? '',
        uploadedAt: data.uploadedAt?.toDate?.() ?? null,
        width: data.width ?? undefined,
        height: data.height ?? undefined
    };
}

export interface JournalEntry {
    id: string;
    title: string;
    excerpt?: string;
    content: string;
    coverImage?: string | null;
    imageMeta?: Record<string, ImageMeta>;
    createdAt: Date | null;
    updatedAt: Date | null;
}

const JOURNAL_COLLECTION = 'journal';

export async function getJournalEntries(): Promise<JournalEntry[]> {
    const q = query(collection(db, JOURNAL_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToJournalEntry(d.id, d.data()));
}

export async function createJournalEntry(data: {
    title: string;
    excerpt?: string;
    content: string;
    coverImage?: string | null;
    imageMeta?: Record<string, ImageMeta>;
}): Promise<string> {
    const ref = await addDoc(collection(db, JOURNAL_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return ref.id;
}

export async function updateJournalEntry(
    id: string,
    data: {
        title: string;
        excerpt?: string;
        content: string;
        coverImage?: string | null;
        imageMeta?: Record<string, ImageMeta>;
    }
): Promise<void> {
    const entryRef = doc(db, JOURNAL_COLLECTION, id);
    await updateDoc(entryRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

export async function deleteJournalEntry(id: string): Promise<void> {
    const entryRef = doc(db, JOURNAL_COLLECTION, id);
    await deleteDoc(entryRef);
}

function docToJournalEntry(id: string, data: DocumentData): JournalEntry {
    return {
        id,
        title: data.title ?? '',
        excerpt: data.excerpt ?? '',
        content: data.content ?? '',
        coverImage: data.coverImage ?? null,
        imageMeta: data.imageMeta ?? {},
        createdAt: data.createdAt?.toDate?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.() ?? null
    };
}

