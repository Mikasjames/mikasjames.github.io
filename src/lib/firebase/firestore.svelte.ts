import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    type DocumentData
} from 'firebase/firestore';
import { db } from './firebase';

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
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
}): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp()
    });
    return ref.id;
}

function docToPost(id: string, data: DocumentData): BlogPost {
    return {
        id,
        title: data.title ?? '',
        slug: data.slug ?? '',
        excerpt: data.excerpt ?? '',
        content: data.content ?? '',
        createdAt: data.createdAt?.toDate?.() ?? null
    };
}
