<script lang="ts">
	import { tick } from "svelte";
	import CoverImage from "$lib/components/CoverImage.svelte";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
	import ContentImagesHelper from "$lib/components/ContentImagesHelper.svelte";
	import { createPost, updatePost, type BlogPost, type ImageMeta } from "$lib/firebase/firestore.svelte";
	import { resolveMissingImageMeta, sanitizeImageMetaFromMarkdown, enrichImageMetaFromGallery } from "$lib/utils/imageMeta";
	import type { MediaItem } from "$lib/firebase/firestore.svelte";
	import type { createMediaStore } from "$lib/firebase/media.svelte";
	import MediaGalleryDialog from "$lib/components/MediaGalleryDialog.svelte";

	type MediaStore = ReturnType<typeof createMediaStore>;

	interface BlogFormState {
		id: string | null;
		title: string;
		slug: string;
		excerpt: string;
		content: string;
		status: "draft" | "published" | "unlisted";
		coverImage: string | null;
		imageMeta: Record<string, ImageMeta>;
		slugManuallyEdited: boolean;
		submitting: boolean;
		successMsg: string;
		error: string;
		coverUploading: boolean;
		coverError: string;
	}

	let {
		mediaStore,
		loadPosts,
	} = $props<{
		mediaStore: MediaStore;
		loadPosts: () => Promise<void>;
	}>();

	let blogForm = $state<BlogFormState>({
		id: null,
		title: "",
		slug: "",
		excerpt: "",
		content: "",
		status: "published",
		coverImage: null,
		imageMeta: {},
		slugManuallyEdited: false,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	let showMediaGallery = $state(false);
	let activeTab = $state<"write" | "preview">("write");
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	export function startEdit(post: BlogPost) {
		blogForm.id = post.id;
		blogForm.title = post.title;
		blogForm.slug = post.slug;
		blogForm.excerpt = post.excerpt;
		blogForm.content = post.content;
		blogForm.coverImage = post.coverImage;
		blogForm.status = post.status ?? "published";
		blogForm.imageMeta = sanitizeImageMetaFromMarkdown(
			post.content,
			enrichImageMetaFromGallery(post.content, post.imageMeta ?? {}, mediaStore.mediaItems),
		);
		blogForm.slugManuallyEdited = true;
		blogForm.successMsg = "";
		blogForm.error = "";
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	export function resetForm() {
		blogForm.id = null;
		blogForm.title = "";
		blogForm.slug = "";
		blogForm.excerpt = "";
		blogForm.content = "";
		blogForm.coverImage = null;
		blogForm.status = "published";
		blogForm.imageMeta = {};
		blogForm.slugManuallyEdited = false;
		blogForm.successMsg = "";
		blogForm.error = "";
	}

	async function handlePublish(e: Event) {
		e.preventDefault();
		if (
			!blogForm.title ||
			!blogForm.slug ||
			!blogForm.excerpt ||
			!blogForm.content
		) {
			blogForm.error = "All fields are required.";
			return;
		}

		blogForm.submitting = true;
		blogForm.error = "";
		blogForm.successMsg = "";

		try {
			const resolvedImageMeta = await resolveMissingImageMeta(
				blogForm.content,
				blogForm.imageMeta,
			);
			const sanitizedImageMeta = sanitizeImageMetaFromMarkdown(
				blogForm.content,
				resolvedImageMeta,
			);
			blogForm.imageMeta = sanitizedImageMeta;

			const postPayload = {
				title: blogForm.title,
				slug: blogForm.slug,
				excerpt: blogForm.excerpt,
				content: blogForm.content,
				coverImage: blogForm.coverImage,
				status: blogForm.status,
				imageMeta: sanitizedImageMeta,
			};

			if (blogForm.id) {
				await updatePost(blogForm.id, postPayload);
				blogForm.successMsg = `"${blogForm.title}" updated successfully!`;
			} else {
				await createPost(postPayload);
				blogForm.successMsg = `"${blogForm.title}" published successfully!`;
			}
			resetForm();
			await loadPosts();
		} catch (err: unknown) {
			blogForm.error =
				err instanceof Error ? err.message : "Failed to save post.";
		} finally {
			blogForm.submitting = false;
		}
	}

	function onSlugInput(e: Event) {
		blogForm.slug = (e.target as HTMLInputElement).value;
		blogForm.slugManuallyEdited = true;
	}

	async function handleCoverUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		try {
			const result = await mediaStore.handleGalleryUpload(target.files[0]);
			blogForm.coverImage = result.url;
		} catch (err: unknown) {
			blogForm.coverError = err instanceof Error ? err.message : "Upload failed.";
		} finally {
			target.value = "";
		}
	}

	async function handleContentUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		try {
			const { url, width, height, name } = await mediaStore.handleGalleryUpload(file);
			blogForm.imageMeta = { ...blogForm.imageMeta, [url]: { width, height } };
			await insertMarkdownAtCursor(url, name.split(".")[0], {
				width,
				height,
			});
		} catch (err: unknown) {
			// Content upload error handled by store
		} finally {
			target.value = "";
		}
	}

	async function insertMarkdownAtCursor(
		url: string,
		altText: string,
		dims?: { width?: number; height?: number },
	) {
		activeTab = "write";
		await tick();
		if (!textareaRef) return;

		if (dims?.width && dims?.height) {
			blogForm.imageMeta = { ...blogForm.imageMeta, [url]: { width: dims.width, height: dims.height } };
		}

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const text = blogForm.content;

		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		const tag = `![${altText}](${url})`;
		const newValue = before + tag + after;

		textareaRef.value = newValue;
		blogForm.content = newValue;

		textareaRef.focus();
		textareaRef.selectionStart = textareaRef.selectionEnd =
			start + tag.length;

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.selectionEnd =
				start + tag.length;
		}
	}

	function setEditorCoverImage(url: string | null) {
		blogForm.coverImage = url;
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			alert("Copied markdown image tag to clipboard!");
		});
	}

	async function handleDeleteMediaWrapper(item: MediaItem) {
		await mediaStore.handleDeleteMedia(item, (url: string) => {
			blogForm.imageMeta = { ...blogForm.imageMeta };
			delete blogForm.imageMeta[url];
			blogForm.content = blogForm.content.replace(new RegExp(`!\\[.*?\\]\\(${url}\\)`, "g"), "");
		});
	}

	$effect(() => {
		if (!blogForm.slugManuallyEdited && !blogForm.id) {
			blogForm.slug = blogForm.title
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-");
		}
	});

	export function isEditing(postId: string) {
		return blogForm.id === postId;
	}
