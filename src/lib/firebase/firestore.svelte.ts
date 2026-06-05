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

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string | null;
    createdAt: Date | null;
}

const COLLECTION = 'blogs';

export async function getPosts(): Promise<BlogPost[]> {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToPost(d.id, d.data()));
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
        createdAt: data.createdAt?.toDate?.() ?? null
    };
}
