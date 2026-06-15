<script lang="ts">
	import { onMount, onDestroy, tick } from "svelte";
	import { goto } from "$app/navigation";
	import {
		computeFormattedSelection,
		type FormatAction,
	} from "$lib/utils/markdownEditor";
	import CoverImage from "$lib/components/CoverImage.svelte";
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
		getJournalEntries,
		createJournalEntry,
		updateJournalEntry,
		deleteJournalEntry,
		type JournalEntry,
	} from "$lib/firebase/firestore.svelte";
	import {
		extractImageUrlsFromMarkdown,
		sanitizeImageMetaFromMarkdown,
		removeImageReferencesFromMarkdown,
		compressAndGetMeta,
		getImageDimensionsFromUrl,
		resolveMissingImageMeta,
	} from "$lib/utils/imageMeta";
	import { uploadImage, deleteImage } from "$lib/firebase/storage";
	import { renderMarkdown } from "$lib/utils/renderMarkdown";
	import type { User } from "firebase/auth";
	import MediaGalleryDialog from "$lib/components/MediaGalleryDialog.svelte";
	import ContentImagesHelper from "$lib/components/ContentImagesHelper.svelte";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";

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

	// Unified Blog Form State
	let blogForm = $state({
		id: null as string | null,
		title: "",
		slug: "",
		excerpt: "",
		content: "",
		status: "published" as "draft" | "published" | "unlisted",
		coverImage: null as string | null,
		imageMeta: {} as Record<string, ImageMeta>,
		slugManuallyEdited: false,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	// Unified Journal Form State
	let journalForm = $state({
		id: null as string | null,
		title: "",
		excerpt: "",
		content: "",
		coverImage: null as string | null,
		imageMeta: {} as Record<string, ImageMeta>,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	// Content uploading state is shared by whichever editor panel is active
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

	// Journal list states
	let currentSection = $state<"blogs" | "journal">("blogs");
	let journalEntries = $state<JournalEntry[]>([]);
	let journalEntriesLoading = $state(false);
	let journalEntriesLoadError = $state("");

	function getEditorContent(): string {
		return currentSection === "journal"
			? journalForm.content
			: blogForm.content;
	}

	function setEditorContent(value: string) {
		if (currentSection === "journal") {
			journalForm.content = value;
		} else {
			blogForm.content = value;
		}
	}

	function getEditorImageMeta(): Record<string, ImageMeta> {
		return currentSection === "journal"
			? journalForm.imageMeta
			: blogForm.imageMeta;
	}

	function setEditorImageMeta(meta: Record<string, ImageMeta>) {
		if (currentSection === "journal") {
			journalForm.imageMeta = meta;
		} else {
			blogForm.imageMeta = meta;
		}
	}

	function mergeEditorImageMeta(url: string, dims: ImageMeta) {
		const meta = getEditorImageMeta();
		setEditorImageMeta({ ...meta, [url]: dims });
	}

	function setEditorCoverImage(url: string | null) {
		if (currentSection === "journal") {
			journalForm.coverImage = url;
		} else {
			blogForm.coverImage = url;
		}
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

	function onSlugInput(e: Event) {
		blogForm.slug = (e.target as HTMLInputElement).value;
		blogForm.slugManuallyEdited = true;
	}

	async function loadPosts() {
		postsLoading = true;
		try {
			posts = await getPosts();
		} finally {
			postsLoading = false;
		}
	}

	async function loadJournalEntries() {
		journalEntriesLoading = true;
		journalEntriesLoadError = "";
		try {
			journalEntries = await getJournalEntries();
		} catch (err: unknown) {
			console.error("Failed to load journal entries:", err);
			journalEntriesLoadError =
				err instanceof Error
					? err.message
					: "Failed to load journal entries. Check Firestore rules.";
		} finally {
			journalEntriesLoading = false;
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
			await loadJournalEntries();
		}
	});

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

	async function handleJournalCoverUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		journalForm.coverUploading = true;
		journalForm.coverError = "";
		try {
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(
				compressedFile,
				"journal-cover-images",
			);
			journalForm.coverImage = url;
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			if (showMediaGallery) {
				await loadMediaItems();
			}
		} catch (err: unknown) {
			journalForm.coverError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			journalForm.coverUploading = false;
			target.value = "";
		}
	}

	async function handleJournalSubmit(e: Event) {
		e.preventDefault();
		if (!journalForm.content) {
			journalForm.error = "Content is required.";
			return;
		}

		journalForm.submitting = true;
		journalForm.error = "";
		journalForm.successMsg = "";
		try {
			const resolvedImageMeta = await resolveMissingImageMeta(
				journalForm.content,
				journalForm.imageMeta,
			);
			const sanitizedImageMeta = sanitizeImageMetaFromMarkdown(
				journalForm.content,
				resolvedImageMeta,
			);
			journalForm.imageMeta = sanitizedImageMeta;

			const payload = {
				title: journalForm.title || "Untitled Entry",
				excerpt: journalForm.excerpt,
				content: journalForm.content,
				coverImage: journalForm.coverImage,
				imageMeta: sanitizedImageMeta,
			};

			if (journalForm.id) {
				await updateJournalEntry(journalForm.id, payload);
				journalForm.successMsg = "Journal entry updated successfully!";
			} else {
				await createJournalEntry(payload);
				journalForm.successMsg = "Journal entry added successfully!";
			}
			resetJournalForm();
			await loadJournalEntries();
		} catch (err: unknown) {
			journalForm.error =
				err instanceof Error
					? err.message
					: "Failed to save journal entry.";
		} finally {
			journalForm.submitting = false;
		}
	}

	function startEditJournal(entry: JournalEntry) {
		journalForm.id = entry.id;
		journalForm.title = entry.title;
		journalForm.excerpt = entry.excerpt || "";
		journalForm.content = entry.content;
		journalForm.coverImage = entry.coverImage || null;
		journalForm.imageMeta = sanitizeImageMetaFromMarkdown(
			entry.content,
			enrichImageMetaFromGallery(entry.content, entry.imageMeta ?? {}),
		);
		journalForm.successMsg = "";
		journalForm.error = "";
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function resetJournalForm() {
		journalForm.id = null;
		journalForm.title = "";
		journalForm.excerpt = "";
		journalForm.content = "";
		journalForm.coverImage = null;
		journalForm.imageMeta = {};
		journalForm.successMsg = "";
		journalForm.error = "";
	}

	async function handleDeleteJournal(entry: JournalEntry) {
		if (!confirm(`Are you sure you want to delete this journal entry?`)) {
			return;
		}
		try {
			await deleteJournalEntry(entry.id);
			if (journalForm.id === entry.id) {
				resetJournalForm();
			}
			await loadJournalEntries();
		} catch (err: unknown) {
			alert(
				err instanceof Error
					? err.message
					: "Failed to delete journal entry.",
			);
		}
	}

	function enrichImageMetaFromGallery(
		markdown: string,
		currentImageMeta: Record<string, ImageMeta>,
	): Record<string, ImageMeta> {
		const urls = extractImageUrlsFromMarkdown(markdown);
		return urls.reduce(
			(acc, url) => {
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
			},
			{} as Record<string, ImageMeta>,
		);
	}

	function startEdit(post: BlogPost) {
		blogForm.id = post.id;
		blogForm.title = post.title;
		blogForm.slug = post.slug;
		blogForm.excerpt = post.excerpt;
		blogForm.content = post.content;
		blogForm.coverImage = post.coverImage;
		blogForm.status = post.status ?? "published";
		blogForm.imageMeta = sanitizeImageMetaFromMarkdown(
			post.content,
			enrichImageMetaFromGallery(post.content, post.imageMeta ?? {}),
		);
		blogForm.slugManuallyEdited = true;
		blogForm.successMsg = "";
		blogForm.error = "";
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function resetForm() {
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

	async function handleDelete(post: BlogPost) {
		if (!confirm(`Are you sure you want to delete "${post.title}"?`)) {
			return;
		}
		try {
			await deletePost(post.id);
			if (blogForm.id === post.id) {
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
		blogForm.coverUploading = true;
		blogForm.coverError = "";
		try {
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "cover-images");
			blogForm.coverImage = url;
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			if (showMediaGallery) {
				await loadMediaItems();
			}
		} catch (err: unknown) {
			blogForm.coverError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			blogForm.coverUploading = false;
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
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "blog-content");
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			mergeEditorImageMeta(url, { width, height });
			await loadMediaItems();
			await insertMarkdownAtCursor(url, file.name.split(".")[0], {
				width,
				height,
			});
		} catch (err: unknown) {
			contentUploadError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			contentUploading = false;
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
			mergeEditorImageMeta(url, {
				width: dims.width,
				height: dims.height,
			});
		}

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const text = getEditorContent();

		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		const tag = `![${altText}](${url})`;

		setEditorContent(before + tag + after);

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.selectionEnd =
				start + tag.length;
		}
	}

	async function insertVideoEmbedAtCursor(url: string, title: string) {
		activeTab = "write";
		await tick();
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const text = getEditorContent();
		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		const tag = `!video[${title}](${url})`;
		setEditorContent(before + tag + after);

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.selectionEnd =
				start + tag.length;
		}
	}

	async function promptInsertImage() {
		const url = window.prompt("Image URL");
		if (!url) return;
		const trimmed = url.trim();
		const alt = window.prompt("Alt text", "Image")?.trim() || "Image";
		const meta = getEditorImageMeta();

		if (!meta[trimmed]) {
			try {
				const dims = await getImageDimensionsFromUrl(trimmed);
				setEditorImageMeta({ ...meta, [trimmed]: dims });
			} catch {
				// Insert without dimensions when probing fails.
			}
		}

		await insertMarkdownAtCursor(trimmed, alt);
	}

	async function promptInsertVideo() {
		const url = window.prompt(
			"Video URL (YouTube, Vimeo, or direct .mp4/.webm/.ogg)",
		);
		if (!url) return;
		const title =
			window
				.prompt(
					"Video title",
					textareaRef
						? textareaRef.value.substring(
								textareaRef.selectionStart,
								textareaRef.selectionEnd,
							)
						: "Video",
				)
				?.trim() || "Video";
		await insertVideoEmbedAtCursor(url.trim(), title);
	}

	async function applyFormat(action: FormatAction) {
		activeTab = "write";
		await tick();
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;

		const { newContent, cursorStart, cursorEnd } =
			computeFormattedSelection(getEditorContent(), start, end, action);

		setEditorContent(newContent);

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = cursorStart;
			textareaRef.selectionEnd = cursorEnd;
		}
	}

	async function handleKeyDown(e: KeyboardEvent) {
		const isModifier = e.ctrlKey || e.metaKey;

		if (!isModifier) return;

		switch (e.key.toLowerCase()) {
			case "b":
				e.preventDefault();
				await applyFormat({
					kind: "wrap",
					before: "**",
					after: "**",
					placeholder: "bold text",
				});
				break;

			case "i":
				e.preventDefault();
				await applyFormat({
					kind: "wrap",
					before: "_",
					after: "_",
					placeholder: "italic text",
				});
				break;

			case "k":
				e.preventDefault();
				await applyFormat({
					kind: "wrap",
					before: "[",
					after: "](url)",
					placeholder: "link text",
				});
				break;

			case "q":
				e.preventDefault();
				await applyFormat({
					kind: "prefix",
					prefix: "> ",
					placeholder: "quoted text",
				});
				break;
		}
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
			blogForm.imageMeta = { ...blogForm.imageMeta };
			delete blogForm.imageMeta[item.url];
			journalForm.imageMeta = { ...journalForm.imageMeta };
			delete journalForm.imageMeta[item.url];
			blogForm.content = removeImageReferencesFromMarkdown(
				blogForm.content,
				item.url,
			);
			journalForm.content = removeImageReferencesFromMarkdown(
				journalForm.content,
				item.url,
			);
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

			<!-- Tab switcher -->
			<div class="flex border-b border-zinc-800/40 gap-6">
				<button
					type="button"
					onclick={() => (currentSection = "blogs")}
					class="pb-3 text-sm font-semibold tracking-wide transition-all duration-200 relative {currentSection ===
					'blogs'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Blog Posts
					{#if currentSection === "blogs"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (currentSection = "journal")}
					class="pb-3 text-sm font-semibold tracking-wide transition-all duration-200 relative {currentSection ===
					'journal'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Personal Journal
					{#if currentSection === "journal"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
			</div>

			{#if currentSection === "blogs"}
				<section
					class="bg-surface-900/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/40"
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
						<div class="grid md:grid-cols-3 gap-5">
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
							coverUploading={blogForm.coverUploading}
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
								placeholderText="Write your post content here…&#10;&#10;## Heading&#10;&#10;Markdown is supported."
								{openMediaGallery}
							/>
						</div>

						<ContentImagesHelper
							bind:showMediaGallery
							{handleContentUpload}
							{contentUploading}
							{contentUploadError}
							{mediaItems}
							{mediaLoadError}
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

						<div class="flex justify-end gap-3">
							{#if blogForm.id}
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
								disabled={blogForm.submitting}
								class="px-6 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-accent-600/20"
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
							<span
								class="ml-auto text-xs font-normal text-zinc-500"
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
										<div class="flex items-center gap-2">
											<p
												class="text-sm font-medium text-zinc-200 truncate"
											>
												{post.title}
											</p>
											{#if post.status === "draft"}
												<span
													class="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-medium text-zinc-450 border border-zinc-700/50 uppercase tracking-wider font-mono"
													>Draft</span
												>
											{:else if post.status === "unlisted"}
												<span
													class="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] font-medium text-amber-400 border border-amber-500/20 uppercase tracking-wider font-mono"
													>Unlisted</span
												>
											{:else}
												<span
													class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-mono"
													>Published</span
												>
											{/if}
										</div>
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
			{:else if currentSection === "journal"}
				<section
					class="bg-surface-900/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/40"
				>
					<h2
						class="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2"
					>
						{#if journalForm.id}
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
							Edit Journal Entry
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
							New Journal Entry
						{/if}
					</h2>

					<form onsubmit={handleJournalSubmit} class="space-y-5">
						<div class="grid md:grid-cols-2 gap-5">
							<div class="space-y-1.5">
								<label
									for="journal-title"
									class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
									>Title (Optional)</label
								>
								<input
									id="journal-title"
									type="text"
									bind:value={journalForm.title}
									placeholder="Untitled Entry"
									class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
								/>
							</div>
							<div class="space-y-1.5">
								<label
									for="journal-excerpt"
									class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
									>Excerpt <span
										class="normal-case font-normal text-zinc-600"
										>(Optional)</span
									></label
								>
								<input
									id="journal-excerpt"
									type="text"
									bind:value={journalForm.excerpt}
									placeholder="A short summary or mood for this entry…"
									class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
								/>
							</div>
						</div>

						<CoverImage
							bind:coverImage={journalForm.coverImage}
							onCoverUpload={handleJournalCoverUpload}
							coverUploading={journalForm.coverUploading}
							coverError={journalForm.coverError}
						/>

						<div class="space-y-2">
							<MarkdownEditor
								id="journal-content"
								bind:content={journalForm.content}
								bind:imageMeta={journalForm.imageMeta}
								bind:textareaRef
								bind:activeTab
								placeholderText="What's on your mind today? Markdown is supported."
								{openMediaGallery}
							/>
						</div>

						<ContentImagesHelper
							bind:showMediaGallery
							{handleContentUpload}
							{contentUploading}
							{contentUploadError}
							{mediaItems}
							{mediaLoadError}
							{insertMarkdownAtCursor}
							{setEditorCoverImage}
						/>

						{#if journalForm.error}
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
								{journalForm.error}
							</div>
						{/if}

						{#if journalForm.successMsg}
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
								{journalForm.successMsg}
							</div>
						{/if}

						<div class="flex justify-end gap-3">
							{#if journalForm.id}
								<button
									type="button"
									onclick={resetJournalForm}
									class="px-6 py-2.5 rounded-lg border border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 text-sm font-semibold transition-all duration-200"
								>
									Cancel Edit
								</button>
							{/if}

							<button
								type="submit"
								disabled={journalForm.submitting}
								class="px-6 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-accent-600/20"
							>
								{#if journalForm.submitting}
									<div
										class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
									></div>
									Saving…
								{:else}
									<svg
										class="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										{#if journalForm.id}
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
									{#if journalForm.id}Save Changes{:else}Save
										Entry{/if}
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
								d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
							/>
						</svg>
						Journal Entries
						{#if !journalEntriesLoading}
							<span
								class="ml-auto text-xs font-normal text-zinc-500"
								>{journalEntries.length} total</span
							>
						{/if}
					</h2>

					{#if journalEntriesLoading}
						<div
							class="flex items-center justify-center py-10 gap-3 text-zinc-500 text-sm"
						>
							<div
								class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"
							></div>
							Loading journal entries…
						</div>
					{:else if journalEntriesLoadError}
						<div
							class="p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs space-y-1"
						>
							<p class="font-semibold">Journal Load Failed:</p>
							<p class="text-zinc-405 leading-normal">
								{journalEntriesLoadError}
							</p>
							<p
								class="text-[10px] text-zinc-500 leading-normal pt-1"
							>
								Please ensure your Firestore Security Rules
								permit authenticated read access to the <code
									class="bg-zinc-900 px-1 py-0.5 rounded text-red-300"
									>journal</code
								>
								collection for your Owner UID.
							</p>
						</div>
					{:else if journalEntries.length === 0}
						<p class="text-center py-10 text-zinc-650 text-sm">
							No journal entries found. Write your first entry
							above!
						</p>
					{:else}
						<div class="space-y-2">
							{#each journalEntries as entry (entry.id)}
								<div
									class="flex items-center gap-4 px-4 py-3 rounded-lg bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-all duration-200 group"
								>
									<div class="flex-1 min-w-0">
										<p
											class="text-sm font-medium text-zinc-200 truncate"
										>
											{entry.title || "Untitled Entry"}
										</p>
										<p
											class="text-xs text-zinc-500 font-mono mt-0.5 truncate"
										>
											{entry.excerpt ||
												entry.content.substring(
													0,
													80,
												)}{!entry.excerpt &&
											entry.content.length > 80
												? "..."
												: ""}
										</p>
									</div>
									<span class="text-xs text-zinc-600 shrink-0"
										>{formatDate(entry.createdAt)}</span
									>

									<div
										class="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0"
									>
										<button
											type="button"
											onclick={() =>
												startEditJournal(entry)}
											class="text-xs text-accent-400 hover:text-accent-300 transition-colors font-medium cursor-pointer"
										>
											Edit
										</button>
										<button
											type="button"
											onclick={() =>
												handleDeleteJournal(entry)}
											class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
										>
											Delete
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		</div>
	</div>

	<MediaGalleryDialog
		bind:showMediaGallery
		{mediaItems}
		{mediaUploading}
		{mediaUploadError}
		{handleGalleryUpload}
		{handleDeleteMedia}
		{copyToClipboard}
		{insertMarkdownAtCursor}
		{setEditorCoverImage}
		{mediaLoading}
		{deletingMediaIds}
	/>
{/if}
