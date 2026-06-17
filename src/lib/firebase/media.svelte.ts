import { getMediaItems, getRecentMediaItems, addMediaItem, deleteMediaItem, type MediaItem } from "./firestore.svelte";
import { uploadImage, deleteImage } from "./storage";
import { compressAndGetMeta } from "$lib/utils/imageMeta";

export function createMediaStore() {
	let mediaItems = $state<MediaItem[]>([]);
	let recentMediaItems = $state<MediaItem[]>([]);
	let mediaLoaded = $state(false);
	let mediaLoading = $state(false);
	let mediaUploading = $state(false);
	let mediaUploadError = $state("");
	let mediaLoadError = $state("");
	let deletingMediaIds = $state<Set<string>>(new Set());

	async function loadMediaItems() {
		mediaLoading = true;
		mediaLoadError = "";
		try {
			mediaItems = await getMediaItems();
			mediaLoaded = true;
		} catch (err) {
			console.error("Failed to load media items:", err);
			mediaLoadError =
				err instanceof Error
					? err.message
					: "Failed to load gallery items.";
		} finally {
			mediaLoading = false;
		}
	}

	async function loadRecentMedia() {
		try {
			recentMediaItems = await getRecentMediaItems(4);
		} catch (err) {
			console.error("Failed to load recent media:", err);
		}
	}

	async function openMediaGallery() {
		if (!mediaLoaded) {
			await loadMediaItems();
		}
		return true; // Used to trigger visibility in component if needed
	}

	async function handleGalleryUpload(file: File) {
		mediaUploading = true;
		mediaUploadError = "";
		try {
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "blog-content");
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			await loadMediaItems();
			await loadRecentMedia();
			return { url, width, height, name: compressedFile.name };
		} catch (err: unknown) {
			mediaUploadError =
				err instanceof Error ? err.message : "Upload failed.";
			throw err;
		} finally {
			mediaUploading = false;
		}
	}

	async function handleDeleteMedia(item: MediaItem, onDelete?: (url: string) => void) {
		if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
			return;
		}
		deletingMediaIds.add(item.id);
		deletingMediaIds = new Set(deletingMediaIds);
		try {
			await deleteImage(item.url);
			await deleteMediaItem(item.id);
			if (onDelete) onDelete(item.url);
			await loadMediaItems();
			await loadRecentMedia();
		} catch (err: unknown) {
			alert(
				err instanceof Error ? err.message : "Failed to delete image.",
			);
		} finally {
			deletingMediaIds.delete(item.id);
			deletingMediaIds = new Set(deletingMediaIds);
		}
	}

	return {
		get mediaItems() { return mediaItems; },
		get recentMediaItems() { return recentMediaItems; },
		get mediaLoaded() { return mediaLoaded; },
		set mediaLoaded(v) { mediaLoaded = v; },
		get mediaLoading() { return mediaLoading; },
		get mediaUploading() { return mediaUploading; },
		get mediaUploadError() { return mediaUploadError; },
		get mediaLoadError() { return mediaLoadError; },
		get deletingMediaIds() { return deletingMediaIds; },
		loadMediaItems,
		loadRecentMedia,
		openMediaGallery,
		handleGalleryUpload,
		handleDeleteMedia,
	};
}
