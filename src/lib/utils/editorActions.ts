import { tick } from "svelte";
import type { ImageMeta, MediaItem } from "$lib/firebase/firestore.svelte";
import type { createMediaStore } from "$lib/firebase/media.svelte";
import { toast } from "$lib/stores/toast.svelte";

type MediaStore = ReturnType<typeof createMediaStore>;

interface EditorForm {
	content: string;
	imageMeta: Record<string, ImageMeta>;
	coverImage: string | null;
}

interface DeleteMediaCallbacks {
	onBeforeConfirm: (message: string) => Promise<boolean>;
	onError: (message: string) => void;
	onRemoveImage: (url: string) => void;
	onRemoveMarkdown: (url: string) => void;
}

export async function insertMarkdownAtCursor(
	url: string,
	altText: string,
	textareaRef: HTMLTextAreaElement | null,
	setActiveTab: (tab: "write" | "preview") => void,
	dims: { width?: number; height?: number } | undefined,
	getForm: () => EditorForm,
	setForm: (patch: Partial<EditorForm>) => void,
) {
	setActiveTab("write");
	await tick();
	if (!textareaRef) return;

	if (dims?.width && dims?.height) {
		const form = getForm();
		setForm({
			imageMeta: { ...form.imageMeta, [url]: { width: dims.width, height: dims.height } },
		});
	}

	const start = textareaRef.selectionStart;
	const end = textareaRef.selectionEnd;
	const text = getForm().content;

	const before = text.substring(0, start);
	const after = text.substring(end, text.length);
	const tag = `![${altText}](${url})`;
	const newValue = before + tag + after;

	textareaRef.value = newValue;
	setForm({ content: newValue });

	textareaRef.focus();
	textareaRef.selectionStart = textareaRef.selectionEnd = start + tag.length;

	await tick();

	if (textareaRef) {
		textareaRef.focus();
		textareaRef.selectionStart = textareaRef.selectionEnd = start + tag.length;
	}

	toast("Image inserted into editor", "success");
}

export async function handleContentUpload(
	e: Event,
	mediaStore: MediaStore,
	getForm: () => EditorForm,
	setForm: (patch: Partial<EditorForm>) => void,
	insertFn: (url: string, altText: string, dims?: { width?: number; height?: number }) => Promise<void>,
) {
	const target = e.target as HTMLInputElement;
	if (!target.files || target.files.length === 0) return;
	const file = target.files[0];
	try {
		const { url, width, height, name } = await mediaStore.handleGalleryUpload(file);
		const form = getForm();
		setForm({ imageMeta: { ...form.imageMeta, [url]: { width, height } } });
		await insertFn(url, name.split(".")[0], { width, height });
	} catch (_err: unknown) {
		// Content upload error handled by store
	} finally {
		target.value = "";
	}
}

export function copyToClipboard(text: string) {
	navigator.clipboard.writeText(text).then(() => {
		toast("Copied markdown image tag to clipboard!", "success");
	});
}

export function setEditorCoverImage(url: string | null, setCoverImage: (url: string | null) => void) {
	setCoverImage(url);
}

export async function handleDeleteMediaWrapper(
	item: MediaItem,
	mediaStore: MediaStore,
	callbacks: DeleteMediaCallbacks,
) {
	await mediaStore.handleDeleteMedia(
		item,
		(url: string) => {
			callbacks.onRemoveImage(url);
			callbacks.onRemoveMarkdown(url);
		},
		callbacks.onBeforeConfirm,
		callbacks.onError,
	);
}
