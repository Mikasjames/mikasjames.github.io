<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { goto } from "$app/navigation";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		createPost,
		getPosts,
		updatePost,
		deletePost,
		type BlogPost,
	} from "$lib/firebase/firestore.svelte";
	import { uploadImage } from "$lib/firebase/storage";
	import type { User } from "firebase/auth";

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
	let slugManuallyEdited = $state(false);

	let editingPostId = $state<string | null>(null);

	let submitting = $state(false);
	let successMsg = $state("");
	let formError = $state("");

	let coverUploading = $state(false);
	let coverError = $state("");

	let contentUploading = $state(false);
	let contentUploadError = $state("");
	let uploadedContentImages = $state<
		Array<{ name: string; url: string; markdown: string }>
	>([]);

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
		if (user) await loadPosts();
	});

	async function handlePublish(e: Event) {
		e.preventDefault();
		if (!title || !slug || !excerpt || !content) {
			formError = "All fields are required.";
			return;
		}
		submitting = true;
		formError = "";
		successMsg = "";
		try {
			if (editingPostId) {
				await updatePost(editingPostId, {
					title,
					slug,
					excerpt,
					content,
					coverImage,
				});
				successMsg = `"${title}" updated successfully!`;
			} else {
				await createPost({
					title,
					slug,
					excerpt,
					content,
					coverImage,
				});
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

	function startEdit(post: BlogPost) {
		editingPostId = post.id;
		title = post.title;
		slug = post.slug;
		excerpt = post.excerpt;
		content = post.content;
		coverImage = post.coverImage;
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
		slugManuallyEdited = false;
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
			const url = await uploadImage(file, "cover-images");
			coverImage = url;
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
			const url = await uploadImage(file, "blog-content");
			const markdown = `![${file.name.split(".")[0]}](${url})`;
			uploadedContentImages = [
				{ name: file.name, url, markdown },
				...uploadedContentImages,
			];
		} catch (err: unknown) {
			contentUploadError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			contentUploading = false;
			target.value = "";
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
										class="px-3 py-1.5 rounded bg-zinc-805 hover:bg-zinc-750 text-zinc-300 text-xs font-medium cursor-pointer transition-colors border border-zinc-700/50 flex items-center gap-1.5"
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

					<div class="space-y-1.5">
						<label
							for="post-content"
							class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
						>
							Content
							<span
								class="ml-1 text-zinc-600 normal-case font-normal"
								>(Markdown supported)</span
							>
						</label>
						<textarea
							id="post-content"
							bind:value={content}
							required
							rows="14"
							placeholder="Write your post content here…&#10;&#10;## Heading&#10;&#10;Markdown is supported."
							class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 font-mono leading-relaxed resize-y focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
						></textarea>
					</div>

					<div
						class="space-y-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60"
					>
						<div class="flex justify-between items-center">
							<span
								class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
								>Content Images Upload Helper</span
							>
							<label
								class="px-2 py-1.5 rounded bg-zinc-805 hover:bg-zinc-750 text-zinc-300 text-xs font-medium cursor-pointer transition-colors border border-zinc-700/50 flex items-center gap-1.5"
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
								Upload Image to Content
								<input
									type="file"
									accept="image/*"
									onchange={handleContentUpload}
									class="hidden"
								/>
							</label>
						</div>

						{#if contentUploading}
							<div
								class="flex items-center gap-1.5 text-xs text-zinc-500"
							>
								<div
									class="w-3 h-3 border border-zinc-700 border-t-accent-400 rounded-full animate-spin"
								></div>
								Uploading to storage...
							</div>
						{/if}

						{#if contentUploadError}
							<p class="text-xs text-red-400">
								{contentUploadError}
							</p>
						{/if}

						{#if uploadedContentImages.length > 0}
							<div
								class="space-y-2 mt-2 max-h-[160px] overflow-y-auto pr-1"
							>
								{#each uploadedContentImages as img}
									<div
										class="flex items-center justify-between gap-3 p-2 rounded bg-zinc-900/80 border border-zinc-800/40 text-xs"
									>
										<div
											class="flex items-center gap-2 min-w-0"
										>
											<img
												src={img.url}
												alt=""
												class="w-6 h-6 object-cover rounded bg-zinc-950 border border-zinc-800"
											/>
											<span
												class="text-zinc-400 truncate max-w-[150px] font-mono"
												>{img.name}</span
											>
										</div>
										<div
											class="flex items-center gap-1 shrink-0"
										>
											<button
												type="button"
												onclick={() =>
													copyToClipboard(
														img.markdown,
													)}
												class="px-2 py-1 rounded bg-accent-600/20 hover:bg-accent-600/30 text-accent-300 font-medium transition-colors"
											>
												Copy Markdown Tag
											</button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-zinc-500">
								No images uploaded during this editing session.
								Upload files to get their Markdown code tags.
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
{/if}
