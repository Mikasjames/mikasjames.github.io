<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { goto } from "$app/navigation";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		createPost,
		getPosts,
		updatePost,
		deletePost,
		getMediaItems,
		addMediaItem,
		deleteMediaItem,
		type BlogPost,
		type ImageMeta,
		type MediaItem,
	} from "$lib/firebase/firestore.svelte";
import {
	extractImageUrlsFromMarkdown,
	sanitizeImageMetaFromMarkdown,
	removeImageReferencesFromMarkdown,
} from "$lib/utils/imageMeta";
	import { uploadImage, deleteImage } from "$lib/firebase/storage";
	import { marked } from "marked";
	import type { User } from "firebase/auth";
	import imageCompression from 'browser-image-compression';

	let user = $state<User | null>(null);
	let authReady = $state(false);

	const unsub = subscribeToAuth((u) => {
		user = u;
		authReady = true;
		if (!u) goto("/admin/login/");
	});
	onDestroy(unsub);

	let posts = $state<BlogPost[]>([]);
	let postsLoading = $state(false);

	let title = $state("");
	let slug = $state("");
	let excerpt = $state("");
	let content = $state("");
	let coverImage = $state<string | null>(null);
	let imageMeta = $state<Record<string, ImageMeta>>({});
	let slugManuallyEdited = $state(false);

	let editingPostId = $state<string | null>(null);

	let submitting = $state(false);
	let successMsg = $state("");
	let formError = $state("");

	let coverUploading = $state(false);
	let coverError = $state("");

	let contentUploading = $state(false);
	let contentUploadError = $state("");

	let activeTab = $state<"write" | "preview">("write");
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	let showMediaGallery = $state(false);
	let mediaItems = $state<MediaItem[]>([]);
	let mediaLoading = $state(false);
	let mediaUploading = $state(false);
	let mediaUploadError = $state("");
	let mediaLoadError = $state("");
	let deletingMediaIds = $state<Set<string>>(new Set());

	$effect(() => {
		if (!slugManuallyEdited && !editingPostId) {
			slug = title
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-");
		}
	});

	function onSlugInput(e: Event) {
		slug = (e.target as HTMLInputElement).value;
		slugManuallyEdited = true;
	}

	async function loadPosts() {
		postsLoading = true;
		try {
			posts = await getPosts();
		} finally {
			postsLoading = false;
		}
	}

	onMount(async () => {
		await new Promise<void>((res) => {
			const check = setInterval(() => {
				if (authReady) {
					clearInterval(check);
					res();
				}
			}, 50);
		});
		if (user) {
			await loadPosts();
			await loadMediaItems();
		}
	});

	async function handlePublish(e: Event) {
		e.preventDefault();
		if (!title || !slug || !excerpt || !content) {
			formError = "All fields are required.";
			return;
		}

		const sanitizedMeta = sanitizeImageMetaFromMarkdown(content, imageMeta);
		const postPayload = {
			title,
			slug,
			excerpt,
			content,
			coverImage,
			imageMeta: sanitizedMeta,
		};

		submitting = true;
		formError = "";
		successMsg = "";
		try {
			if (editingPostId) {
				await updatePost(editingPostId, postPayload);
				successMsg = `"${title}" updated successfully!`;
			} else {
				await createPost(postPayload);
				successMsg = `"${title}" published successfully!`;
			}
			resetForm();
			await loadPosts();
		} catch (err: unknown) {
			formError =
				err instanceof Error ? err.message : "Failed to save post.";
		} finally {
			submitting = false;
		}
	}

	function enrichImageMetaFromGallery(
		markdown: string,
		currentImageMeta: Record<string, ImageMeta>,
	): Record<string, ImageMeta> {
		const urls = extractImageUrlsFromMarkdown(markdown);
		return urls.reduce((acc, url) => {
			if (currentImageMeta[url]) {
				acc[url] = currentImageMeta[url];
				return acc;
			}

			const media = mediaItems.find((item) => item.url === url);
			if (media?.width && media?.height) {
				acc[url] = {
					width: media.width,
					height: media.height,
				};
			}
			return acc;
		}, {} as Record<string, ImageMeta>);
	}

	function startEdit(post: BlogPost) {
		editingPostId = post.id;
		title = post.title;
		slug = post.slug;
		excerpt = post.excerpt;
		content = post.content;
		coverImage = post.coverImage;
		imageMeta = enrichImageMetaFromGallery(post.content, post.imageMeta ?? {});
		slugManuallyEdited = true;
		successMsg = "";
		formError = "";
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function resetForm() {
		editingPostId = null;
		title = "";
		slug = "";
		excerpt = "";
		content = "";
		coverImage = null;
		imageMeta = {};
		slugManuallyEdited = false;
	}

	async function compressAndGetMeta(file: File) {
		const options = {
			maxWidthOrHeight: 1200,
			useWebWorker: true,
			fileType: 'image/webp',
			initialQuality: 0.78
		} as any;

		const compressedBlob = await imageCompression(file, options);
		const compressedFile =
			compressedBlob instanceof File
				? compressedBlob
				: new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '') + '.webp', {
					  type: 'image/webp'
				  });

		const url = URL.createObjectURL(compressedFile);
		const img = new Image();
		img.src = url;
		await new Promise<void>((res, rej) => {
			img.onload = () => res();
			img.onerror = (e) => rej(e);
		});
		const width = img.naturalWidth;
		const height = img.naturalHeight;
		URL.revokeObjectURL(url);
		return { compressedFile, width, height };
	}

	async function handleDelete(post: BlogPost) {
		if (!confirm(`Are you sure you want to delete "${post.title}"?`)) {
			return;
		}
		try {
			await deletePost(post.id);
			if (editingPostId === post.id) {
				resetForm();
			}
			await loadPosts();
		} catch (err: unknown) {
			alert(
				err instanceof Error ? err.message : "Failed to delete post.",
			);
		}
	}

	async function handleCoverUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		coverUploading = true;
		coverError = "";
		try {
			const { compressedFile, width, height } = await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "cover-images");
			coverImage = url;
			await addMediaItem({ url, name: compressedFile.name, width, height });
			if (showMediaGallery) {
				await loadMediaItems();
			}
		} catch (err: unknown) {
			coverError = err instanceof Error ? err.message : "Upload failed.";
		} finally {
			coverUploading = false;
			target.value = "";
		}
	}

	async function handleContentUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		contentUploading = true;
		contentUploadError = "";
		try {
			const { compressedFile, width, height } = await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "blog-content");
			await addMediaItem({ url, name: compressedFile.name, width, height });
			imageMeta = {
				...imageMeta,
				[url]: { width, height },
			};
			await loadMediaItems();
			insertMarkdownAtCursor(url, file.name.split(".")[0]);
		} catch (err: unknown) {
			contentUploadError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			contentUploading = false;
			target.value = "";
		}
	}

	function insertMarkdownAtCursor(url: string, altText: string) {
		activeTab = "write";
		setTimeout(() => {
			if (!textareaRef) return;
			const start = textareaRef.selectionStart;
			const end = textareaRef.selectionEnd;
			const text = textareaRef.value;
			const before = text.substring(0, start);
			const after = text.substring(end, text.length);
			const tag = `![${altText}](${url})`;
			content = before + tag + after;

			setTimeout(() => {
				if (textareaRef) {
					textareaRef.focus();
					textareaRef.selectionStart = textareaRef.selectionEnd =
						start + tag.length;
				}
			}, 50);
		}, 50);
	}

	type FormatAction =
		| { kind: "wrap"; before: string; after: string; placeholder: string }
		| { kind: "prefix"; prefix: string; placeholder: string }
		| { kind: "block"; before: string; after: string; placeholder: string };

	function applyFormat(action: FormatAction) {
		activeTab = "write";
		setTimeout(() => {
			if (!textareaRef) return;
			const start = textareaRef.selectionStart;
			const end = textareaRef.selectionEnd;
			const selected = textareaRef.value.substring(start, end);
			const before = textareaRef.value.substring(0, start);
			const after = textareaRef.value.substring(end);

			let replacement: string;
			let cursorStart: number;
			let cursorEnd: number;

			if (action.kind === "wrap") {
				const text = selected || action.placeholder;
				replacement = `${action.before}${text}${action.after}`;
				cursorStart = start + action.before.length;
				cursorEnd = cursorStart + text.length;
			} else if (action.kind === "prefix") {
				const lines = (selected || action.placeholder).split("\n");
				const prefixed = lines
					.map((l) => `${action.prefix}${l}`)
					.join("\n");
				replacement = prefixed;
				cursorStart = start;
				cursorEnd = start + prefixed.length;
			} else {
				const text = selected || action.placeholder;
				replacement = `${action.before}${text}${action.after}`;
				cursorStart = start + action.before.length;
				cursorEnd = cursorStart + text.length;
			}

			content = before + replacement + after;

			setTimeout(() => {
				if (textareaRef) {
					textareaRef.focus();
					textareaRef.selectionStart = cursorStart;
					textareaRef.selectionEnd = cursorEnd;
				}
			}, 50);
		}, 50);
	}

	async function loadMediaItems() {
		mediaLoading = true;
		mediaLoadError = "";
		try {
			mediaItems = await getMediaItems();
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

	async function openMediaGallery() {
		showMediaGallery = true;
		await loadMediaItems();
	}

	async function handleGalleryUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		mediaUploading = true;
		mediaUploadError = "";
		try {
			const { compressedFile, width, height } = await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "blog-content");
			await addMediaItem({ url, name: compressedFile.name, width, height });
			await loadMediaItems();
		} catch (err: unknown) {
			mediaUploadError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			mediaUploading = false;
			target.value = "";
		}
	}

	async function handleDeleteMedia(item: MediaItem) {
		if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
			return;
		}
		deletingMediaIds.add(item.id);
		deletingMediaIds = new Set(deletingMediaIds);
		try {
			await deleteImage(item.url);
			await deleteMediaItem(item.id);
			imageMeta = { ...imageMeta };
			delete imageMeta[item.url];
			content = removeImageReferencesFromMarkdown(content, item.url);
			await loadMediaItems();
		} catch (err: unknown) {
			alert(
				err instanceof Error ? err.message : "Failed to delete image.",
			);
		} finally {
			deletingMediaIds.delete(item.id);
			deletingMediaIds = new Set(deletingMediaIds);
		}
	}

	function renderMarkdown(md: string): string {
		if (!md) return "";
		return marked.parse(md, { async: false }) as string;
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			alert("Copied markdown image tag to clipboard!");
		});
	}

	async function handleLogout() {
		await logout();
		goto("/admin/login/");
	}

	function formatDate(d: Date | null) {
		if (!d) return "—";
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
</script>

<svelte:head>
	<title>Admin Dashboard · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !authReady}
	<div class="min-h-screen bg-[#09090b] flex items-center justify-center">
		<div
			class="w-6 h-6 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin"
		></div>
	</div>
{:else if user}
	<div class="min-h-screen bg-[#09090b] pt-20 pb-16 px-4">
		<div
			class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
		></div>

		<div class="relative mx-auto max-w-4xl space-y-10">
			<div class="flex items-center justify-between">
				<div>
					<p
						class="font-mono text-xs text-accent-400 tracking-widest uppercase mb-1"
					>
						&gt;_ admin
					</p>
					<h1 class="text-2xl font-bold text-zinc-100">Dashboard</h1>
					<p class="text-sm text-zinc-500 mt-0.5">
						Signed in as <span class="text-zinc-300"
							>{user.email}</span
						>
					</p>
				</div>
				<div class="flex gap-3">
					<a
						href="/blogs/"
						class="px-4 py-2 rounded-lg border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-sm font-medium transition-all duration-200"
					>
						View Blog
					</a>
					<button
						id="admin-logout-btn"
						onclick={handleLogout}
						class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-all duration-200"
					>
						Sign Out
					</button>
				</div>
			</div>

			<section
				class="bg-surface-900/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/40"
			>
				<h2
					class="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2"
				>
					{#if editingPostId}
						<svg
							class="w-4 h-4 text-accent-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
							/>
						</svg>
						Edit Post
					{:else}
						<svg
							class="w-4 h-4 text-accent-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						New Post
					{/if}
				</h2>

				<form
					id="publish-form"
					onsubmit={handlePublish}
					class="space-y-5"
				>
					<div class="grid md:grid-cols-2 gap-5">
						<div class="space-y-1.5">
							<label
								for="post-title"
								class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
								>Title</label
							>
							<input
								id="post-title"
								type="text"
								bind:value={title}
								required
								placeholder="My Awesome Post"
								class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
							/>
						</div>

						<div class="space-y-1.5">
							<label
								for="post-slug"
								class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
							>
								Slug
								<span
									class="ml-1 text-zinc-600 normal-case font-normal"
									>(auto-generated)</span
								>
							</label>
							<input
								id="post-slug"
								type="text"
								value={slug}
								oninput={onSlugInput}
								required
								placeholder="my-awesome-post"
								class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 font-mono focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
							/>
						</div>
					</div>

					<div
						class="space-y-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60"
					>
						<span
							class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
							>Cover Image</span
						>

						<div class="grid md:grid-cols-2 gap-4 items-start">
							<div class="space-y-2">
								<label
									for="cover-image-url"
									class="block text-xs text-zinc-500"
									>Cover Image URL</label
								>
								<input
									id="cover-image-url"
									type="text"
									bind:value={coverImage}
									placeholder="https://example.com/image.jpg"
									class="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
								/>

								<div class="flex items-center gap-2">
									<label
										class="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-medium cursor-pointer transition-colors border border-zinc-700/50 flex items-center gap-1.5"
									>
										<svg
											class="w-3.5 h-3.5 text-accent-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
											/>
										</svg>
										Upload File
										<input
											type="file"
											accept="image/*"
											onchange={handleCoverUpload}
											class="hidden"
										/>
									</label>

									{#if coverUploading}
										<div
											class="flex items-center gap-1 text-xs text-zinc-500"
										>
											<div
												class="w-3 h-3 border border-zinc-700 border-t-accent-400 rounded-full animate-spin"
											></div>
											Uploading...
										</div>
									{/if}

									{#if coverImage}
										<button
											type="button"
											onclick={() => (coverImage = null)}
											class="px-2 py-1.5 rounded hover:bg-red-500/10 text-red-400 text-xs font-medium transition-colors"
										>
											Remove Cover
										</button>
									{/if}
								</div>
								{#if coverError}
									<p class="text-xs text-red-400 mt-1">
										{coverError}
									</p>
								{/if}
							</div>

							<div
								class="flex items-center justify-center border border-zinc-800/80 rounded-lg bg-zinc-950 p-2 min-h-[100px]"
							>
								{#if coverImage}
									<img
										src={coverImage}
										alt="Cover Preview"
										class="max-h-[120px] rounded object-cover aspect-video shadow border border-zinc-800"
										onerror={(e) => {
											(
												e.target as HTMLImageElement
											).style.display = "none";
										}}
									/>
								{:else}
									<span class="text-xs text-zinc-600"
										>No cover image preview</span
									>
								{/if}
							</div>
						</div>
					</div>

					<div class="space-y-1.5">
						<label
							for="post-excerpt"
							class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
							>Excerpt</label
						>
						<textarea
							id="post-excerpt"
							bind:value={excerpt}
							required
							rows="2"
							placeholder="A short summary shown in the blog listing…"
							class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 resize-none focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
						></textarea>
					</div>

					<div class="space-y-2">
						<div
							class="flex items-center justify-between border-b border-zinc-800/80 pb-2"
						>
							<label
								for="post-content"
								class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
							>
								Content
							</label>
							<div class="flex items-center gap-3">
								<button
									type="button"
									onclick={openMediaGallery}
									class="px-2.5 py-1 text-xs font-medium text-accent-400 hover:text-accent-300 hover:bg-accent-500/10 rounded-md border border-accent-500/20 transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									Media Gallery
								</button>
								<div
									class="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-100"
								>
									<button
										type="button"
										onclick={() => (activeTab = "write")}
										class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-all duration-150 {activeTab ===
										'write'
											? 'bg-zinc-800 text-zinc-100 shadow-sm'
											: 'text-zinc-500 hover:text-zinc-305'}"
									>
										Write
									</button>
									<button
										type="button"
										onclick={() => (activeTab = "preview")}
										class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-all duration-150 {activeTab ===
										'preview'
											? 'bg-zinc-800 text-zinc-100 shadow-sm'
											: 'text-zinc-500 hover:text-zinc-305'}"
									>
										Preview
									</button>
								</div>
							</div>
						</div>

						{#if activeTab === "write"}
							<div
								class="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-zinc-950 border border-zinc-800 border-b-0 rounded-t-lg"
								role="toolbar"
								aria-label="Markdown formatting toolbar"
							>
								<button
									type="button"
									title="Bold"
									onclick={() =>
										applyFormat({
											kind: "wrap",
											before: "**",
											after: "**",
											placeholder: "bold text",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M13.5 15.5H10V12.5H13.5C14.33 12.5 15 13.17 15 14C15 14.83 14.33 15.5 13.5 15.5ZM10 6.5H13C13.83 6.5 14.5 7.17 14.5 8C14.5 8.83 13.83 9.5 13 9.5H10V6.5ZM15.6 11.29C16.57 10.61 17.25 9.53 17.25 8.5C17.25 6.26 15.5 4.5 13.25 4.5H7V19.5H14.04C16.13 19.5 17.75 17.8 17.75 15.75C17.75 14.24 16.88 12.96 15.6 11.29Z"
										/></svg
									>
								</button>

								<button
									type="button"
									title="Italic"
									onclick={() =>
										applyFormat({
											kind: "wrap",
											before: "_",
											after: "_",
											placeholder: "italic text",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M10 4V7H12.21L8.79 15H6V18H14V15H11.79L15.21 7H18V4H10Z"
										/></svg
									>
								</button>

								<button
									type="button"
									title="Strikethrough"
									onclick={() =>
										applyFormat({
											kind: "wrap",
											before: "~~",
											after: "~~",
											placeholder: "strikethrough text",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M6.85 7.08C6.85 4.37 9.45 3 12.24 3C13.64 3 14.89 3.36 15.83 4.07C16.77 4.77 17.28 5.75 17.28 6.96H14.7C14.7 6.43 14.44 5.99 13.92 5.65C13.4 5.31 12.87 5.11 12.23 5.11C11.34 5.11 10.62 5.35 10.09 5.82C9.56 6.29 9.29 6.84 9.29 7.49C9.29 8.04 9.49 8.5 9.91 8.76C10.13 8.9 10.86 9.13 11.31 9.2L12.17 9.33C12.89 9.44 13.49 9.62 14 9.8H17.67C17.91 9.23 18.03 8.62 18.03 8H20.62C20.62 9.66 19.99 11.12 18.88 12.17C18.83 12.22 18.75 12.26 18.7 12.31H22V14H2V12.31H12.23C11.99 12.26 11.73 12.2 11.43 12.14C10.26 11.97 9.38 11.56 8.71 10.95C7.91 10.22 7.44 9.24 7.44 8H9.09C9.09 8.36 9.27 8.71 9.54 8.99C9.85 9.3 10.27 9.5 10.77 9.63C11.12 9.73 11.66 9.84 12.17 9.97V9.5C12.08 9.5 11.98 9.46 11.88 9.44C11.47 9.36 10.78 9.16 10.36 8.91C9.78 8.55 9.49 8.06 9.49 7.49C9.49 6.78 9.77 6.23 10.32 5.84C10.87 5.45 11.56 5.25 12.38 5.25C13.19 5.25 13.84 5.45 14.33 5.84C14.83 6.24 15.07 6.74 15.07 7.33H17.65C17.65 6.09 17.09 5.09 15.98 4.36C14.86 3.63 13.62 3.25 12.24 3.25C10.65 3.25 9.28 3.65 8.17 4.44C7.07 5.24 6.52 6.29 6.52 7.59C6.52 8.56 6.85 9.38 7.52 10.05C7.68 10.21 7.85 10.35 8.04 10.48H6.85V7.08ZM14.7 17H12.1C11.08 17 10.27 16.74 9.69 16.21C9.11 15.68 8.83 14.98 8.83 14.12V14.09H6.22V14.12C6.22 15.47 6.79 16.58 7.94 17.44C9.09 18.3 10.51 18.75 12.24 18.75C13.82 18.75 15.1 18.38 16.1 17.63C17.1 16.88 17.59 15.9 17.59 14.67C17.59 14.21 17.52 13.78 17.38 13.38H14.7V17Z"
										/></svg
									>
								</button>

								<div class="w-px h-4 bg-zinc-800 mx-1"></div>

								<button
									type="button"
									title="Inline Code"
									onclick={() =>
										applyFormat({
											kind: "wrap",
											before: "`",
											after: "`",
											placeholder: "code",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M9.4 16.6L4.8 12L9.4 7.4L8 6L2 12L8 18L9.4 16.6ZM14.6 16.6L19.2 12L14.6 7.4L16 6L22 12L16 18L14.6 16.6Z"
										/></svg
									>
								</button>

								<button
									type="button"
									title="Code block"
									onclick={() =>
										applyFormat({
											kind: "block",
											before: "```\n",
											after: "\n```",
											placeholder: "code here",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer font-mono text-[10px] font-bold leading-none px-2"
								>
									```
								</button>

								<div class="w-px h-4 bg-zinc-800 mx-1"></div>

								<button
									type="button"
									title="Heading 1"
									onclick={() =>
										applyFormat({
											kind: "prefix",
											prefix: "# ",
											placeholder: "Heading 1",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer font-bold text-[11px] leading-none px-2"
								>
									H1
								</button>

								<button
									type="button"
									title="Heading 2"
									onclick={() =>
										applyFormat({
											kind: "prefix",
											prefix: "## ",
											placeholder: "Heading 2",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer font-bold text-[11px] leading-none px-2"
								>
									H2
								</button>

								<button
									type="button"
									title="Heading 3"
									onclick={() =>
										applyFormat({
											kind: "prefix",
											prefix: "### ",
											placeholder: "Heading 3",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer font-bold text-[11px] leading-none px-2"
								>
									H3
								</button>

								<div class="w-px h-4 bg-zinc-800 mx-1"></div>

								<button
									type="button"
									title="Blockquote"
									onclick={() =>
										applyFormat({
											kind: "prefix",
											prefix: "> ",
											placeholder: "quoted text",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"
										/></svg
									>
								</button>

								<button
									type="button"
									title="Unordered List"
									onclick={() =>
										applyFormat({
											kind: "prefix",
											prefix: "- ",
											placeholder: "List item",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"
										/></svg
									>
								</button>

								<button
									type="button"
									title="Ordered List"
									onclick={() =>
										applyFormat({
											kind: "prefix",
											prefix: "1. ",
											placeholder: "List item",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"
										/></svg
									>
								</button>

								<div class="w-px h-4 bg-zinc-800 mx-1"></div>

								<button
									type="button"
									title="Link"
									onclick={() =>
										applyFormat({
											kind: "wrap",
											before: "[",
											after: "](url)",
											placeholder: "link text",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path
											d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
										/></svg
									>
								</button>

								<button
									type="button"
									title="Horizontal Rule"
									onclick={() =>
										applyFormat({
											kind: "block",
											before: "\n---\n",
											after: "",
											placeholder: "",
										})}
									class="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="currentColor"
										><path d="M19 13H5v-2h14v2z" /></svg
									>
								</button>
							</div>

							<textarea
								id="post-content"
								bind:value={content}
								bind:this={textareaRef}
								required
								rows="14"
								placeholder="Write your post content here…&#10;&#10;## Heading&#10;&#10;Markdown is supported."
								class="w-full px-3.5 py-2.5 rounded-b-lg rounded-t-none bg-zinc-900 border border-zinc-700/60 border-t-zinc-800 text-zinc-100 text-sm placeholder-zinc-600 font-mono leading-relaxed resize-y focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
							></textarea>
						{:else}
							<div
								class="w-full min-h-[350px] max-h-[550px] px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 overflow-y-auto"
							>
								<article
									class="prose-custom text-zinc-400 leading-relaxed text-[0.96rem] text-left"
								>
									{#if content.trim()}
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html renderMarkdown(content)}
									{:else}
										<p
											class="text-zinc-600 italic text-sm text-center py-10"
										>
											Nothing to preview. Write some
											content first!
										</p>
									{/if}
								</article>
							</div>
						{/if}
					</div>

					<div
						class="space-y-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60"
					>
						<div
							class="flex justify-between items-center flex-wrap gap-2"
						>
							<div>
								<span
									class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
									>Content Images Helper</span
								>
								<p class="text-[10px] text-zinc-550 mt-0.5">
									Upload new assets or reuse existing gallery
									images.
								</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={openMediaGallery}
									class="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700/50 transition-colors cursor-pointer"
								>
									Manage Gallery
								</button>
								<label
									class="px-2.5 py-1.5 rounded bg-accent-600/20 hover:bg-accent-600/30 text-accent-300 text-xs font-medium cursor-pointer transition-colors border border-accent-500/20 flex items-center gap-1.5"
								>
									<svg
										class="w-3.5 h-3.5 text-accent-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 4v16m8-8H4"
										/>
									</svg>
									Upload New Image
									<input
										type="file"
										accept="image/*"
										onchange={handleContentUpload}
										class="hidden"
									/>
								</label>
							</div>
						</div>

						{#if contentUploading}
							<div
								class="flex items-center gap-1.5 text-xs text-zinc-500"
							>
								<div
									class="w-3.5 h-3.5 border-2 border-zinc-700 border-t-accent-500 rounded-full animate-spin"
								></div>
								Uploading and indexing asset...
							</div>
						{/if}

						{#if contentUploadError}
							<p class="text-xs text-red-400">
								{contentUploadError}
							</p>
						{/if}

						{#if mediaLoadError}
							<div
								class="p-3 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs space-y-1"
							>
								<p class="font-semibold">
									Gallery Load Failed:
								</p>
								<p class="text-zinc-405 leading-normal">
									{mediaLoadError}
								</p>
								<p
									class="text-[10px] text-zinc-500 leading-normal pt-1"
								>
									Please ensure your Firestore Security Rules
									permit read/write access to the <code
										class="bg-zinc-900 px-1 py-0.5 rounded text-red-300"
										>media_gallery</code
									>
									collection. See
									<code
										class="bg-zinc-900 px-1 py-0.5 rounded text-zinc-305 font-mono"
										>firestore.rules</code
									>.
								</p>
							</div>
						{/if}

						{#if mediaItems.length > 0}
							<div class="space-y-2 mt-2">
								<p
									class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider"
								>
									Recent Gallery Images
								</p>
								<div
									class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1"
								>
									{#each mediaItems.slice(0, 4) as img (img.id)}
										<div
											class="flex items-center justify-between gap-3 p-2 rounded bg-zinc-950 border border-zinc-850 text-xs hover:border-zinc-800 transition-colors"
										>
											<div
												class="flex items-center gap-2 min-w-0"
											>
												<img
													src={img.url}
													alt=""
													class="w-8 h-8 object-cover rounded bg-zinc-900 border border-zinc-800 shrink-0"
												/>
												<span
													class="text-zinc-300 truncate font-mono text-[11px]"
													title={img.name}
													>{img.name}</span
												>
											</div>
											<div
												class="flex items-center gap-1 shrink-0"
											>
												<button
													type="button"
													onclick={() =>
														insertMarkdownAtCursor(
															img.url,
															img.name.split(
																".",
															)[0],
														)}
													class="px-2 py-1 rounded bg-accent-600/10 hover:bg-accent-600/20 text-accent-300 font-medium transition-colors text-[10px] cursor-pointer"
													title="Insert image into editor content"
												>
													Insert
												</button>
												<button
													type="button"
													onclick={() => {
														coverImage = img.url;
														alert(
															"Set cover image successfully!",
														);
													}}
													class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-[10px] cursor-pointer"
												>
													Cover
												</button>
											</div>
										</div>
									{/each}
								</div>
								{#if mediaItems.length > 4}
									<p
										class="text-[10px] text-zinc-500 text-right"
									>
										Showing 4 of {mediaItems.length} images.
										<button
											type="button"
											onclick={openMediaGallery}
											class="text-accent-400 hover:text-accent-300 underline cursor-pointer"
											>View all in gallery</button
										>
									</p>
								{/if}
							</div>
						{:else}
							<p class="text-xs text-zinc-650 py-2">
								No images found in your media gallery. Upload
								one to get started!
							</p>
						{/if}
					</div>

					{#if formError}
						<div
							class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
						>
							<svg
								class="w-4 h-4 shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{formError}
						</div>
					{/if}

					{#if successMsg}
						<div
							class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
						>
							<svg
								class="w-4 h-4 shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							{successMsg}
						</div>
					{/if}

					<div class="flex justify-end gap-3">
						{#if editingPostId}
							<button
								type="button"
								onclick={resetForm}
								class="px-6 py-2.5 rounded-lg border border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 text-sm font-semibold transition-all duration-200"
							>
								Cancel Edit
							</button>
						{/if}

						<button
							id="publish-btn"
							type="submit"
							disabled={submitting}
							class="px-6 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-accent-600/20"
						>
							{#if submitting}
								<div
									class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
								></div>
								{#if editingPostId}Saving…{:else}Publishing…{/if}
							{:else}
								<svg
									class="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									{#if editingPostId}
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
										/>
									{:else}
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
										/>
									{/if}
								</svg>
								{#if editingPostId}Save Changes{:else}Publish
									Post{/if}
							{/if}
						</button>
					</div>
				</form>
			</section>

			<section
				class="bg-surface-900/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/40"
			>
				<h2
					class="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2"
				>
					<svg
						class="w-4 h-4 text-accent-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					Published Posts
					{#if !postsLoading}
						<span class="ml-auto text-xs font-normal text-zinc-500"
							>{posts.length} total</span
						>
					{/if}
				</h2>

				{#if postsLoading}
					<div
						class="flex items-center justify-center py-10 gap-3 text-zinc-500 text-sm"
					>
						<div
							class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"
						></div>
						Loading posts…
					</div>
				{:else if posts.length === 0}
					<p class="text-center py-10 text-zinc-600 text-sm">
						No posts yet. Publish your first one above!
					</p>
				{:else}
					<div class="space-y-2">
						{#each posts as post (post.id)}
							<div
								class="flex items-center gap-4 px-4 py-3 rounded-lg bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-all duration-200 group"
							>
								{#if post.coverImage}
									<img
										src={post.coverImage}
										alt=""
										class="w-10 h-7 object-cover rounded bg-zinc-950 border border-zinc-800 shrink-0"
									/>
								{:else}
									<div
										class="w-10 h-7 rounded bg-zinc-850 border border-zinc-800 flex items-center justify-center shrink-0"
									>
										<svg
											class="w-3.5 h-3.5 text-zinc-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
											/>
										</svg>
									</div>
								{/if}

								<div class="flex-1 min-w-0">
									<p
										class="text-sm font-medium text-zinc-200 truncate"
									>
										{post.title}
									</p>
									<p
										class="text-xs text-zinc-650 font-mono mt-0.5 truncate"
									>
										/blogs/{post.slug}
									</p>
								</div>
								<span class="text-xs text-zinc-600 shrink-0"
									>{formatDate(post.createdAt)}</span
								>

								<div
									class="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0"
								>
									<a
										href="/blogs/{post.slug}/"
										target="_blank"
										class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
									>
										View
									</a>
									<button
										type="button"
										onclick={() => startEdit(post)}
										class="text-xs text-accent-400 hover:text-accent-300 transition-colors font-medium"
									>
										Edit
									</button>
									<button
										type="button"
										onclick={() => handleDelete(post)}
										class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
									>
										Delete
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	</div>

	{#if showMediaGallery}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
			>
				<div
					class="flex items-center justify-between px-6 py-4 border-b border-zinc-800"
				>
					<div>
						<h3 class="text-lg font-bold text-zinc-100">
							Media Gallery
						</h3>
						<p class="text-xs text-zinc-500 mt-0.5">
							Upload, manage, and insert assets into your post.
						</p>
					</div>
					<button
						type="button"
						onclick={() => (showMediaGallery = false)}
						class="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-800 rounded-lg cursor-pointer"
						aria-label="Close Gallery"
					>
						<svg
							class="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				<div
					class="px-6 py-3 bg-zinc-950 border-b border-zinc-850 flex flex-wrap items-center justify-between gap-4"
				>
					<div class="flex items-center gap-2">
						<label
							class="px-3.5 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2 shadow-lg shadow-accent-600/20"
						>
							<svg
								class="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
								/>
							</svg>
							Upload New Image
							<input
								type="file"
								accept="image/*"
								onchange={handleGalleryUpload}
								class="hidden"
							/>
						</label>

						{#if mediaUploading}
							<div
								class="flex items-center gap-1.5 text-xs text-zinc-400 animate-pulse"
							>
								<div
									class="w-3.5 h-3.5 border-2 border-zinc-700 border-t-accent-500 rounded-full animate-spin"
								></div>
								Uploading to storage...
							</div>
						{/if}

						{#if mediaUploadError}
							<span class="text-xs text-red-400"
								>{mediaUploadError}</span
							>
						{/if}
					</div>

					<div class="text-xs text-zinc-500 font-mono">
						{mediaItems.length} assets indexed
					</div>
				</div>

				<div class="flex-1 overflow-y-auto p-6 min-h-[300px]">
					{#if mediaLoading}
						<div
							class="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500"
						>
							<div
								class="w-8 h-8 border-2 border-zinc-700 border-t-accent-500 rounded-full animate-spin"
							></div>
							<p class="text-sm">Loading gallery assets...</p>
						</div>
					{:else if mediaItems.length === 0}
						<div
							class="flex flex-col items-center justify-center py-20 text-center"
						>
							<svg
								class="w-12 h-12 text-zinc-700 mb-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
							<p class="text-zinc-400 text-sm font-medium">
								No assets found
							</p>
							<p class="text-zinc-600 text-xs mt-1">
								Upload your first image to get started.
							</p>
						</div>
					{:else}
						<div
							class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
						>
							{#each mediaItems as item (item.id)}
								{@const isDeleting = deletingMediaIds.has(
									item.id,
								)}
								<div
									class="group relative flex flex-col bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden aspect-square hover:border-zinc-750 transition-all duration-200"
								>
									<img
										src={item.url}
										alt={item.name}
										class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
										loading="lazy"
									/>

									<div
										class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-left transition-opacity duration-200 group-hover:opacity-0"
									>
										<p
											class="text-[10px] font-mono text-zinc-300 truncate"
										>
											{item.name}
										</p>
									</div>

									<div
										class="absolute inset-0 bg-black/85 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-all duration-200"
									>
										<div
											class="flex items-start justify-between gap-2"
										>
											<p
												class="text-[10px] text-zinc-450 truncate font-mono flex-1 text-left"
												title={item.name}
											>
												{item.name}
											</p>
											<button
												type="button"
												onclick={() =>
													handleDeleteMedia(item)}
												disabled={isDeleting}
												class="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 hover:border-red-700/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
												title="Delete image"
											>
												<svg
													class="w-3.5 h-3.5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>

										<div class="flex flex-col gap-1.5">
											<button
												type="button"
												onclick={() =>
													insertMarkdownAtCursor(
														item.url,
														item.name.split(".")[0],
													)}
												class="w-full py-1 px-2 rounded bg-accent-600 hover:bg-accent-500 text-white text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
											>
												<svg
													class="w-3 h-3"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 4v16m8-8H4"
													/>
												</svg>
												Insert Markdown
											</button>
											<button
												type="button"
												onclick={() => {
													coverImage = item.url;
													alert(
														"Set cover image successfully!",
													);
												}}
												class="w-full py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-750 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
											>
												Set as Cover
											</button>
											<button
												type="button"
												onclick={() =>
													copyToClipboard(
														`![${item.name.split(".")[0]}](${item.url})`,
													)}
												class="w-full py-1 px-2 rounded hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-[10px] transition-colors cursor-pointer"
											>
												Copy Link Tag
											</button>
										</div>
									</div>

									{#if isDeleting}
										<div
											class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center"
										>
											<div
												class="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin"
											></div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Footer -->
				<div
					class="px-6 py-4 bg-zinc-950 border-t border-zinc-800 flex justify-end"
				>
					<button
						type="button"
						onclick={() => (showMediaGallery = false)}
						class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors border border-zinc-700/50 cursor-pointer"
					>
						Close Gallery
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