</script>

<section
	class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
>
	<h2
		class="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2"
	>
		{#if blogForm.id}
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
		<div class="space-y-1.5">
			<label
				for="post-title"
				class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
				>Title</label
			>
			<input
				id="post-title"
				type="text"
				bind:value={blogForm.title}
				required
				placeholder="My Awesome Post"
				class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
			/>
		</div>

		<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
					value={blogForm.slug}
					oninput={onSlugInput}
					required
					placeholder="my-awesome-post"
					class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 font-mono focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
				/>
			</div>

			<div class="space-y-1.5">
				<label
					for="post-status"
					class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
					>Status</label
				>
				<select
					id="post-status"
					bind:value={blogForm.status}
					class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
				>
					<option value="published">Published</option>
					<option value="unlisted">Unlisted</option>
					<option value="draft">Draft</option>
				</select>
			</div>
		</div>

		<CoverImage
			bind:coverImage={blogForm.coverImage}
			onCoverUpload={handleCoverUpload}
			coverUploading={mediaStore.mediaUploading}
			coverError={blogForm.coverError}
		/>

		<div class="space-y-1.5">
			<label
				for="post-excerpt"
				class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
				>Excerpt</label
			>
			<textarea
				id="post-excerpt"
				bind:value={blogForm.excerpt}
				required
				rows="2"
				placeholder="A short summary shown in the blog listing…"
				class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 resize-none focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
			></textarea>
		</div>

		<div class="space-y-2">
			<MarkdownEditor
				id="post-content"
				bind:content={blogForm.content}
				bind:imageMeta={blogForm.imageMeta}
				bind:textareaRef
				bind:activeTab
				onOpenMediaGallery={() => {
					showMediaGallery = true;
					mediaStore.openMediaGallery();
				}}
				placeholderText="Write your post content here…&#10;&#10;## Heading&#10;&#10;Markdown is supported."
			/>
		</div>

		<ContentImagesHelper
			onOpenMediaGallery={() => {
				showMediaGallery = true;
				mediaStore.openMediaGallery();
			}}
			{handleContentUpload}
			contentUploading={mediaStore.mediaUploading}
			contentUploadError={mediaStore.mediaUploadError}
			recentMediaItems={mediaStore.recentMediaItems}
			mediaLoadError={mediaStore.mediaLoadError}
			{insertMarkdownAtCursor}
			{setEditorCoverImage}
		/>

		{#if blogForm.error}
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
				{blogForm.error}
			</div>
		{/if}

		{#if blogForm.successMsg}
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
				{blogForm.successMsg}
			</div>
		{/if}

		<div
			class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
		>
			{#if blogForm.id}
				<button
					type="button"
					onclick={resetForm}
					class="w-full rounded-lg border border-zinc-700/60 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:text-zinc-100 sm:w-auto"
				>
					Cancel Edit
				</button>
			{/if}

			<button
				id="publish-btn"
				type="submit"
				disabled={blogForm.submitting}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-600/20 transition-all duration-200 hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
			>
				{#if blogForm.submitting}
					<div
						class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
					></div>
					{#if blogForm.id}Saving…{:else}Publishing…{/if}
				{:else}
					<svg
						class="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						{#if blogForm.id}
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
					{#if blogForm.id}Save Changes{:else}Publish
						Post{/if}
				{/if}
			</button>
		</div>
	</form>
</section>

<MediaGalleryDialog
	bind:showMediaGallery
	mediaItems={mediaStore.mediaItems}
	mediaUploading={mediaStore.mediaUploading}
	mediaUploadError={mediaStore.mediaUploadError}
	handleGalleryUpload={(e: Event & { target: HTMLInputElement }) => {
		const file = e.target.files?.[0];
		if (file) mediaStore.handleGalleryUpload(file);
	}}
	handleDeleteMedia={handleDeleteMediaWrapper}
	{copyToClipboard}
	insertMarkdownAtCursor={insertMarkdownAtCursor}
	setEditorCoverImage={setEditorCoverImage}
	mediaLoading={mediaStore.mediaLoading}
	deletingMediaIds={mediaStore.deletingMediaIds}
	loadMoreMediaItems={mediaStore.loadMoreMediaItems}
	mediaHasMore={mediaStore.mediaHasMore}
/>
